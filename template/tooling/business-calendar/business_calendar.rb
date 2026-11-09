# Business Calendar calculation library.
#
# This file is the canonical implementation. build_trees.rb embeds it verbatim
# (comments included) into the "Plan" and "Calculate" nodes of the "Business
# Calendar Calculate" routine, so edit it here and rebuild rather than editing
# the routine nodes. Keep it readable: people review these nodes in the
# workflow builder. It must stay ASCII-only, must not contain the ERB closing
# tag, and must not use heredocs (the build indents every line).
#
# Two kinds of calculation:
# - Business days: date arithmetic over working days, holidays, closures and
#   working-day overrides. The time of day of an input is ignored.
# - Business hours: the same days, limited to the calendar's Work Start to
#   Work End window (one window for every working day, no breaks). Times are
#   wall-clock times in the calendar's time zone, kept as a date plus a
#   minute of the day.
require 'date'
require 'json'
begin
  require 'java'
rescue LoadError
end

module BizCal
  OPERATIONS = %w[
    add_duration is_business_day next_business_day previous_business_day business_days_between
    business_hours_between is_business_time next_business_opening
  ].freeze
  # Operations (and the business_hours unit) that need Work Start / Work End.
  HOURS_OPERATIONS = %w[business_hours_between is_business_time next_business_opening].freeze
  BETWEEN_OPERATIONS = %w[business_days_between business_hours_between].freeze
  UNIT_LIMITS = { 'business_days' => 2600, 'calendar_days' => 3660, 'weeks' => 520, 'business_hours' => 10_000 }.freeze
  DIRECTIONS = %w[after before].freeze
  ADJUSTS = %w[none previous_business_day next_business_day].freeze
  DAY_NAMES = %w[Sunday Monday Tuesday Wednesday Thursday Friday Saturday].freeze
  HHMM = /\A([01]\d|2[0-3]):[0-5]\d\z/
  MAX_STEPS = 4000
  NEXT_PREVIOUS_DAYS = 60
  PAD_DAYS = 31
  INPUT_ERRORS = %w[INVALID_ARGUMENT INVALID_DATE LIMIT_EXCEEDED].freeze

  class Error < StandardError
    attr_reader :code

    def initialize(code, message)
      super(message)
      @code = code
    end
  end

  # Time zone conversions use java.time on the Kinetic Task engine (JRuby).
  # The local test harness replaces these methods.
  module Tz
    def self.zone(id)
      java.time.ZoneId.of(id.to_s)
    rescue Exception
      raise Error.new('CALENDAR_INVALID', "Time zone '#{id}' is not a valid IANA time zone")
    end

    def self.validate(id)
      zone(id)
      true
    end

    # An ISO 8601 datetime with an offset, as [local Date, local minute of day]
    # in the calendar's time zone. Seconds are dropped.
    def self.local_moment(iso, id)
      local = java.time.OffsetDateTime.parse(iso).toInstant.atZone(zone(id)).toLocalDateTime
      [Date.new(local.getYear, local.getMonthValue, local.getDayOfMonth), local.getHour * 60 + local.getMinute]
    end

    def self.zoned(date, minute, id)
      local = java.time.LocalDate.of(date.year, date.month, date.day)
      java.time.ZonedDateTime.of(local, java.time.LocalTime.of(minute / 60, minute % 60), zone(id))
    end

    # The local wall-clock time as an instant in UTC, e.g. 2026-11-19T14:00:00Z.
    def self.utc_at(date, minute, id)
      java.time.format.DateTimeFormatter::ISO_INSTANT.format(zoned(date, minute, id).toInstant).to_s
    end

    # The local wall-clock time with its offset, e.g. 2026-11-19T08:00:00-06:00.
    def self.local_iso(date, minute, id)
      zoned(date, minute, id).format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssxxx")).to_s
    end
  end

  def self.blank?(value)
    value.nil? || value.to_s.strip.empty?
  end

  def self.fmt(date)
    date.strftime('%Y-%m-%d')
  end

  # 'HH:MM' to minutes after midnight.
  def self.minutes(hhmm)
    hour, minute = hhmm.split(':').map(&:to_i)
    hour * 60 + minute
  end

  # Integration outputs arrive as JSON strings; accept parsed values too.
  def self.submissions(raw)
    value = raw.is_a?(String) ? (raw.strip.empty? ? [] : JSON.parse(raw)) : raw
    value = value['submissions'] if value.is_a?(Hash)
    Array(value)
  end

  def self.submitted?(submission)
    submission['coreState'].nil? || submission['coreState'] == 'Submitted'
  end

  # --- Request ---------------------------------------------------------------

  def self.request(inputs)
    op = inputs['Operation'].to_s.strip
    unless OPERATIONS.include?(op)
      raise Error.new('INVALID_ARGUMENT', "Operation must be one of: #{OPERATIONS.join(', ')}")
    end
    req = {
      'operation' => op,
      'calendar' => inputs['Calendar'].to_s.strip,
      'dateRaw' => inputs['Date'].to_s.strip,
      'endRaw' => inputs['End Date'].to_s.strip
    }
    add_duration_request(inputs, req) if op == 'add_duration'
    time = inputs['Time'].to_s.strip
    unless time.empty?
      raise Error.new('INVALID_ARGUMENT', 'Time must be HH:MM in 24-hour time') unless time =~ HHMM
      req['time'] = time
    end
    req
  end

  def self.add_duration_request(inputs, req)
    unit = inputs['Unit'].to_s.strip
    unless UNIT_LIMITS.key?(unit)
      raise Error.new('INVALID_ARGUMENT', "Unit must be one of: #{UNIT_LIMITS.keys.join(', ')}")
    end
    text = inputs['Amount'].to_s.strip
    if unit == 'business_hours'
      # Hours may be fractional (1.5 = 90 minutes); the calculation is in whole minutes.
      raise Error.new('INVALID_ARGUMENT', 'Amount must be a number of hours') unless text =~ /\A[+-]?\d+(\.\d+)?\z/
      amount = text.include?('.') ? text.to_f : text.to_i
    else
      raise Error.new('INVALID_ARGUMENT', 'Amount must be a whole number') unless text =~ /\A[+-]?\d+\z/
      amount = text.to_i
    end
    limit = UNIT_LIMITS[unit]
    if amount.abs > limit
      raise Error.new('LIMIT_EXCEEDED', "Amount must be between -#{limit} and #{limit} for #{unit}")
    end
    direction = blank?(inputs['Direction']) ? 'after' : inputs['Direction'].to_s.strip
    unless DIRECTIONS.include?(direction)
      raise Error.new('INVALID_ARGUMENT', "Direction must be one of: #{DIRECTIONS.join(', ')}")
    end
    adjust = blank?(inputs['Adjust']) ? 'none' : inputs['Adjust'].to_s.strip
    raise Error.new('INVALID_ARGUMENT', "Adjust must be one of: #{ADJUSTS.join(', ')}") unless ADJUSTS.include?(adjust)
    req.merge!('unit' => unit, 'amount' => amount, 'direction' => direction, 'adjust' => adjust)
    req['minutes'] = (text.to_r * 60).round.abs if unit == 'business_hours'
  end

  # A negative amount reverses the direction.
  def self.backward?(req)
    (req['direction'] == 'before') ^ (req['amount'] < 0)
  end

  def self.signed_amount(req)
    backward?(req) ? -req['amount'].abs : req['amount'].abs
  end

  def self.needs_hours?(req)
    HOURS_OPERATIONS.include?(req['operation']) || req['unit'] == 'business_hours'
  end

  # Accepts YYYY-MM-DD, or an ISO 8601 datetime with an offset, which is
  # converted to the calendar's time zone. Returns [date, minute of day], with
  # a nil minute for a date-only value.
  def self.parse_moment(value, field, time_zone)
    text = value.to_s.strip
    raise Error.new('INVALID_ARGUMENT', "#{field} is required") if text.empty?
    if text =~ /\A\d{4}-\d{2}-\d{2}\z/
      begin
        return [Date.strptime(text, '%Y-%m-%d'), nil]
      rescue ArgumentError
        raise Error.new('INVALID_DATE', "#{field} '#{text}' is not a valid date")
      end
    end
    begin
      Tz.local_moment(text, time_zone)
    rescue Error
      raise
    rescue Exception
      raise Error.new('INVALID_DATE', "#{field} '#{text}' must be YYYY-MM-DD or an ISO 8601 datetime with an offset")
    end
  end

  # --- Calendar --------------------------------------------------------------

  def self.calendar_from(submission)
    values = submission['values'] || {}
    days = values['Working Days']
    days = JSON.parse(days) if days.is_a?(String) && days.strip.start_with?('[')
    {
      'id' => submission['id'].to_s,
      'name' => values['Name'].to_s,
      'timeZone' => values['Time Zone'].to_s,
      'workingDays' => Array(days).map(&:to_s),
      'activationHour' => values['Default Activation Hour'].to_s.strip,
      'workStart' => values['Work Start'].to_s.strip,
      'workEnd' => values['Work End'].to_s.strip,
      'isDefault' => values['Is Default'] == 'Yes'
    }
  end

  # A blank ID uses the default calendar. An unknown ID also uses the default,
  # with a warning.
  def self.resolve_calendar(calendar_submissions, requested)
    calendars = calendar_submissions.select { |s| submitted?(s) }.map { |s| calendar_from(s) }
    warnings = []
    calendar = nil
    unless blank?(requested)
      calendar = calendars.find { |c| c['id'] == requested }
      unless calendar
        warnings << {
          'code' => 'CALENDAR_NOT_FOUND_USED_DEFAULT',
          'message' => "Calendar '#{requested}' was not found, so the default calendar was used."
        }
      end
    end
    unless calendar
      defaults = calendars.select { |c| c['isDefault'] }
      raise Error.new('NO_CALENDAR', 'No business calendar is marked as the default') if defaults.empty?
      if defaults.size > 1
        names = defaults.map { |c| c['name'] }.join(', ')
        raise Error.new('AMBIGUOUS_DEFAULT', "More than one business calendar is marked as the default: #{names}")
      end
      calendar = defaults.first
    end
    validate_calendar(calendar)
    calendar['fallback'] = !warnings.empty?
    [calendar, warnings]
  end

  def self.validate_calendar(calendar)
    label = "Calendar '#{calendar['name']}'"
    Tz.validate(calendar['timeZone'])
    raise Error.new('CALENDAR_INVALID', "#{label} has no working days") if calendar['workingDays'].empty?
    unknown = calendar['workingDays'] - DAY_NAMES
    raise Error.new('CALENDAR_INVALID', "#{label} has unknown working days: #{unknown.join(', ')}") unless unknown.empty?
    unless calendar['activationHour'] =~ HHMM
      raise Error.new('CALENDAR_INVALID', "#{label} has an invalid Default Activation Hour")
    end
  end

  # Only business-hours calculations need working hours, so calendars created
  # before Work Start / Work End existed keep working for business days.
  def self.validate_hours(calendar)
    label = "Calendar '#{calendar['name']}'"
    unless calendar['workStart'] =~ HHMM && calendar['workEnd'] =~ HHMM
      raise Error.new('CALENDAR_INVALID', "#{label} needs Work Start and Work End (HH:MM) for business-hours calculations")
    end
    calendar['workStartMinute'] = minutes(calendar['workStart'])
    calendar['workEndMinute'] = minutes(calendar['workEnd'])
    unless calendar['workStartMinute'] < calendar['workEndMinute']
      raise Error.new('CALENDAR_INVALID', "#{label} has Work Start at or after Work End (overnight hours are not supported)")
    end
  end

  # --- Plan: validate, resolve the calendar, size the exception window --------

  def self.plan(inputs, calendars_raw)
    req = request(inputs)
    calendar, warnings = resolve_calendar(submissions(calendars_raw), req['calendar'])
    time_zone = calendar['timeZone']
    hours = needs_hours?(req)
    validate_hours(calendar) if hours
    between = BETWEEN_OPERATIONS.include?(req['operation'])

    # A date-only value in a business-hours calculation means that day's opening.
    date, minute = parse_moment(req['dateRaw'], between ? 'Start Date' : 'Date', time_zone)
    req['date'] = fmt(date)
    req['minute'] = minute || calendar['workStartMinute'] if hours
    end_date = nil
    if between
      end_date, end_minute = parse_moment(req['endRaw'], 'End Date', time_zone)
      req['end'] = fmt(end_date)
      req['endMinute'] = end_minute || calendar['workStartMinute'] if hours
    end

    from, to = window(req, date, end_date, calendar)
    {
      'ok' => true,
      'request' => req,
      'calendar' => calendar,
      'warnings' => warnings,
      'window' => { 'from' => fmt(from), 'to' => fmt(to) },
      # BETWEEN includes the first value and excludes the second.
      'exceptionQuery' => "values[Calendar] = \"#{calendar['id']}\" AND " \
                          "values[Date] BETWEEN (\"#{fmt(from)}\",\"#{fmt(to + 1)}\")"
    }
  end

  # The date range of exceptions fetched once per calculation. A calculation
  # that walks outside it fails with WINDOW_EXCEEDED rather than guessing.
  def self.window(req, date, end_date, calendar)
    from = to = date
    working_days = calendar['workingDays'].size
    case req['operation']
    when 'next_business_day', 'next_business_opening'
      to = date + NEXT_PREVIOUS_DAYS
    when 'previous_business_day'
      from = date - NEXT_PREVIOUS_DAYS
    when 'business_days_between', 'business_hours_between'
      from, to = [date, end_date].minmax
    when 'add_duration'
      # Working days the calculation may need, spread over calendar weeks.
      days =
        case req['unit']
        when 'business_days' then req['amount'].abs
        when 'business_hours'
          (req['minutes'].to_f / (calendar['workEndMinute'] - calendar['workStartMinute'])).ceil
        end
      if days
        span = (days * 7.0 / working_days).ceil + NEXT_PREVIOUS_DAYS
        if backward?(req)
          from = date - span
        else
          to = date + span
        end
      else
        offset = req['unit'] == 'weeks' ? signed_amount(req) * 7 : signed_amount(req)
        from = to = date + offset
      end
    end
    [from - PAD_DAYS, to + PAD_DAYS]
  end

  # --- Calculate ---------------------------------------------------------------

  class Calculator
    def initialize(calendar, from, to, exception_submissions)
      @working = calendar['workingDays'].map { |name| DAY_NAMES.index(name) }
      @open = calendar['workStartMinute']
      @close = calendar['workEndMinute']
      @from = from
      @to = to
      @steps = 0
      @exceptions = {}
      exception_submissions.each do |submission|
        next unless BizCal.submitted?(submission)
        values = submission['values'] || {}
        next unless values['Calendar'].to_s == calendar['id']
        @exceptions[values['Date'].to_s] = { 'type' => values['Type'].to_s, 'name' => values['Name'].to_s }
      end
    end

    # [business day?, reason, exception name]
    def info(date)
      if date < @from || date > @to
        raise Error.new('WINDOW_EXCEEDED', 'The calculation ran past the exceptions fetched for it')
      end
      exception = @exceptions[BizCal.fmt(date)]
      case exception && exception['type']
      when 'Working Day Override' then return [true, 'override', exception['name']]
      when 'Holiday' then return [false, 'holiday', exception['name']]
      when 'Closure' then return [false, 'closure', exception['name']]
      end
      return [true, 'working_day', nil] if @working.include?(date.wday)
      [false, [0, 6].include?(date.wday) ? 'weekend' : 'non_working_day', nil]
    end

    def business_day?(date)
      info(date)[0]
    end

    def step!
      @steps += 1
      raise Error.new('ITERATION_LIMIT', "The calculation exceeded #{MAX_STEPS} days") if @steps > MAX_STEPS
    end

    # The first business day strictly after (1) or before (-1) the date.
    def walk(date, direction)
      loop do
        date += direction
        step!
        return date if business_day?(date)
      end
    end

    # The start date is never counted.
    def add_business_days(date, amount)
      direction = amount < 0 ? -1 : 1
      counted = 0
      while counted < amount.abs
        date += direction
        step!
        counted += 1 if business_day?(date)
      end
      date
    end

    def adjust(date, mode)
      return date if mode == 'none' || business_day?(date)
      walk(date, mode == 'next_business_day' ? 1 : -1)
    end

    # Business days after start, up to and including end; negative if end < start.
    def between(start, finish)
      return 0 if start == finish
      low, high, sign = start < finish ? [start, finish, 1] : [finish, start, -1]
      count = 0
      date = low
      while date < high
        date += 1
        step!
        count += 1 if business_day?(date)
      end
      sign * count
    end

    # --- Business hours (minutes of the day in the calendar's time zone) ---------

    # [open?, reason, exception name]. Opening time is open; closing time is not.
    def time_info(date, minute)
      business, reason, name = info(date)
      return [false, reason, name] unless business
      return [false, 'before_open', name] if minute < @open
      return [false, 'after_close', name] if minute >= @close
      [true, 'open', name]
    end

    # The moment itself if business is open then, otherwise the next opening.
    def roll_forward(date, minute)
      return [date, [minute, @open].max] if business_day?(date) && minute < @close
      [walk(date, 1), @open]
    end

    # Mirror image for counting backward: the moment itself if open, otherwise
    # the previous closing.
    def roll_backward(date, minute)
      return [date, [minute, @close].min] if business_day?(date) && minute > @open
      [walk(date, -1), @close]
    end

    # Adds (or subtracts) business minutes, day by day. Landing exactly on the
    # closing time returns closing time that day rather than the next opening.
    def add_business_minutes(date, minute, amount, backward)
      if backward
        date, minute = roll_backward(date, minute)
        loop do
          available = minute - @open
          return [date, minute - amount] if amount <= available
          amount -= available
          date = walk(date, -1)
          minute = @close
        end
      else
        date, minute = roll_forward(date, minute)
        loop do
          available = @close - minute
          return [date, minute + amount] if amount <= available
          amount -= available
          date = walk(date, 1)
          minute = @open
        end
      end
    end

    # Working minutes between two moments; negative if finish is before start.
    # Only the part of each business day inside working hours counts.
    def business_minutes_between(start, finish)
      return 0 if start == finish
      low, high, sign = (start <=> finish) < 0 ? [start, finish, 1] : [finish, start, -1]
      total = 0
      date = low[0]
      loop do
        if business_day?(date)
          from = date == low[0] ? low[1] : 0
          to = date == high[0] ? high[1] : 24 * 60
          span = [to, @close].min - [from, @open].max
          total += span if span > 0
        end
        break if date >= high[0]
        date += 1
        step!
      end
      sign * total
    end
  end

  def self.calculate(plan, exceptions_raw)
    req = plan['request']
    calendar = plan['calendar']
    window = plan['window']
    calc = Calculator.new(calendar, Date.parse(window['from']), Date.parse(window['to']), submissions(exceptions_raw))
    date = Date.parse(req['date'])
    minute = req['minute']
    result =
      case req['operation']
      when 'add_duration'
        if req['unit'] == 'business_hours'
          day, at = calc.add_business_minutes(date, minute, req['minutes'], backward?(req))
          moment_result(day, at, calendar).merge('isBusinessDay' => calc.business_day?(day))
        else
          date_result(calc, add_duration(calc, req, date), req, calendar)
        end
      when 'next_business_day' then date_result(calc, calc.walk(date, 1), req, calendar)
      when 'previous_business_day' then date_result(calc, calc.walk(date, -1), req, calendar)
      when 'is_business_day'
        business, reason, name = calc.info(date)
        { 'date' => fmt(date), 'isBusinessDay' => business, 'reason' => reason, 'exceptionName' => name }
      when 'business_days_between'
        { 'start' => req['date'], 'end' => req['end'], 'count' => calc.between(date, Date.parse(req['end'])) }
      when 'business_hours_between'
        finish = [Date.parse(req['end']), req['endMinute']]
        total = calc.business_minutes_between([date, minute], finish)
        {
          'start' => Tz.local_iso(date, minute, calendar['timeZone']),
          'end' => Tz.local_iso(finish[0], finish[1], calendar['timeZone']),
          'minutes' => total,
          'hours' => (total / 60.0).round(2)
        }
      when 'is_business_time'
        open, reason, name = calc.time_info(date, minute)
        moment_result(date, minute, calendar).merge('isBusinessTime' => open, 'reason' => reason, 'exceptionName' => name)
      when 'next_business_opening'
        already_open = calc.time_info(date, minute)[0]
        day, at = calc.roll_forward(date, minute)
        moment_result(day, at, calendar).merge('alreadyOpen' => already_open)
      end
    {
      'operation' => req['operation'],
      'calendar' => {
        'id' => calendar['id'],
        'name' => calendar['name'],
        'timeZone' => calendar['timeZone'],
        'fallback' => calendar['fallback']
      },
      'result' => result,
      'warnings' => plan['warnings']
    }
  end

  def self.add_duration(calc, req, date)
    amount = signed_amount(req)
    target =
      case req['unit']
      when 'business_days' then calc.add_business_days(date, amount)
      when 'calendar_days' then date + amount
      when 'weeks' then date + (amount * 7)
      end
    calc.adjust(target, req['adjust'])
  end

  # A local wall-clock moment as UTC and as local time with its offset.
  def self.moment_result(date, minute, calendar)
    {
      'date' => fmt(date),
      'datetime' => Tz.utc_at(date, minute, calendar['timeZone']),
      'datetimeLocal' => Tz.local_iso(date, minute, calendar['timeZone'])
    }
  end

  # Business-day results are stamped with the activation hour (or Time).
  def self.date_result(calc, date, req, calendar)
    minute = minutes(req['time'] || calendar['activationHour'])
    moment_result(date, minute, calendar).merge('isBusinessDay' => calc.business_day?(date))
  end

  # --- Node entry points (return JSON strings) ----------------------------------

  def self.error_result(error)
    code = error.is_a?(Error) ? error.code : 'INTERNAL_ERROR'
    message = error.is_a?(Error) ? error.message : "#{error.class}: #{error.message}"
    {
      'ok' => false,
      'httpStatus' => INPUT_ERRORS.include?(code) ? 400 : 500,
      'error' => { 'code' => code, 'message' => message }
    }
  end

  def self.run_plan(inputs, calendars_raw)
    JSON.generate(plan(inputs, calendars_raw), ascii_only: true)
  rescue Exception => e
    JSON.generate(error_result(e), ascii_only: true)
  end

  def self.run_calculate(plan, exceptions_raw)
    return JSON.generate(plan, ascii_only: true) unless plan['ok']
    JSON.generate(calculate(plan, exceptions_raw).merge('ok' => true, 'httpStatus' => 200), ascii_only: true)
  rescue Exception => e
    JSON.generate(error_result(e), ascii_only: true)
  end
end

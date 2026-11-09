# Business Calendar batch: many add_duration calculations in one routine run.
#
# build_trees.rb embeds this file, after business_calendar.rb, in the "Plan
# Batch" and "Calculate Batch" nodes of the "Business Calendar Add Duration
# Batch" routine. Every date is still worked out by BizCal.plan and
# BizCal.calculate, exactly as Business Calendar Calculate does for a single
# add_duration, so a batch result matches Business Calendar Add Duration for
# the same inputs. What the batch adds:
# - Each request names its calendar (or gives its ID). Blank means the
#   default calendar; an unknown calendar is an error for that request only.
# - One exception search covers every request in the batch.
# - A request can count from another request's result (dependsOn), such as a
#   warning date counted back from a due date.
#
# Same rules as business_calendar.rb: ASCII-only, no ERB closing tag, no
# heredocs, and keep it commented for people reading the routine nodes.
require 'date'
require 'json'

module BizCalBatch
  # Keeps one run well inside the 30-second WebAPI limit.
  MAX_REQUESTS = 1000
  # Business Calendar Calculate input => request field.
  FIELDS = { 'Amount' => 'amount', 'Unit' => 'unit', 'Direction' => 'direction', 'Adjust' => 'adjust', 'Time' => 'time' }.freeze
  # A dependency's result is a UTC moment. In the dependent request's own
  # time zone its date can be up to two days either side of the dependency's
  # local date, so the dependent's exception window allows for that.
  ZONE_SLACK_DAYS = 2

  def self.blank?(value)
    value.nil? || value.to_s.strip.empty?
  end

  # "CODE: message", the way Blueprint Calculate Dates reports a failed
  # Business Calendar Add Duration call.
  def self.error_text(error)
    details = BizCal.error_result(error)['error']
    "#{details['code']}: #{details['message']}"
  end

  # The Requests input: a JSON array (or {"requests": [...]}) of objects.
  def self.parse_requests(raw)
    text = raw.is_a?(String) ? raw.strip : raw
    begin
      requests = text.is_a?(String) ? (text.empty? ? [] : JSON.parse(text)) : text
    rescue JSON::ParserError
      raise BizCal::Error.new('INVALID_ARGUMENT', 'Requests must be a JSON array of date requests')
    end
    requests = requests['requests'] if requests.is_a?(Hash)
    unless requests.is_a?(Array) && requests.all? { |request| request.is_a?(Hash) }
      raise BizCal::Error.new('INVALID_ARGUMENT', 'Requests must be a JSON array of date requests')
    end
    if requests.size > MAX_REQUESTS
      raise BizCal::Error.new('LIMIT_EXCEEDED', "A batch can have at most #{MAX_REQUESTS} requests")
    end
    requests
  end

  # Calendar lookup: submission ID, or name in any letter case => ID.
  def self.calendar_index(calendar_submissions)
    index = {}
    calendar_submissions.select { |s| BizCal.submitted?(s) }.each do |submission|
      id = submission['id'].to_s
      name = (submission['values'] || {})['Name'].to_s.strip
      index[id] = id
      index["name:#{name.downcase}"] = id unless name.empty?
    end
    index
  end

  # '' for the default calendar, the calendar's ID, or nil when unknown.
  def self.resolve_calendar(index, requested)
    return '' if blank?(requested)
    text = requested.to_s.strip
    index[text] || index["name:#{text.downcase}"]
  end

  # The Business Calendar Calculate inputs for one request, counting from
  # from_date.
  def self.calculate_inputs(entry, from_date)
    inputs = { 'Operation' => 'add_duration', 'Calendar' => entry['calendar'], 'Date' => from_date.to_s }
    FIELDS.each { |input, field| inputs[input] = entry['fields'][field] }
    inputs
  end

  # --- Plan: check the requests, order them, size one exception search -------

  def self.plan(requests_raw, calendars_raw, calendars_error)
    requests = parse_requests(requests_raw)
    unless blank?(calendars_error)
      raise BizCal::Error.new('CALENDAR_SEARCH_FAILED', "Searching business calendars failed: #{calendars_error}")
    end
    calendar_submissions = BizCal.submissions(calendars_raw)
    index = calendar_index(calendar_submissions)

    ids = []      # request ids in the order given (each once)
    given = {}    # request id => true, for quick lookups
    entries = {}  # request id => request ready to calculate
    errors = {}   # request id => error text

    # 1. Read each request. Checks and messages follow Blueprint Calculate
    #    Dates, so the engine sees the same errors after the swap.
    requests.each do |request|
      id = request['id'].to_s
      next if id.strip.empty?   # nothing to key the result by
      if given[id]
        entries.delete(id)
        errors[id] = 'More than one request has this id'
        next
      end
      ids << id
      given[id] = true
      name = request['calendar'].to_s.strip
      calendar = resolve_calendar(index, name)
      from_date = request['fromDate'].to_s.strip
      depends_on = request['dependsOn'].to_s.strip
      if calendar.nil?
        errors[id] = "Unknown calendar \"#{name}\""
      elsif from_date.empty? && depends_on.empty?
        errors[id] = 'The request has no from date'
      else
        entries[id] = {
          'id' => id,
          'calendar' => calendar,
          'fromDate' => from_date,
          # A From Date of its own wins over dependsOn.
          'dependsOn' => from_date.empty? ? depends_on : '',
          'fields' => FIELDS.values.each_with_object({}) { |field, fields| fields[field] = request[field].nil? ? '' : request[field].to_s }
        }
      end
    end

    # 2. Order the requests so each one comes after the request it depends
    #    on, whatever order they were given in.
    order = []
    placed = {}
    pending = ids.select { |id| entries.key?(id) }
    loop do
      ready = pending.select do |id|
        depends_on = entries[id]['dependsOn']
        depends_on.empty? || placed[depends_on] || errors.key?(depends_on) || !given[depends_on]
      end
      break if ready.empty?
      ready.each { |id| placed[id] = true }
      order.concat(ready)
      pending -= ready
    end
    # Whatever is left can never start: its dependencies form a loop.
    pending.each do |id|
      errors[id] = "Depends on #{entries[id]['dependsOn']}, but the dependencies form a loop"
      entries.delete(id)
    end

    # 3. Work out each request's exception window with BizCal.plan, the same
    #    window a single Business Calendar Calculate run would fetch. A
    #    dependent request's From Date isn't known yet, so its window covers
    #    every date the dependency's result can fall on.
    windows = {}       # request id => [first date, last date]
    calendar_ids = []  # calendars the exception search must cover
    order.each do |id|
      entry = entries[id]
      depends_on = entry['dependsOn']
      if depends_on.empty?
        candidates = [entry['fromDate']]
      elsif !given[depends_on]
        errors[id] = "Depends on #{depends_on}, which was not requested"
        next
      elsif windows[depends_on].nil?
        errors[id] = "Depends on #{depends_on}, which failed"
        next
      else
        first, last = windows[depends_on]
        candidates = [BizCal.fmt(first - ZONE_SLACK_DAYS), BizCal.fmt(last + ZONE_SLACK_DAYS)]
      end
      begin
        plans = candidates.map { |date| BizCal.plan(calculate_inputs(entry, date), calendar_submissions) }
        windows[id] = [plans.map { |p| Date.parse(p['window']['from']) }.min,
                       plans.map { |p| Date.parse(p['window']['to']) }.max]
        calendar_ids << plans.first['calendar']['id']
      rescue Exception => e
        errors[id] = error_text(e)
      end
    end

    # 4. One search for every calendar and date the batch can touch, on the
    #    Calendar + Date index. BETWEEN includes the first value and excludes
    #    the second.
    planned = order.select { |id| windows.key?(id) }
    query = ''
    window = nil
    unless planned.empty?
      first = windows.values_at(*planned).map(&:first).min
      last = windows.values_at(*planned).map(&:last).max
      window = { 'from' => BizCal.fmt(first), 'to' => BizCal.fmt(last) }
      quoted = calendar_ids.uniq.sort.map { |calendar_id| "\"#{calendar_id}\"" }.join(',')
      query = "values[Calendar] IN (#{quoted}) AND " \
              "values[Date] BETWEEN (\"#{BizCal.fmt(first)}\",\"#{BizCal.fmt(last + 1)}\")"
    end

    {
      'ok' => true,
      'ids' => ids,
      'requests' => planned.map { |id| entries[id] },
      'errors' => errors,
      'window' => window,
      'exceptionQuery' => query
    }
  end

  # --- Calculate: every planned request, in dependency order -----------------

  def self.calculate(plan, calendars_raw, exceptions_raw, exceptions_error, next_page_token)
    calendar_submissions = BizCal.submissions(calendars_raw)
    exceptions = BizCal.submissions(exceptions_raw)
    results = {}
    plan['errors'].each { |id, text| results[id] = { 'error' => text } }

    # If the exception search failed or was cut short, no date can be trusted.
    problem =
      if !blank?(exceptions_error)
        "EXCEPTIONS_SEARCH_FAILED: Searching calendar exceptions failed: #{exceptions_error}"
      elsif !blank?(next_page_token)
        'EXCEPTIONS_TRUNCATED: The batch spans more calendar exceptions than one search returns; send fewer or closer dates'
      end

    plan['requests'].each do |entry|
      id = entry['id']
      if problem
        results[id] = { 'error' => problem }
        next
      end
      from_date = entry['fromDate']
      depends_on = entry['dependsOn']
      unless depends_on.empty?
        dependency = results[depends_on]
        if dependency.nil? || dependency['error']
          results[id] = { 'error' => "Depends on #{depends_on}, which failed" }
          next
        end
        # Count from the dependency's result, as Blueprint Calculate Dates
        # passes it to Business Calendar Add Duration.
        from_date = dependency['datetime']
      end
      results[id] = calculate_one(entry, from_date, calendar_submissions, exceptions, plan['window'])
    end

    # Keyed in the order the requests were given.
    dates = {}
    plan['ids'].each { |id| dates[id] = results[id] if results.key?(id) }
    { 'ok' => true, 'dates' => dates, 'errorCount' => dates.values.count { |result| result['error'] } }
  end

  # One add_duration, exactly as Business Calendar Calculate runs it, but with
  # the batch's exceptions instead of a search of its own.
  def self.calculate_one(entry, from_date, calendar_submissions, exceptions, fetched)
    plan = BizCal.plan(calculate_inputs(entry, from_date), calendar_submissions)
    # The batch window was sized to cover this; check rather than assume.
    unless plan['window']['from'] >= fetched['from'] && plan['window']['to'] <= fetched['to']
      raise BizCal::Error.new('WINDOW_EXCEEDED', 'The calculation needs exceptions outside those fetched for the batch')
    end
    result = BizCal.calculate(plan, exceptions)['result']
    { 'date' => result['date'], 'datetime' => result['datetime'] }
  rescue Exception => e
    { 'error' => error_text(e) }
  end

  # --- Node entry points (return JSON strings) --------------------------------

  def self.batch_error(error)
    { 'ok' => false, 'error' => BizCal.error_result(error)['error'] }
  end

  def self.run_plan(requests_raw, calendars_raw, calendars_error)
    JSON.generate(plan(requests_raw, calendars_raw, calendars_error), ascii_only: true)
  rescue Exception => e
    JSON.generate(batch_error(e), ascii_only: true)
  end

  def self.run_calculate(plan, calendars_raw, exceptions_raw, exceptions_error, next_page_token)
    return JSON.generate(plan, ascii_only: true) unless plan['ok']
    JSON.generate(calculate(plan, calendars_raw, exceptions_raw, exceptions_error, next_page_token), ascii_only: true)
  rescue Exception => e
    JSON.generate(batch_error(e), ascii_only: true)
  end
end

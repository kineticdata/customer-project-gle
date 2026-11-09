# Runs cases.json against business_calendar.rb on a workstation (MRI Ruby).
# java.time isn't available here, so the time zone methods are replaced with
# TZ-environment equivalents. The fixture mirrors the dev space records.
#
#   ruby template/tooling/business-calendar/test_local.rb
require 'time'
require 'uri'
require_relative 'business_calendar'
require_relative 'request_params'

module BizCal
  module Tz
    def self.zone(id)
      return id if id.to_s =~ %r{\A[A-Za-z_]+(/[A-Za-z_+-]+)*\z} && File.file?("/usr/share/zoneinfo/#{id}")
      raise Error.new('CALENDAR_INVALID', "Time zone '#{id}' is not a valid IANA time zone")
    end

    def self.with_zone(id)
      previous = ENV['TZ']
      ENV['TZ'] = zone(id)
      yield
    ensure
      ENV['TZ'] = previous
    end

    def self.local_moment(iso, id)
      raise ArgumentError, 'offset required' unless iso =~ /(Z|[+-]\d{2}:?\d{2})\z/
      instant = Time.iso8601(iso)
      with_zone(id) do
        local = instant.getlocal
        [Date.new(local.year, local.month, local.day), local.hour * 60 + local.min]
      end
    end

    def self.utc_at(date, minute, id)
      with_zone(id) { Time.local(date.year, date.month, date.day, minute / 60, minute % 60).utc.iso8601 }
    end

    def self.local_iso(date, minute, id)
      with_zone(id) { Time.local(date.year, date.month, date.day, minute / 60, minute % 60).strftime('%Y-%m-%dT%H:%M:%S%:z') }
    end
  end
end

TEST_ID = '782d582b-cbe6-11f1-8bfb-29a4dfc8f9a2'
WEEKDAYS = %w[Monday Tuesday Wednesday Thursday Friday].freeze

def calendar(id, name, default)
  { 'id' => id, 'coreState' => 'Submitted',
    'values' => { 'Name' => name, 'Time Zone' => 'America/Chicago', 'Working Days' => WEEKDAYS,
                  'Default Activation Hour' => '08:00', 'Work Start' => '08:00', 'Work End' => '17:00',
                  'Is Default' => default } }
end

def exception(date, name, type)
  { 'coreState' => 'Submitted', 'values' => { 'Calendar' => TEST_ID, 'Date' => date, 'Name' => name, 'Type' => type } }
end

CALENDARS = [
  calendar('77e4b663-cbe6-11f1-8bfb-3d9097e7ee9a', 'GLE US', 'Yes'),
  calendar(TEST_ID, 'ZZ Test US', 'No')
].freeze

EXCEPTIONS = [
  exception('2026-11-26', 'Thanksgiving', 'Holiday'),
  exception('2026-11-27', 'Day after Thanksgiving', 'Closure'),
  exception('2026-12-19', 'Year-end Saturday', 'Working Day Override'),
  exception('2026-12-25', 'Christmas Day', 'Holiday'),
  exception('2027-01-01', "New Year's Day", 'Holiday')
].freeze

# Stands in for the indexed exception search the routine runs.
def search_exceptions(plan)
  from = plan['window']['from']
  to = plan['window']['to']
  EXCEPTIONS.select do |e|
    e['values']['Calendar'] == plan['calendar']['id'] && e['values']['Date'] >= from && e['values']['Date'] <= to
  end
end

def run(params, calendars = CALENDARS)
  query = URI.encode_www_form(params.map { |k, v| [k, v == 'TEST' ? TEST_ID : v] })
  inputs = BizCalParams.from_query(query)
  plan = JSON.parse(BizCal.run_plan(inputs, JSON.generate(calendars)))
  exceptions = plan['ok'] ? JSON.generate(search_exceptions(plan)) : nil
  JSON.parse(BizCal.run_calculate(plan, exceptions))
end

def actual(response, key)
  result = response['result'] || {}
  case key
  when 'status' then response['httpStatus']
  when 'error' then response.dig('error', 'code')
  when 'calendarName' then response.dig('calendar', 'name')
  when 'fallback' then response.dig('calendar', 'fallback')
  when 'warning' then (response['warnings'] || []).map { |w| w['code'] }.first
  else result[key]
  end
end

cases = JSON.parse(File.read(File.join(__dir__, 'cases.json')))['cases']
failures = 0
cases.each do |c|
  response = run(c['params'])
  expect = { 'status' => 200 }.merge(c['expect'])
  misses = expect.reject { |key, value| actual(response, key) == value }
  if misses.empty?
    puts "PASS #{c['id']}"
  else
    failures += 1
    got = misses.keys.map { |key| "#{key}=#{actual(response, key).inspect} (expected #{expect[key].inspect})" }
    puts "FAIL #{c['id']}: #{got.join('; ')}  #{response['error'] && response['error']['message']}"
  end
end
puts "#{cases.size - failures}/#{cases.size} passed"

# Calendar-configuration checks that need a different fixture than the space has.
def with_hours(start, finish)
  CALENDARS.map do |c|
    values = c['values'].merge('Work Start' => start, 'Work End' => finish)
    c['id'] == TEST_ID ? c.merge('values' => values) : c
  end
end
hours_params = { 'op' => 'add_duration', 'calendar' => 'TEST', 'from' => '2026-11-23T09:00:00-06:00',
                 'amount' => '1', 'unit' => 'business_hours' }
day_params = { 'op' => 'is_business_day', 'calendar' => 'TEST', 'date' => '2026-11-24' }
config_checks = [
  ['no hours: business-hours call fails', run(hours_params, with_hours('', '')), 'CALENDAR_INVALID'],
  ['no hours: business-day call still works', run(day_params, with_hours('', '')), nil],
  ['overnight hours rejected', run(hours_params, with_hours('22:00', '06:00')), 'CALENDAR_INVALID']
]
config_checks.each do |label, response, code|
  ok = response.dig('error', 'code') == code
  failures += 1 unless ok
  puts "#{ok ? 'PASS' : 'FAIL'} config: #{label} (got #{response.dig('error', 'code').inspect})"
end
exit(failures.zero? ? 0 : 1)

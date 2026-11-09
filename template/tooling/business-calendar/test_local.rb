# Runs cases.json against business_calendar.rb on a workstation (MRI Ruby).
# The time zone stubs and the fixture that mirrors the dev space records are in
# local_fixture.rb.
#
#   ruby template/tooling/business-calendar/test_local.rb
require 'uri'
require_relative 'local_fixture'
require_relative 'request_params'

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

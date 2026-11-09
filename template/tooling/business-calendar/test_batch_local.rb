# Runs batch_cases.json through batch.rb on a workstation (MRI Ruby) and
# checks every result against the expected value and against the same
# calculation done one request at a time, as Business Calendar Add Duration
# does it.
#
#   ruby template/tooling/business-calendar/test_batch_local.rb
require_relative 'local_fixture'
require_relative 'batch'
require_relative 'batch_compare'

# Stands in for the batch's exception search: every calendar in the IN list,
# from the first date up to (not including) the second.
def search_batch_exceptions(query)
  calendars = query[/IN \(([^)]*)\)/, 1].scan(/"([^"]+)"/).flatten
  from, to = query[/BETWEEN \(([^)]*)\)/, 1].scan(/"([^"]+)"/).flatten
  EXCEPTIONS.select do |e|
    calendars.include?(e['values']['Calendar']) && e['values']['Date'] >= from && e['values']['Date'] < to
  end
end

# One add_duration through the Business Calendar Calculate entry points, as
# Business Calendar Add Duration runs it.
def single(inputs)
  core_inputs = { 'Operation' => 'add_duration', 'Calendar' => inputs['Calendar'], 'Date' => inputs['From Date'] }
  %w[Amount Unit Direction Adjust Time].each { |name| core_inputs[name] = inputs[name] }
  plan = JSON.parse(BizCal.run_plan(core_inputs, JSON.generate(CALENDARS)))
  exceptions = plan['ok'] ? JSON.generate(search_exceptions(plan)) : nil
  calculation = JSON.parse(BizCal.run_calculate(plan, exceptions))
  outputs = { 'Result Date' => calculation.dig('result', 'date'), 'Result Datetime' => calculation.dig('result', 'datetime'),
              'Error Code' => calculation.dig('error', 'code'), 'Error Message' => calculation.dig('error', 'message') }
  BatchCompare.single_result(outputs)
end

requests = JSON.generate(BatchCompare::CASES['requests'])
plan = JSON.parse(BizCalBatch.run_plan(requests, JSON.generate(CALENDARS), ''))
abort "plan failed: #{plan['error'].inspect}" unless plan['ok']
puts "exception query: #{plan['exceptionQuery']}"
exceptions = JSON.generate(search_batch_exceptions(plan['exceptionQuery']))
calculation = JSON.parse(BizCalBatch.run_calculate(plan, JSON.generate(CALENDARS), exceptions, '', ''))
abort "calculate failed: #{calculation['error'].inspect}" unless calculation['ok']
dates = calculation['dates']

singles = BatchCompare.single_inputs(dates, CALENDARS).transform_values { |inputs| single(inputs) }
failures = BatchCompare.check(dates, singles)
puts "errorCount #{calculation['errorCount']}"

# Batch-level checks.
batch_checks = [
  ['not JSON', BizCalBatch.run_plan('{oops', JSON.generate(CALENDARS), ''), 'INVALID_ARGUMENT'],
  ['not an array', BizCalBatch.run_plan('{"id": 1}', JSON.generate(CALENDARS), ''), 'INVALID_ARGUMENT'],
  ['too many', BizCalBatch.run_plan(JSON.generate(Array.new(BizCalBatch::MAX_REQUESTS + 1) { |i| { 'id' => i.to_s } }), JSON.generate(CALENDARS), ''), 'LIMIT_EXCEEDED'],
  ['calendar search failed', BizCalBatch.run_plan('[]', '[]', 'boom'), 'CALENDAR_SEARCH_FAILED'],
  ['empty batch', BizCalBatch.run_plan('[]', JSON.generate(CALENDARS), ''), nil]
]
batch_checks.each do |label, output, code|
  got = JSON.parse(output).dig('error', 'code')
  ok = got == code
  failures += 1 unless ok
  puts "#{ok ? 'PASS' : 'FAIL'} batch: #{label} (got #{got.inspect})"
end
truncated = JSON.parse(BizCalBatch.run_calculate(plan, JSON.generate(CALENDARS), exceptions, '', 'token'))
ok = truncated['dates']['due'] && truncated['dates']['due']['error'].to_s.start_with?('EXCEPTIONS_TRUNCATED')
failures += 1 unless ok
puts "#{ok ? 'PASS' : 'FAIL'} batch: truncated exception search fails every planned request"

# Speed: a Blueprint-sized batch with dependents.
big = (1..500).flat_map do |i|
  [{ 'id' => "due-#{i}", 'calendar' => i.even? ? 'ZZ Test US' : '', 'fromDate' => (Date.new(2026, 11, 1) + i).to_s,
     'amount' => i % 40, 'unit' => 'business_days' },
   { 'id' => "warn-#{i}", 'calendar' => 'ZZ Test US', 'dependsOn' => "due-#{i}", 'amount' => 2, 'unit' => 'business_days',
     'direction' => 'before' }]
end.first(1000)
started = Time.now
big_plan = JSON.parse(BizCalBatch.run_plan(JSON.generate(big), JSON.generate(CALENDARS), ''))
big_result = JSON.parse(BizCalBatch.run_calculate(big_plan, JSON.generate(CALENDARS), JSON.generate(search_batch_exceptions(big_plan['exceptionQuery'])), '', ''))
puts "1000 requests in #{(Time.now - started).round(2)}s, #{big_result['errorCount']} errors"
exit(failures.zero? ? 0 : 1)

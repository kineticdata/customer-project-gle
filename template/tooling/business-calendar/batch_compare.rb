# Shared by test_batch_local.rb and compare_batch.rb: works out which requests
# in batch_cases.json Business Calendar Add Duration can also run, with which
# inputs, and checks a batch's Dates against those single runs and against the
# expected results.
require 'json'

module BatchCompare
  CASES = JSON.parse(File.read(File.join(__dir__, 'batch_cases.json')))

  # Calendar name (any case) or ID => ID, from calendar submissions.
  def self.calendar_ids(calendar_submissions)
    calendar_submissions.each_with_object({}) do |submission, ids|
      ids[submission['id']] = submission['id']
      ids[submission['values']['Name'].downcase] = submission['id']
    end
  end

  # request id => Add Duration inputs, for every request Add Duration can also
  # run. A dependent request counts from its dependency's batch result, as
  # Blueprint Calculate Dates passes it on.
  def self.single_inputs(dates, calendar_submissions)
    ids = calendar_ids(calendar_submissions)
    counts = CASES['requests'].group_by { |request| request['id'] }.transform_values(&:size)
    CASES['requests'].each_with_object({}) do |request, inputs|
      next if counts[request['id']] > 1
      name = request['calendar'].to_s.strip
      calendar = name.empty? ? '' : (ids[name] || ids[name.downcase])
      next if calendar.nil?
      from_date = request['fromDate'].to_s
      if from_date.empty?
        dependency = dates[request['dependsOn'].to_s]
        next if dependency.nil? || dependency['datetime'].nil?
        from_date = dependency['datetime']
      end
      inputs[request['id']] = {
        'Calendar' => calendar, 'From Date' => from_date, 'Amount' => request['amount'].to_s,
        'Unit' => request['unit'].to_s, 'Direction' => request['direction'].to_s,
        'Adjust' => request['adjust'].to_s, 'Time' => request['time'].to_s
      }
    end
  end

  # Add Duration outputs in the batch's shape.
  def self.single_result(outputs)
    if outputs['Error Code'].to_s.empty?
      { 'date' => outputs['Result Date'], 'datetime' => outputs['Result Datetime'] }
    else
      { 'error' => "#{outputs['Error Code']}: #{outputs['Error Message']}" }
    end
  end

  # Prints one line per request; returns the number of failures.
  def self.check(dates, singles)
    failures = 0
    expected = CASES['expect']
    (expected.keys | dates.keys).each do |id|
      problems = []
      problems << "batch #{dates[id].inspect} != expected #{expected[id].inspect}" unless dates[id] == expected[id]
      if singles.key?(id)
        single = singles[id]
        problems << "batch #{dates[id].inspect} != Add Duration #{single.inspect}" unless dates[id] == single
      end
      failures += 1 unless problems.empty?
      label = singles.key?(id) ? 'matches Add Duration' : 'batch only'
      puts problems.empty? ? "PASS #{id} (#{label})" : "FAIL #{id}: #{problems.join('; ')}"
    end
    puts "#{expected.size - failures}/#{expected.size} passed, #{singles.size} compared with Add Duration"
    failures
  end
end

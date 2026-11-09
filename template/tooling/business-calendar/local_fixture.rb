# Local stand-ins for the Task engine and the dev space records, shared by
# test_local.rb and test_batch_local.rb. java.time isn't available in MRI, so
# the time zone methods are replaced with TZ-environment equivalents.
require 'time'
require_relative 'business_calendar'

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

def calendar(id, name, default, time_zone)
  { 'id' => id, 'coreState' => 'Submitted',
    'values' => { 'Name' => name, 'Time Zone' => time_zone, 'Working Days' => WEEKDAYS,
                  'Default Activation Hour' => '08:00', 'Work Start' => '08:00', 'Work End' => '17:00',
                  'Is Default' => default } }
end

def exception(date, name, type)
  { 'coreState' => 'Submitted', 'values' => { 'Calendar' => TEST_ID, 'Date' => date, 'Name' => name, 'Type' => type } }
end

CALENDARS = [
  calendar('77e4b663-cbe6-11f1-8bfb-3d9097e7ee9a', 'GLE US', 'Yes', 'America/New_York'),
  calendar(TEST_ID, 'ZZ Test US', 'No', 'America/Chicago')
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

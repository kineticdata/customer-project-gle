# Generates the Business Calendar routines and WebAPI as Task API payloads,
# embedding business_calendar.rb and request_params.rb in their Ruby nodes.
#
#   ruby build_trees.rb <search-submissions-operation-id> [output-dir] [--export <template/export dir>]
#
# Writes one JSON file per tree:
#   routine-*.json      body for POST /trees (Task API)
#   webapi-*.json       body for POST /kapps/service-portal/webApiImport (Core API)
# With --export, also writes the trees as the Task engine exports them
# (task/routines/*.xml and task/sources/kinetic-request-ce/trees/*.xml), so the
# template can be updated without a full space export.
require 'json'
require 'digest'
require 'fileutils'

args = ARGV.dup
export_index = args.index('--export')
EXPORT_DIR = export_index ? args.slice!(export_index, 2)[1] : nil
SEARCH_OPERATION = args[0] or abort 'usage: ruby build_trees.rb <search-submissions-operation-id> [output-dir] [--export <dir>]'
OUT_DIR = args[1] || File.join(__dir__, 'build')
CONNECTION = '1415539c-bb98-48bb-ad33-11be25189ad0' # Kinetic Platform
KAPP = 'service-portal'
CORE_ID = 'routine_business_calendar_calculate_v1'
CORE_NAME = 'Business Calendar Calculate'

# Embeds a source file in a node verbatim (comments and indentation kept, so
# the node reads like the file), wrapped in a module named after the source's
# content hash so a rebuilt routine never collides with a version the engine
# has already loaded.
def embed(file, module_name)
  source = File.read(File.join(__dir__, file))
  abort "#{file} must be ASCII-only" unless source.ascii_only?
  abort "#{file} must not contain the ERB closing tag" if source.include?('%' + '>')
  versioned = "#{module_name}_#{Digest::SHA256.hexdigest(source)[0, 10]}"
  body = source.gsub(module_name, versioned).lines.map { |line| line.strip.empty? ? "\n" : "  #{line}" }.join
  code = <<~RUBY
    # ---------------------------------------------------------------------------
    # Generated from template/tooling/business-calendar/#{file} by build_trees.rb.
    # Edit that file and rebuild rather than editing this node by hand.
    #
    # The module name ends in a hash of the source so a new version never clashes
    # with an older one still loaded in the engine. It is defined once per engine
    # (defined? is a plain lookup because the engine may evaluate this ERB inside
    # a class).
    # ---------------------------------------------------------------------------
    unless defined?(#{versioned})
    #{body.chomp}
    end
  RUBY
  [versioned, code]
end

LIB, LIB_CODE = embed('business_calendar.rb', 'BizCal')
PARAMS, PARAMS_CODE = embed('request_params.rb', 'BizCalParams')

class TreeBuilder
  attr_reader :nodes, :connectors

  def initialize
    @last = 0
    @nodes = [node('start', 'system_start_v1', 'Start', [], 10, 10, visible: false)]
    @connectors = []
  end

  def add(definition_id, name, params, x, y, defers: false)
    @last += 1
    id = "#{definition_id}_#{@last}"
    @nodes << node(id, definition_id, name, params, x, y, defers: defers)
    id
  end

  def connect(from, to, label, value = '')
    @connectors << { 'from' => from, 'to' => to, 'type' => 'Complete', 'label' => label, 'value' => value }
  end

  def tree_json(name, notes, task_definition = nil)
    json = { 'builderVersion' => '', 'schemaVersion' => '1.0', 'version' => '', 'processOwnerEmail' => '',
             'lastId' => @last, 'name' => name, 'notes' => notes, 'connectors' => @connectors, 'nodes' => @nodes }
    json['taskDefinition'] = task_definition if task_definition
    json
  end

  private

  def node(id, definition_id, name, params, x, y, visible: true, defers: false)
    unlabeled = params.select { |p| p['label'].to_s.strip.empty? }.map { |p| p['id'] }
    abort "#{name} (#{definition_id}) has parameters without labels: #{unlabeled.join(', ')}" unless unlabeled.empty?
    { 'configured' => true, 'defers' => defers, 'deferrable' => defers, 'visible' => visible, 'name' => name,
      'messages' => [], 'id' => id, 'position' => { 'x' => x, 'y' => y }, 'version' => 1,
      'parameters' => params, 'definitionId' => definition_id }
  end
end

# Every node parameter carries the metadata the workflow builder displays. The
# engine accepts {id, value} alone, but then the builder shows unlabeled inputs
# (and the export shows required="null"), so TreeBuilder rejects a blank label.
def param(id, value, label, required: false, description: '', menu: '')
  { 'dependsOnId' => '', 'dependsOnValue' => '', 'description' => description, 'id' => id,
    'label' => label, 'menu' => menu, 'value' => value, 'required' => required }
end

def echo_params(code)
  [param('input', code, 'Input', required: true)]
end

# Matches the Console's system_integration_v1 nodes; operation inputs are
# labeled with their own names.
def search_params(form, query, order_by)
  inputs = { 'Kapp Slug' => KAPP, 'Form Slug' => form, 'Query' => query, 'Order By' => order_by,
             'Limit' => '1000', 'Page Token' => '' }
  [param('connection', CONNECTION, 'Connection ID', required: true, description: 'Connection ID'),
   param('operation', SEARCH_OPERATION, 'Operation ID', required: true, description: 'Operation ID'),
   *inputs.map { |name, value| param("parameters.#{name}", value, name) }]
end

def routine_body(name, definition_id, builder, notes, inputs, outputs)
  task_definition = {
    'id' => definition_id, 'name' => name, 'version' => 1, 'schemaVersion' => '1.0', 'visible' => false,
    'deferrable' => true, 'handler' => { 'name' => 'system_tree_call', 'version' => 1 },
    'inputs' => inputs.map { |n, required, description| { 'name' => n, 'required' => required, 'description' => description, 'value' => '' } },
    'outputs' => outputs.map { |n, description| { 'name' => n, 'description' => description } }
  }
  # The engine ignores taskDefinition inputs/outputs on create; it reads the
  # top-level ones.
  { 'sourceName' => '-', 'sourceGroup' => '-', 'name' => name, 'type' => 'Global Routine', 'status' => 'Active',
    'definitionId' => definition_id,
    'inputs' => task_definition['inputs'].map { |i| i.reject { |k, _| k == 'value' }.merge('defaultValue' => '') },
    'outputs' => task_definition['outputs'],
    'treeJson' => builder.tree_json(name, notes, task_definition) }
end

CORE_INPUTS = [
  ['Operation', true, 'add_duration, is_business_day, next_business_day, previous_business_day, business_days_between, business_hours_between, is_business_time or next_business_opening'],
  ['Calendar', false, 'Business calendar submission ID. Blank uses the default calendar; an unknown ID uses the default with a warning.'],
  ['Date', false, 'YYYY-MM-DD, or an ISO 8601 datetime with an offset (converted to the calendar time zone). The from date, start or moment. In business-hours operations a date alone means that day\'s opening.'],
  ['End Date', false, 'business_days_between / business_hours_between only: YYYY-MM-DD or ISO 8601 datetime.'],
  ['Amount', false, 'add_duration only: negative reverses the direction. Whole numbers, except business_hours, which allows decimals (1.5 = 90 minutes).'],
  ['Unit', false, 'add_duration only: business_days, calendar_days, weeks or business_hours.'],
  ['Direction', false, 'add_duration only: after (default) or before.'],
  ['Adjust', false, 'add_duration only: none (default), previous_business_day or next_business_day. Ignored for business_hours.'],
  ['Time', false, 'Optional HH:MM overriding the calendar Default Activation Hour on business-day results.']
].freeze

# Output name => [description, Ruby expression over `calculation`, the parsed
# JSON from the Calculate node].
CORE_OUTPUTS = {
  'Result Date' => ['YYYY-MM-DD result in the calendar time zone (add_duration, next/previous_business_day, next_business_opening).', "calculation.dig('result', 'date').to_s"],
  'Result Datetime' => ['The result as ISO 8601 UTC. Business-day results are stamped at the activation hour.', "calculation.dig('result', 'datetime').to_s"],
  'Result Datetime Local' => ['The same moment in the calendar time zone with its offset, e.g. 2026-11-23T13:00:00-06:00.', "calculation.dig('result', 'datetimeLocal').to_s"],
  'Is Business Day' => ['true or false.', "calculation.dig('result', 'isBusinessDay').to_s"],
  'Is Business Time' => ['is_business_time only: true when the moment is inside working hours on a business day.', "calculation.dig('result', 'isBusinessTime').to_s"],
  'Reason' => ['is_business_day / is_business_time: working_day, open, before_open, after_close, weekend, non_working_day, holiday, closure or override.', "calculation.dig('result', 'reason').to_s"],
  'Already Open' => ['next_business_opening only: true when the given moment was already inside working hours.', "calculation.dig('result', 'alreadyOpen').to_s"],
  'Count' => ['business_days_between only: business days after Start Date up to and including End Date.', "calculation.dig('result', 'count').to_s"],
  'Minutes' => ['business_hours_between only: working minutes between the two moments (negative if End is before Start).', "calculation.dig('result', 'minutes').to_s"],
  'Hours' => ['business_hours_between only: the same as decimal hours, rounded to 2 places.', "calculation.dig('result', 'hours').to_s"],
  'Calendar' => ['ID of the calendar used.', "calculation.dig('calendar', 'id').to_s"],
  'Calendar Name' => ['Name of the calendar used.', "calculation.dig('calendar', 'name').to_s"],
  'Calendar Fallback' => ['true when the requested calendar was not found and the default was used.', "calculation.dig('calendar', 'fallback').to_s"],
  'Warnings' => ['JSON array of {code, message}.', "JSON.generate(calculation['warnings'] || [])"],
  'Error Code' => ['Blank on success.', "calculation.dig('error', 'code').to_s"],
  'Error Message' => ['Blank on success.', "calculation.dig('error', 'message').to_s"],
  'HTTP Status' => ['200, 400 (bad input) or 500 (configuration or engine problem).', "calculation['httpStatus'].to_s"],
  'Result JSON' => ['The full result as JSON.',
                    "# Drop the internal ok/httpStatus flags; callers get operation, calendar,\n" \
                    "# result and warnings (or error).\n" \
                    "JSON.generate(calculation.reject { |key, _| %w[ok httpStatus].include?(key) }, ascii_only: true)"]
}.freeze

def core_routine
  b = TreeBuilder.new
  calendars = b.add('system_integration_v1', 'Get Calendars', search_params('business-calendar', '', ''), 220, 10)
  plan = b.add('utilities_echo_v1', 'Plan', echo_params(<<~ERB.chomp), 430, 10)
    <%=
    #{LIB_CODE}
    # Validate the routine inputs, choose the calendar (falling back to the
    # default) and work out the date window of exceptions the calculation needs.
    # Returns JSON for the next nodes; on bad input it carries the error instead.
    #{LIB}.run_plan(@inputs, @results['Get Calendars']['Submissions'])
    %>
  ERB
  query = <<~ERB.chomp
    <%=
      # KQL from the Plan node: this calendar's exceptions within the date window
      # the calculation can touch (indexed on Calendar + Date).
      JSON.parse(@results['Plan']['output'])['exceptionQuery']
    %>
  ERB
  exceptions = b.add('system_integration_v1', 'Get Exceptions',
                     search_params('business-calendar-exception', query, 'values[Date]'), 640, 10)
  calculate = b.add('utilities_echo_v1', 'Calculate', echo_params(<<~ERB.chomp), 850, 10)
    <%=
    #{LIB_CODE}
    # Run the calculation with the plan and the exceptions fetched for its window.
    # If the plan failed (bad input or a calendar problem), Get Exceptions never
    # ran, so the plan's error is passed straight through.
    plan = JSON.parse(@results['Plan']['output'])
    exceptions = plan['ok'] ? @results['Get Exceptions']['Submissions'] : nil
    #{LIB}.run_calculate(plan, exceptions)
    %>
  ERB
  # Return parameters are labeled with the routine output they set, and each
  # value says in a comment what it returns.
  outputs = CORE_OUTPUTS.map do |name, (description, expression)|
    value = "<%=\n  # #{name}: #{description}\n" \
            "  calculation = JSON.parse(@results['Calculate']['output'])\n" \
            "#{expression.lines.map { |line| "  #{line}" }.join}\n%>"
    param(name, value, name, description: description)
  end
  ret = b.add('system_tree_return_v1', 'Return', outputs, 1060, 10)
  plan_ok = "JSON.parse(@results['Plan']['output'])['ok'] == true"
  b.connect('start', calendars, 'get calendars')
  b.connect(calendars, plan, 'then plan')
  b.connect(plan, exceptions, 'Plan OK?', plan_ok)
  b.connect(plan, calculate, 'Plan failed?', "!(#{plan_ok})")
  b.connect(exceptions, calculate, 'then calculate')
  b.connect(calculate, ret, 'then return')
  routine_body(CORE_NAME, CORE_ID, b,
               "Canonical Business Calendar implementation. Generated by template/tooling/business-calendar/build_trees.rb from business_calendar.rb; do not edit nodes by hand.",
               CORE_INPUTS, CORE_OUTPUTS.map { |name, (description, _)| [name, description] })
end

COMMON_OUTPUTS = ['Calendar', 'Calendar Name', 'Calendar Fallback', 'Warnings', 'Error Code', 'Error Message', 'Result JSON'].freeze

CALENDAR_INPUT = ['Calendar', false, 'Calendar ID; blank uses the default.'].freeze
DATE_OR_TIME = 'YYYY-MM-DD or ISO 8601 datetime with an offset.'

WRAPPERS = [
  { name: 'Business Calendar Add Duration', id: 'routine_business_calendar_add_duration_v1', operation: 'add_duration',
    inputs: [CALENDAR_INPUT,
             ['From Date', true, DATE_OR_TIME + ' For business_hours a date alone means that day\'s opening.', 'Date'],
             ['Amount', true, 'Negative reverses the direction. Whole numbers, except business_hours (1.5 = 90 minutes).'],
             ['Unit', true, 'business_days, calendar_days, weeks or business_hours.'],
             ['Direction', false, 'after (default) or before.'],
             ['Adjust', false, 'none (default), previous_business_day or next_business_day. Ignored for business_hours.'],
             ['Time', false, 'Optional HH:MM for business-day results.']],
    outputs: ['Result Date', 'Result Datetime', 'Result Datetime Local', 'Is Business Day'] },
  { name: 'Business Calendar Is Business Day', id: 'routine_business_calendar_is_business_day_v1', operation: 'is_business_day',
    inputs: [CALENDAR_INPUT, ['Date', true, DATE_OR_TIME]],
    outputs: ['Is Business Day', 'Reason'] },
  { name: 'Business Calendar Next Business Day', id: 'routine_business_calendar_next_business_day_v1', operation: 'next_business_day',
    inputs: [CALENDAR_INPUT, ['Date', true, DATE_OR_TIME], ['Time', false, 'Optional HH:MM for Result Datetime.']],
    outputs: ['Result Date', 'Result Datetime', 'Result Datetime Local'] },
  { name: 'Business Calendar Previous Business Day', id: 'routine_business_calendar_previous_business_day_v1', operation: 'previous_business_day',
    inputs: [CALENDAR_INPUT, ['Date', true, DATE_OR_TIME], ['Time', false, 'Optional HH:MM for Result Datetime.']],
    outputs: ['Result Date', 'Result Datetime', 'Result Datetime Local'] },
  { name: 'Business Calendar Business Days Between', id: 'routine_business_calendar_business_days_between_v1', operation: 'business_days_between',
    inputs: [CALENDAR_INPUT, ['Start Date', true, DATE_OR_TIME, 'Date'], ['End Date', true, DATE_OR_TIME]],
    outputs: ['Count'] },
  { name: 'Business Calendar Business Hours Between', id: 'routine_business_calendar_business_hours_between_v1', operation: 'business_hours_between',
    inputs: [CALENDAR_INPUT,
             ['Start', true, DATE_OR_TIME + ' A date alone means that day\'s opening.', 'Date'],
             ['End', true, DATE_OR_TIME + ' A date alone means that day\'s opening.', 'End Date']],
    outputs: ['Minutes', 'Hours'] },
  { name: 'Business Calendar Is Within Business Hours', id: 'routine_business_calendar_is_within_business_hours_v1', operation: 'is_business_time',
    inputs: [CALENDAR_INPUT, ['At', true, DATE_OR_TIME + ' A date alone is checked at that day\'s opening.', 'Date']],
    outputs: ['Is Business Time', 'Reason', 'Result Datetime Local'] },
  { name: 'Business Calendar Next Business Opening', id: 'routine_business_calendar_next_business_opening_v1', operation: 'next_business_opening',
    inputs: [CALENDAR_INPUT, ['From', true, DATE_OR_TIME + ' Returns this moment if business is already open.', 'Date']],
    outputs: ['Result Date', 'Result Datetime', 'Result Datetime Local', 'Already Open'] }
].freeze

# A routine call node's parameters mirror the routine's inputs, as the Console
# sets them: label, required flag and description.
def core_call_params(mapping)
  CORE_INPUTS.map do |(name, required, description)|
    param(name, mapping.fetch(name, ''), name, required: required, description: description)
  end
end

def wrapper_routine(w)
  b = TreeBuilder.new
  mapping = { 'Operation' => w[:operation] }
  w[:inputs].each { |name, _, _, core_name| mapping[core_name || name] = "<%= @inputs['#{name}'] %>" }
  call = b.add(CORE_ID, 'Calculate', core_call_params(mapping), 250, 10, defers: true)
  names = w[:outputs] + COMMON_OUTPUTS
  outputs = names.map { |n| param(n, "<%= @results['Calculate']['#{n}'] %>", n, description: CORE_OUTPUTS[n][0]) }
  ret = b.add('system_tree_return_v1', 'Return', outputs, 500, 10)
  b.connect('start', call, 'calculate')
  b.connect(call, ret, 'then return')
  routine_body(w[:name], w[:id], b, "Calls #{CORE_NAME} with Operation #{w[:operation]}. Generated by build_trees.rb.",
               w[:inputs].map { |name, required, description, _| [name, required, description] },
               names.map { |n| [n, CORE_OUTPUTS[n][0]] })
end

def webapi
  b = TreeBuilder.new
  parse = b.add('utilities_echo_v1', 'Parse Request', echo_params(<<~ERB.chomp), 262, 13)
    <%=
    #{PARAMS_CODE}
    # Map the query string (?op=...&calendar=...&from=...) to the routine's inputs.
    # @request['Query'] is parsed directly because @request['Parameters'] is
    # missing on some engine builds.
    query = (@request['Query'] rescue nil)
    JSON.generate(#{PARAMS}.from_query(query), ascii_only: true)
    %>
  ERB
  mapping = CORE_INPUTS.to_h do |(name, _, _)|
    [name, "<%= JSON.parse(@results['Parse Request']['output'])['#{name}'] %>"]
  end
  call = b.add(CORE_ID, 'Calculate', core_call_params(mapping), 662, 21, defers: true)
  # Labels and order match a Console-built WebAPI Return node.
  ret = b.add('system_tree_return_v1', 'Return', [
    param('content', "<%= @results['Calculate']['Result JSON'] %>", 'Content'),
    param('content_type', 'application/json', 'Content Type'),
    param('headers_json', '{"Cache-Control":"no-store"}', 'Headers (JSON)'),
    param('response_code', "<%= @results['Calculate']['HTTP Status'] %>", 'Response Code')
  ], 1027, 18)
  b.connect('start', parse, 'parse query')
  b.connect(parse, call, 'then calculate')
  b.connect(call, ret, 'then return')
  { 'slug' => 'business-calendar', 'method' => 'GET',
    'securityPolicies' => [{ 'endpoint' => 'Execution', 'name' => 'Authenticated Users' }],
    'treeJson' => b.tree_json('business-calendar', "Business Calendar WebAPI. Call with ?timeout=10. Generated by build_trees.rb.") }
end

# --- Task engine export format ------------------------------------------------

def xml_text(value)
  value.to_s.gsub('&', '&amp;').gsub('<', '&lt;').gsub('>', '&gt;')
end

def xml_attr(value)
  xml_text(value).gsub('"', '&quot;')
end

def attrs(pairs)
  pairs.map { |key, value| "#{key}=\"#{xml_attr(value)}\"" }.join(' ')
end

def xml_block(indent, tag, lines)
  pad = ' ' * indent
  return ["#{pad}<#{tag}></#{tag}>"] if lines.empty?
  ["#{pad}<#{tag}>", *lines, "#{pad}</#{tag}>"]
end

# Mirrors GET /trees/{title}?include=export for trees built here.
def tree_xml(tree)
  json = tree['treeJson']
  # The engine leaves '>' unescaped in these two header elements.
  header = ->(value) { value.to_s.gsub('&', '&amp;').gsub('<', '&lt;') }
  lines = ['<tree schema_version="1.0">',
           "    <sourceName>#{header.call(tree['sourceName'])}</sourceName>",
           "    <sourceGroup>#{header.call(tree['sourceGroup'])}</sourceGroup>"]
  lines << "    <definitionId>#{xml_text(tree['definitionId'])}</definitionId>" if tree['definitionId']
  lines += ["    <type>#{xml_text(tree['type'])}</type>", "    <status>#{xml_text(tree['status'])}</status>",
            '    <taskTree builder_version="" schema_version="1.0" version="">',
            "        <name>#{xml_text(json['name'])}</name>", '        <author></author>', '        <notes></notes>',
            "        <lastID>#{json['lastId']}</lastID>"]
  if (definition = json['taskDefinition'])
    lines << "        <taskDefinition #{attrs('id' => definition['id'], 'name' => definition['name'], 'schema_version' => '1.0', 'version' => '1')}>"
    lines += ["            <visible>#{definition['visible']}</visible>", "            <deferrable>#{definition['deferrable']}</deferrable>"]
    lines += xml_block(12, 'parameters', definition['inputs'].map do |i|
      "                <parameter #{attrs('id' => i['name'], 'label' => i['name'], 'required' => i['required'], 'tooltip' => i['description'])}></parameter>"
    end)
    lines << '            <handler name="system_tree_call" version="1"></handler>'
    results = definition['outputs'].map { |o| "                <result #{attrs('name' => o['name'], 'tooltip' => o['description'])}></result>" }
    lines += results.empty? ? ['            <results format="xml"></results>'] : ['            <results format="xml">', *results, '            </results>']
    lines << '        </taskDefinition>'
  end
  lines << '        <request>'
  json['nodes'].each do |node|
    lines << "            <task #{attrs('definition_id' => node['definitionId'], 'id' => node['id'], 'name' => node['name'], 'x' => node['position']['x'], 'y' => node['position']['y'])}>"
    lines += ['version', 'configured', 'defers', 'deferrable', 'visible'].map { |k| "                <#{k}>#{node[k]}</#{k}>" }
    lines += xml_block(16, 'parameters', node['parameters'].map do |p|
      "                    <parameter #{attrs('dependsOnId' => p['dependsOnId'], 'dependsOnValue' => p['dependsOnValue'], 'id' => p['id'], 'label' => p['label'], 'menu' => p['menu'], 'required' => p['required'], 'tooltip' => p['description'])}>#{xml_text(p['value'])}</parameter>"
    end)
    lines << '                <messages></messages>'
    lines += xml_block(16, 'dependents', json['connectors'].select { |c| c['from'] == node['id'] }.map do |c|
      "                    <task #{attrs('label' => c['label'], 'type' => c['type'], 'value' => c['value'])}>#{xml_text(c['to'])}</task>"
    end)
    lines << '            </task>'
  end
  (lines + ['        </request>', '    </taskTree>', '</tree>']).join("\n")
end

def slug(text)
  text.downcase.gsub(/[^a-z0-9]/, '-')
end

FileUtils.mkdir_p(OUT_DIR)
write = lambda do |file, body|
  json = JSON.pretty_generate(body)
  abort "#{file} is not ASCII-only" unless json.ascii_only?
  File.write(File.join(OUT_DIR, file), json)
  puts "wrote #{File.join(OUT_DIR, file)} (#{json.bytesize} bytes)"
end
write_export = lambda do |relative, tree|
  return unless EXPORT_DIR
  path = File.join(EXPORT_DIR, relative)
  FileUtils.mkdir_p(File.dirname(path))
  File.write(path, tree_xml(tree))
  puts "exported #{path}"
end

routines = [core_routine] + WRAPPERS.map { |w| wrapper_routine(w) }
routines.each do |routine|
  write.call("routine-#{slug(routine['name'])}.json", routine)
  write_export.call("task/routines/#{slug(routine['name'])}.xml", routine)
end
api = webapi
write.call('webapi-business-calendar.json', api)
write_export.call("task/sources/kinetic-request-ce/trees/#{slug("WebApis > #{KAPP}")}.#{api['slug']}.xml",
                  { 'sourceName' => 'Kinetic Request CE', 'sourceGroup' => "WebApis > #{KAPP}", 'type' => 'Tree',
                    'status' => 'Active', 'treeJson' => api['treeJson'] })

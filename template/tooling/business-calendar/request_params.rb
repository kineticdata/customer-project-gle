# Maps the business-calendar WebAPI query string to the inputs of the
# "Business Calendar Calculate" routine. build_trees.rb embeds this file in the
# WebAPI's "Parse Request" node. Parse @request['Query'] rather than relying on
# @request['Parameters'], which some engine builds don't provide.
require 'uri'
require 'json'

module BizCalParams
  def self.from_query(query)
    params = {}
    begin
      URI.decode_www_form(query.to_s).each { |key, value| params[key.to_s] = value.to_s }
    rescue ArgumentError
      return { 'Operation' => 'invalid_query_string' }
    end
    {
      'Operation' => params['op'].to_s,
      'Calendar' => params['calendar'].to_s,
      'Date' => (params['from'] || params['date'] || params['start']).to_s,
      'End Date' => params['end'].to_s,
      'Amount' => params['amount'].to_s,
      'Unit' => params['unit'].to_s,
      'Direction' => params['direction'].to_s,
      'Adjust' => params['adjust'].to_s,
      'Time' => params['time'].to_s
    }
  end
end

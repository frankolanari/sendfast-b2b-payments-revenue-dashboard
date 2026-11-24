-- name: Win rate by lead source
-- collection: Pipeline
-- display: bar
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Click a bar to filter the dashboard to that lead source.
-- viz: {graph.dimensions: [lead_source], graph.metrics: [win_rate], column_settings: {'["name","win_rate"]': {number_style: percent, decimals: 1}}}
select
    lead_source,
    avg(case when is_won then 1.0 else 0.0 end) as win_rate,
    count(*) as closed_opportunities
from analytics.fct_opportunities
where is_closed
  [[ and close_date >= {{date_from}} ]]
  [[ and close_date <= {{date_to}} ]]
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]
  [[ and owner_id = {{owner_id}} ]]
group by lead_source
order by lead_source

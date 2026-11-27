-- name: Pipeline created by month and lead source
-- collection: Pipeline
-- display: bar
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- viz: {graph.dimensions: [month, lead_source], graph.metrics: [pipeline_created_usd], stackable.stack_type: stacked}
select
    cast(date_trunc('month', created_date) as date) as month,
    lead_source,
    coalesce(sum(amount_usd), 0) as pipeline_created_usd,
    count(*) as opportunities
from analytics.fct_opportunities
where 1 = 1
  [[ and created_date >= {{date_from}} ]]
  [[ and created_date <= {{date_to}} ]]
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]
  [[ and owner_id = {{owner_id}} ]]
group by 1, 2
order by 1, 2

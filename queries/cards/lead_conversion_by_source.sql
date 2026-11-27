-- name: Lead conversion by lead source
-- collection: Pipeline
-- display: bar
-- params: [date_from, date_to, lead_source]
-- description: Share of leads created in the period that converted to an opportunity.
-- viz: {graph.dimensions: [lead_source], graph.metrics: [conversion_rate], column_settings: {'["name","conversion_rate"]': {number_style: percent, decimals: 1}}}
select
    lead_source,
    count(*) as leads,
    sum(case when is_converted then 1 else 0 end) as converted_leads,
    avg(case when is_converted then 1.0 else 0.0 end) as conversion_rate
from analytics.fct_leads_funnel
where 1 = 1
  [[ and created_date >= {{date_from}} ]]
  [[ and created_date <= {{date_to}} ]]
  [[ and lead_source = {{lead_source}} ]]
group by lead_source
order by lead_source

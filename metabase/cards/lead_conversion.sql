-- name: Lead conversion
-- collection: Pipeline
-- display: scalar
-- params: [date_from, date_to, lead_source]
-- description: Share of leads created in the period that became an opportunity.
-- viz: {column_settings: {'["name","conversion_rate"]': {number_style: percent, decimals: 1}}}
select avg(case when is_converted then 1.0 else 0.0 end) as conversion_rate
from analytics.fct_leads_funnel
where 1 = 1
  [[ and created_date >= {{date_from}} ]]
  [[ and created_date <= {{date_to}} ]]
  [[ and lead_source = {{lead_source}} ]]

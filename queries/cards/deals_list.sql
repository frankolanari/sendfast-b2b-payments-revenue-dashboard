-- name: Deals behind the numbers
-- collection: Pipeline
-- display: table
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Deals created in the period, largest first (top 100): the drill-through behind the pipeline charts.
select
    o.opportunity_id,
    o.account_id,
    a.name as account_name,
    o.rep_name,
    o.segment,
    o.lead_source,
    o.stage,
    o.outcome,
    o.amount_usd,
    o.created_date,
    o.close_date,
    o.is_past_due
from analytics.fct_opportunities as o
inner join analytics.dim_accounts as a on o.account_id = a.account_id
where 1 = 1
  [[ and o.created_date >= {{date_from}} ]]
  [[ and o.created_date <= {{date_to}} ]]
  [[ and o.segment = {{segment}} ]]
  [[ and o.lead_source = {{lead_source}} ]]
  [[ and o.owner_id = {{owner_id}} ]]
order by o.amount_usd desc nulls last, o.opportunity_id
limit 100

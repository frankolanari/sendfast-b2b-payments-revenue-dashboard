-- name: Sales cycle (median days)
-- collection: Pipeline
-- display: scalar
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Median days from created to close for won opportunities closed in the period; invalid close dates excluded.
select percentile_cont(0.5) within group (order by sales_cycle_days) as sales_cycle_days
from analytics.fct_opportunities
where is_won and not has_invalid_close_date
  [[ and close_date >= {{date_from}} ]]
  [[ and close_date <= {{date_to}} ]]
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]
  [[ and owner_id = {{owner_id}} ]]

-- name: Pipeline created (USD)
-- collection: Pipeline
-- display: scalar
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Sum of amount_usd of opportunities created in the period (null amounts add nothing).
select coalesce(sum(amount_usd), 0) as pipeline_created_usd
from analytics.fct_opportunities
where 1 = 1
  [[ and created_date >= {{date_from}} ]]
  [[ and created_date <= {{date_to}} ]]
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]
  [[ and owner_id = {{owner_id}} ]]

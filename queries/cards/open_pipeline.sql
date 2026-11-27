-- name: Open pipeline (USD)
-- collection: Pipeline
-- display: scalar
-- params: [segment, lead_source, owner_id]
-- description: Sum of amount_usd of opportunities open as of 2026-10-31.
select coalesce(sum(amount_usd), 0) as open_pipeline_usd
from analytics.fct_opportunities
where is_open
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]
  [[ and owner_id = {{owner_id}} ]]

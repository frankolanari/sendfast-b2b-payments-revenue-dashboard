-- name: Deals through the stage gates
-- collection: Pipeline
-- display: table
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Deals created in the period, by lead source, the furthest stage reached, and outcome. A deal that reached a stage passed every earlier gate (a stage-gate Sankey).
select
    lead_source,
    furthest_stage_rank,
    outcome,
    count(*) as deals,
    coalesce(sum(amount_usd), 0) as amount_usd
from analytics.fct_opportunities
where 1 = 1
  [[ and created_date >= {{date_from}} ]]
  [[ and created_date <= {{date_to}} ]]
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]
  [[ and owner_id = {{owner_id}} ]]
group by lead_source, furthest_stage_rank, outcome
order by lead_source, furthest_stage_rank, outcome

-- name: Deal flow by source, stage and outcome
-- collection: Pipeline
-- display: table
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Deals created in the period, by lead source, the last open stage they reached, and their outcome (a Sankey).
select
    o.lead_source,
    s.stage as last_open_stage,
    s.stage_rank as last_open_stage_rank,
    o.outcome,
    count(*) as deals,
    coalesce(sum(o.amount_usd), 0) as amount_usd
from analytics.fct_opportunities as o
inner join analytics.dim_stages as s on o.last_open_stage_rank = s.stage_rank
where 1 = 1
  [[ and o.created_date >= {{date_from}} ]]
  [[ and o.created_date <= {{date_to}} ]]
  [[ and o.segment = {{segment}} ]]
  [[ and o.lead_source = {{lead_source}} ]]
  [[ and o.owner_id = {{owner_id}} ]]
group by o.lead_source, s.stage, s.stage_rank, o.outcome
order by o.lead_source, s.stage_rank, o.outcome

-- name: Open pipeline by rep
-- collection: Pipeline
-- display: bar
-- params: [segment, lead_source, owner_id]
-- description: Open pipeline as of 2026-10-31 and the share already past its close date. Click a bar to filter to that rep.
-- viz: {graph.dimensions: [owner_id], graph.metrics: [open_pipeline_usd, past_due_pipeline_usd], graph.x_axis.title_text: Rep}
select
    o.owner_id,
    r.name as rep_name,
    count(*) as deals,
    sum(case when o.is_past_due then 1 else 0 end) as past_due_deals,
    coalesce(sum(o.amount_usd), 0) as open_pipeline_usd,
    coalesce(sum(o.amount_usd) filter (where o.is_past_due), 0) as past_due_pipeline_usd,
    coalesce(sum(o.amount_usd) filter (where o.is_past_due), 0) / nullif(sum(o.amount_usd), 0) as past_due_share
from analytics.fct_opportunities as o
inner join analytics.dim_reps as r on o.owner_id = r.rep_id
where o.is_open
  [[ and o.segment = {{segment}} ]]
  [[ and o.lead_source = {{lead_source}} ]]
  [[ and o.owner_id = {{owner_id}} ]]
group by o.owner_id, r.name
order by open_pipeline_usd desc

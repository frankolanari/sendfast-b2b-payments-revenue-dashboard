-- name: Open pipeline by age
-- collection: Pipeline
-- display: table
-- params: [segment, lead_source, owner_id]
-- description: Open deals as of 2026-10-31 by how long ago they were created, split by rep, with those past their close date.
select
    o.age_bucket,
    min(o.age_days) as youngest_days,
    r.name as rep_name,
    count(*) as deals,
    sum(case when o.is_past_due then 1 else 0 end) as past_due_deals,
    coalesce(sum(o.amount_usd), 0) as open_usd,
    coalesce(sum(o.amount_usd) filter (where o.is_past_due), 0) as past_due_usd
from analytics.fct_opportunities as o
inner join analytics.dim_reps as r on o.owner_id = r.rep_id
where o.is_open
  [[ and o.segment = {{segment}} ]]
  [[ and o.lead_source = {{lead_source}} ]]
  [[ and o.owner_id = {{owner_id}} ]]
group by o.age_bucket, r.name
order by youngest_days, open_usd desc

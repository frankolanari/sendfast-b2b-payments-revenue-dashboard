-- name: Median days in stage
-- collection: Pipeline
-- display: row
-- params: [date_from, date_to, lead_source, owner_id]
-- description: Median days opportunities spent in each open stage, for stage entries in the period, in funnel order.
-- viz: {graph.dimensions: [stage], graph.metrics: [median_days_in_stage]}
select
    t.stage,
    percentile_cont(0.5) within group (order by t.days_in_stage) as median_days_in_stage,
    count(*) as stage_entries
from analytics.fct_stage_transitions as t
inner join analytics.dim_stages as s on t.stage = s.stage
where s.is_open_stage and t.days_in_stage is not null
  [[ and t.entered_at >= {{date_from}} ]]
  [[ and t.entered_at < cast({{date_to}} as date) + 1 ]]
  [[ and t.lead_source = {{lead_source}} ]]
  [[ and t.owner_id = {{owner_id}} ]]
group by t.stage, s.stage_rank
order by s.stage_rank

-- name: Median days in stage
-- collection: Pipeline
-- display: row
-- params: [date_from, date_to, lead_source, owner_id]
-- description: Median days opportunities spent in each stage, for stage entries in the period.
-- viz: {graph.dimensions: [stage], graph.metrics: [median_days_in_stage]}
select
    stage,
    percentile_cont(0.5) within group (order by days_in_stage) as median_days_in_stage,
    count(*) as stage_entries
from analytics.fct_stage_transitions
where days_in_stage is not null
  [[ and entered_at >= {{date_from}} ]]
  [[ and entered_at < cast({{date_to}} as date) + 1 ]]
  [[ and lead_source = {{lead_source}} ]]
  [[ and owner_id = {{owner_id}} ]]
group by stage
order by min(stage_sequence)

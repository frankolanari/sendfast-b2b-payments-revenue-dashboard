-- name: Lead to won funnel
-- collection: Pipeline
-- display: table
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Leads created in the period, followed to their deals: how many reached each step, and how many were lost or are still open there.
with steps as (
    select 0 as stage_rank, 'lead' as stage
    union all
    select stage_rank, stage from analytics.dim_stages where stage_rank is not null
),
journeys as (
    select *
    from analytics.fct_lead_journeys
    where 1 = 1
      [[ and created_date >= {{date_from}} ]]
      [[ and created_date <= {{date_to}} ]]
      [[ and segment = {{segment}} ]]
      [[ and lead_source = {{lead_source}} ]]
      [[ and owner_id = {{owner_id}} ]]
)
select
    steps.stage,
    steps.stage_rank,
    count(j.lead_id) as reached,
    count(j.lead_id) filter (where j.stage_reached = steps.stage_rank and j.outcome = 'lost') as lost_here,
    count(j.lead_id) filter (where j.stage_reached = steps.stage_rank and j.outcome = 'open') as open_here,
    coalesce(sum(j.amount_usd) filter (where j.stage_reached = steps.stage_rank and j.outcome = 'lost'), 0) as lost_here_usd,
    coalesce(sum(j.amount_usd) filter (where j.stage_reached = steps.stage_rank and j.outcome = 'open'), 0) as open_here_usd,
    coalesce(sum(j.amount_usd), 0) as value_usd
from steps
left join journeys as j on j.stage_reached >= steps.stage_rank
group by steps.stage, steps.stage_rank
order by steps.stage_rank

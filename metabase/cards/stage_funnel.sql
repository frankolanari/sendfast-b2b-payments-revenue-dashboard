-- name: Deals by furthest stage reached
-- collection: Pipeline
-- display: bar
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Opportunities created in the period that reached each stage or beyond (a funnel).
-- viz: {graph.dimensions: [stage], graph.metrics: [opportunities]}
select
    s.stage,
    s.stage_rank,
    count(o.opportunity_id) as opportunities
from analytics.dim_stages as s
left join analytics.fct_opportunities as o
    on o.furthest_stage_rank >= s.stage_rank
    [[ and o.created_date >= {{date_from}} ]]
    [[ and o.created_date <= {{date_to}} ]]
    [[ and o.segment = {{segment}} ]]
    [[ and o.lead_source = {{lead_source}} ]]
    [[ and o.owner_id = {{owner_id}} ]]
where s.stage_rank is not null
group by s.stage, s.stage_rank
order by s.stage_rank

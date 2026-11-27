-- name: Deal outcomes by group
-- collection: Pipeline
-- display: table
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Deals created in the period, grouped by segment, lead source, rep, sales team and industry: won, still open and lost, with value, and the stage where lost deals most often stopped.
-- viz: {column_settings: {'["name","won_share"]': {number_style: percent, decimals: 1}}}
select
    g.dimension,
    coalesce(g.grp, 'unknown') as grp,
    count(*) as deals,
    count(*) filter (where o.outcome = 'won') as won,
    count(*) filter (where o.outcome = 'lost') as lost,
    count(*) filter (where o.outcome = 'open') as still_open,
    avg(case when o.outcome = 'won' then 1.0 else 0.0 end) as won_share,
    coalesce(sum(o.amount_usd) filter (where o.outcome = 'won'), 0) as won_usd,
    coalesce(sum(o.amount_usd) filter (where o.outcome = 'lost'), 0) as lost_usd,
    coalesce(sum(o.amount_usd) filter (where o.outcome = 'open'), 0) as open_usd,
    mode() within group (order by o.furthest_stage_rank)
    filter (where o.outcome = 'lost') as lost_stage_rank
from analytics.fct_opportunities as o
cross join lateral (
    values
        ('segment', o.segment),
        ('lead_source', o.lead_source),
        ('rep', o.rep_name),
        ('team', o.rep_team),
        ('industry', o.industry)
) as g (dimension, grp)
where 1 = 1
  [[ and o.created_date >= {{date_from}} ]]
  [[ and o.created_date <= {{date_to}} ]]
  [[ and o.segment = {{segment}} ]]
  [[ and o.lead_source = {{lead_source}} ]]
  [[ and o.owner_id = {{owner_id}} ]]
group by g.dimension, coalesce(g.grp, 'unknown')
order by g.dimension, deals desc, grp

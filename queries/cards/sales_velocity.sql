-- name: Sales velocity by group
-- collection: Pipeline
-- display: table
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Open deals (as of 2026-10-31) x average won deal x win rate / median sales cycle, overall (dimension 'all') and grouped by segment, lead source, rep, sales team and industry. Won deal, win rate and cycle use deals closed in the period.
-- viz: {column_settings: {'["name","win_rate"]': {number_style: percent, decimals: 1}}}
with deals as (
    select
        *,
        is_closed
        [[ and close_date >= {{date_from}} ]]
        [[ and close_date <= {{date_to}} ]] as closed_in_period
    from analytics.fct_opportunities
    where 1 = 1
      [[ and segment = {{segment}} ]]
      [[ and lead_source = {{lead_source}} ]]
      [[ and owner_id = {{owner_id}} ]]
),
grouped as (
    select
        g.dimension,
        coalesce(g.grp, 'unknown') as grp,
        count(*) filter (where d.is_open) as open_deals,
        count(*) filter (where d.closed_in_period) as closed_deals,
        count(*) filter (where d.closed_in_period and d.is_won) as won_deals,
        avg(case when d.is_won then 1.0 else 0.0 end) filter (where d.closed_in_period) as win_rate,
        avg(d.amount_usd) filter (where d.closed_in_period and d.is_won) as avg_won_usd,
        percentile_cont(0.5) within group (order by d.sales_cycle_days)
        filter (where d.closed_in_period and d.is_won and not d.has_invalid_close_date) as cycle_days
    from deals as d
    cross join lateral (
        values
            ('all', 'all'),
            ('segment', d.segment),
            ('lead_source', d.lead_source),
            ('rep', d.rep_name),
            ('team', d.rep_team),
            ('industry', d.industry)
    ) as g (dimension, grp)
    group by g.dimension, coalesce(g.grp, 'unknown')
)
select
    dimension,
    grp,
    open_deals,
    avg_won_usd,
    win_rate,
    cycle_days,
    open_deals * avg_won_usd * win_rate / nullif(cycle_days, 0) as velocity_usd_per_day,
    closed_deals,
    won_deals
from grouped
where open_deals > 0 or closed_deals > 0
order by dimension, velocity_usd_per_day desc nulls last, grp

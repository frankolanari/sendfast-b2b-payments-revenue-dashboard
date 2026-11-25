-- name: Sales velocity by segment
-- collection: Pipeline
-- display: table
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Open deals (as of 2026-10-31) x average won deal x win rate / median sales cycle, overall and by segment. Won deal, win rate and cycle use deals closed in the period.
-- viz: {column_settings: {'["name","win_rate"]': {number_style: percent, decimals: 1}}}
with deals as (
    select *
    from analytics.fct_opportunities
    where 1 = 1
      [[ and segment = {{segment}} ]]
      [[ and lead_source = {{lead_source}} ]]
      [[ and owner_id = {{owner_id}} ]]
),
closed as (
    select
        case when grouping(segment) = 1 then 'all' else coalesce(segment, 'unknown') end as segment,
        count(*) as closed_deals,
        sum(case when is_won then 1 else 0 end) as won_deals,
        avg(case when is_won then 1.0 else 0.0 end) as win_rate,
        avg(amount_usd) filter (where is_won) as avg_won_usd,
        percentile_cont(0.5) within group (order by sales_cycle_days)
        filter (where is_won and not has_invalid_close_date) as cycle_days
    from deals
    where is_closed
      [[ and close_date >= {{date_from}} ]]
      [[ and close_date <= {{date_to}} ]]
    group by grouping sets ((segment), ())
),
open_now as (
    select
        case when grouping(segment) = 1 then 'all' else coalesce(segment, 'unknown') end as segment,
        count(*) as open_deals
    from deals
    where is_open
    group by grouping sets ((segment), ())
)
select
    c.segment,
    coalesce(o.open_deals, 0) as open_deals,
    c.avg_won_usd,
    c.win_rate,
    c.cycle_days,
    coalesce(o.open_deals, 0) * c.avg_won_usd * c.win_rate / nullif(c.cycle_days, 0) as velocity_usd_per_day,
    c.closed_deals,
    c.won_deals
from closed as c
left join open_now as o on c.segment = o.segment
order by case c.segment when 'all' then 0 when 'smb' then 1 when 'mid_market' then 2 when 'enterprise' then 3 else 4 end

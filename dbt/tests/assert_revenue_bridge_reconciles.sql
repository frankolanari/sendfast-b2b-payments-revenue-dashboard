-- The bridge explains every month's change in total net revenue, to the cent.
with totals as (
    select revenue_month, sum(net_revenue_usd) as total_usd
    from {{ ref('fct_revenue_monthly') }}
    group by revenue_month
),
changes as (
    select revenue_month, total_usd - lag(total_usd) over (order by revenue_month) as change_usd
    from totals
),
bridge as (
    select revenue_month, sum(amount_usd) as bridged_usd
    from {{ ref('fct_revenue_bridge') }}
    group by revenue_month
)
select changes.revenue_month, changes.change_usd, coalesce(bridge.bridged_usd, 0) as bridged_usd
from changes
left join bridge on changes.revenue_month = bridge.revenue_month
where changes.change_usd is not null and abs(changes.change_usd - coalesce(bridge.bridged_usd, 0)) > 0.01

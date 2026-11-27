-- name: Net revenue retention (NRR)
-- collection: Revenue
-- display: scalar
-- params: [date_to, segment, lead_source]
-- required: [date_to]
-- description: Net revenue in the month of the To date from accounts live 12 months earlier, over their revenue then.
-- viz: {column_settings: {'["name","nrr"]': {number_style: percent, decimals: 1}}}
with base as (
    select account_id
    from analytics.dim_accounts
    where is_customer and not is_excluded
      and live_date < date_trunc('month', cast({{date_to}} as date)) - interval '11 months'
      [[ and segment = {{segment}} ]]
      [[ and lead_source = {{lead_source}} ]]
),
revenue as (
    select
        base.account_id,
        coalesce(sum(r.net_revenue_usd) filter (
            where r.revenue_month = date_trunc('month', cast({{date_to}} as date))
        ), 0) as now_usd,
        coalesce(sum(r.net_revenue_usd) filter (
            where r.revenue_month = date_trunc('month', cast({{date_to}} as date)) - interval '12 months'
        ), 0) as then_usd
    from base
    left join analytics.fct_revenue_monthly as r on base.account_id = r.account_id
    group by base.account_id
)
select sum(now_usd) / nullif(sum(then_usd), 0) as nrr
from revenue

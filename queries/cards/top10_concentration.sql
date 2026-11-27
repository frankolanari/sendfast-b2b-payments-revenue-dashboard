-- name: Top-10 revenue concentration
-- collection: Risk
-- display: scalar
-- params: [date_from, date_to, segment, owner_id]
-- description: Share of net revenue in the period earned from the 10 accounts with the most.
-- viz: {column_settings: {'["name","top10_share"]': {number_style: percent, decimals: 1}}}
with per_account as (
    select r.account_id, sum(r.net_revenue_usd) as net_revenue_usd
    from analytics.fct_revenue_monthly as r
    inner join analytics.dim_accounts as a on r.account_id = a.account_id
    where 1 = 1
      [[ and r.revenue_month >= date_trunc('month', cast({{date_from}} as date)) ]]
      [[ and r.revenue_month <= {{date_to}} ]]
      [[ and a.segment = {{segment}} ]]
      [[ and a.owner_id = {{owner_id}} ]]
    group by r.account_id
),
ranked as (
    select net_revenue_usd, row_number() over (order by net_revenue_usd desc) as revenue_rank
    from per_account
)
select sum(net_revenue_usd) filter (where revenue_rank <= 10) / nullif(sum(net_revenue_usd), 0) as top10_share
from ranked

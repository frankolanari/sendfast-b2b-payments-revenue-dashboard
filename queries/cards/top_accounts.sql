-- name: Top 10 accounts by net revenue
-- collection: Risk
-- display: row
-- params: [date_from, date_to, segment, owner_id]
-- description: The 10 accounts that earned the most in the period, with their share of all net revenue. Click one to open Account 360.
-- viz: {graph.dimensions: [account_name], graph.metrics: [net_revenue_usd]}
with per_account as (
    select r.account_id, a.name as account_name, sum(r.net_revenue_usd) as net_revenue_usd
    from analytics.fct_revenue_monthly as r
    inner join analytics.dim_accounts as a on r.account_id = a.account_id
    where 1 = 1
      [[ and r.revenue_month >= date_trunc('month', cast({{date_from}} as date)) ]]
      [[ and r.revenue_month <= {{date_to}} ]]
      [[ and a.segment = {{segment}} ]]
      [[ and a.owner_id = {{owner_id}} ]]
    group by r.account_id, a.name
)
select
    account_id,
    account_name,
    net_revenue_usd,
    net_revenue_usd / sum(net_revenue_usd) over () as share_of_net_revenue
from per_account
order by net_revenue_usd desc
limit 10

-- name: Net revenue (USD)
-- collection: Revenue
-- display: scalar
-- params: [date_from, date_to, segment, lead_source]
-- description: Platform fee + usage fee + FX margin + true-up, for the months in the period.
select coalesce(sum(r.net_revenue_usd), 0) as net_revenue_usd
from analytics.fct_revenue_monthly as r
inner join analytics.dim_accounts as a on r.account_id = a.account_id
where 1 = 1
  [[ and r.revenue_month >= date_trunc('month', cast({{date_from}} as date)) ]]
  [[ and r.revenue_month <= {{date_to}} ]]
  [[ and a.segment = {{segment}} ]]
  [[ and a.lead_source = {{lead_source}} ]]

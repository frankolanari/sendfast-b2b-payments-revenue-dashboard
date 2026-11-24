-- name: Revenue at risk (USD)
-- collection: Risk
-- display: scalar
-- params: [date_to, segment, owner_id]
-- required: [date_to]
-- description: Average monthly net revenue over the previous 3 months of accounts at risk in the month of the To date.
select coalesce(sum(h.revenue_at_risk_usd), 0) as revenue_at_risk_usd
from analytics.fct_account_health_monthly as h
inner join analytics.dim_accounts as a on h.account_id = a.account_id
where h.month_start = date_trunc('month', cast({{date_to}} as date))
  [[ and a.segment = {{segment}} ]]
  [[ and a.owner_id = {{owner_id}} ]]

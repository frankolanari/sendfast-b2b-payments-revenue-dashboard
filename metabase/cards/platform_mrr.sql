-- name: Platform MRR (USD)
-- collection: Revenue
-- display: scalar
-- params: [date_to, segment, lead_source]
-- required: [date_to]
-- description: Platform-fee invoice lines whose period is the month of the To date.
select coalesce(sum(r.platform_fee_usd), 0) as platform_mrr_usd
from analytics.fct_revenue_monthly as r
inner join analytics.dim_accounts as a on r.account_id = a.account_id
where r.revenue_month = date_trunc('month', cast({{date_to}} as date))
  [[ and a.segment = {{segment}} ]]
  [[ and a.lead_source = {{lead_source}} ]]

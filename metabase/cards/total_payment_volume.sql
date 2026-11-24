-- name: Total payment volume (USD)
-- collection: Revenue
-- display: scalar
-- params: [date_from, date_to, segment, lead_source]
-- description: Succeeded transaction volume in USD in the period.
select coalesce(sum(d.volume_usd), 0) as total_payment_volume_usd
from analytics.fct_account_daily as d
inner join analytics.dim_accounts as a on d.account_id = a.account_id
where 1 = 1
  [[ and d.activity_date >= {{date_from}} ]]
  [[ and d.activity_date <= {{date_to}} ]]
  [[ and a.segment = {{segment}} ]]
  [[ and a.lead_source = {{lead_source}} ]]

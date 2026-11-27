-- name: Activation (median days)
-- collection: Revenue
-- display: scalar
-- params: [date_from, date_to, segment, lead_source]
-- description: Median days from won date to first succeeded transaction, for accounts won in the period.
select percentile_cont(0.5) within group (order by activation_days) as activation_days
from analytics.dim_accounts
where is_customer and not is_excluded and activation_days is not null
  [[ and won_date >= {{date_from}} ]]
  [[ and won_date <= {{date_to}} ]]
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]

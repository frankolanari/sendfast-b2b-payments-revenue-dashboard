-- name: Accounts at risk
-- collection: Risk
-- display: table
-- params: [date_to, segment, owner_id]
-- required: [date_to]
-- description: Accounts at risk in the month of the To date. Click an account to open Account 360.
select
    h.account_id,
    a.name as account_name,
    a.segment,
    r.name as rep_name,
    h.volume_trend,
    h.failure_rate,
    h.revenue_at_risk_usd
from analytics.fct_account_health_monthly as h
inner join analytics.dim_accounts as a on h.account_id = a.account_id
left join analytics.dim_reps as r on a.owner_id = r.rep_id
where h.month_start = date_trunc('month', cast({{date_to}} as date))
  [[ and a.segment = {{segment}} ]]
  [[ and a.owner_id = {{owner_id}} ]]
  and h.is_at_risk
order by h.revenue_at_risk_usd desc

-- name: Accounts by health status
-- collection: Risk
-- display: pie
-- params: [date_to, segment, owner_id]
-- required: [date_to]
-- description: Live accounts by health status in the month of the To date.
-- viz: {pie.dimension: health_status, pie.metric: accounts}
select h.health_status, count(*) as accounts
from analytics.fct_account_health_monthly as h
inner join analytics.dim_accounts as a on h.account_id = a.account_id
where h.month_start = date_trunc('month', cast({{date_to}} as date))
  [[ and a.segment = {{segment}} ]]
  [[ and a.owner_id = {{owner_id}} ]]
group by h.health_status
order by h.health_status

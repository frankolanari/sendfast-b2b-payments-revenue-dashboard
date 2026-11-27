-- name: Account health score by month
-- collection: Accounts
-- display: line
-- params: [account_id, date_from, date_to]
-- required: [account_id]
-- viz: {graph.dimensions: [month], graph.metrics: [health_score]}
select month_start as month, health_score, health_status, failure_rate, volume_trend
from analytics.fct_account_health_monthly
where account_id = {{account_id}}
  [[ and month_start >= date_trunc('month', cast({{date_from}} as date)) ]]
  [[ and month_start <= {{date_to}} ]]
order by 1

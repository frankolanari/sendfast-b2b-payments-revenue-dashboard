-- name: Account volume by corridor and month
-- collection: Accounts
-- display: line
-- params: [account_id, date_from, date_to]
-- required: [account_id]
-- viz: {graph.dimensions: [month, corridor], graph.metrics: [volume_usd]}
select activity_month as month, corridor, sum(volume_usd) as volume_usd
from analytics.fct_account_daily
where account_id = {{account_id}}
  [[ and activity_date >= {{date_from}} ]]
  [[ and activity_date <= {{date_to}} ]]
group by 1, 2
order by 1, 2

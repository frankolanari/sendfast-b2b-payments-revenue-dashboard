-- name: Failure rate by corridor and month
-- collection: Risk
-- display: line
-- params: [date_from, date_to, segment, corridor, owner_id]
-- description: Click a line to filter the dashboard to that corridor.
-- viz: {graph.dimensions: [month, corridor], graph.metrics: [failure_rate], column_settings: {'["name","failure_rate"]': {number_style: percent, decimals: 1}}}
select
    d.activity_month as month,
    d.corridor,
    sum(d.failed_count) * 1.0 / nullif(sum(d.txn_count), 0) as failure_rate
from analytics.fct_account_daily as d
inner join analytics.dim_accounts as a on d.account_id = a.account_id
where 1 = 1
  [[ and d.activity_date >= {{date_from}} ]]
  [[ and d.activity_date <= {{date_to}} ]]
  [[ and a.segment = {{segment}} ]]
  [[ and d.corridor = {{corridor}} ]]
  [[ and a.owner_id = {{owner_id}} ]]
group by 1, 2
order by 1, 2

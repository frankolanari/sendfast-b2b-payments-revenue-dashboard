-- name: Failure rate
-- collection: Risk
-- display: scalar
-- params: [date_from, date_to, segment, corridor, owner_id]
-- description: Failed / all transactions in the period.
-- viz: {column_settings: {'["name","failure_rate"]': {number_style: percent, decimals: 2}}}
select sum(d.failed_count) * 1.0 / nullif(sum(d.txn_count), 0) as failure_rate
from analytics.fct_account_daily as d
inner join analytics.dim_accounts as a on d.account_id = a.account_id
where 1 = 1
  [[ and d.activity_date >= {{date_from}} ]]
  [[ and d.activity_date <= {{date_to}} ]]
  [[ and a.segment = {{segment}} ]]
  [[ and d.corridor = {{corridor}} ]]
  [[ and a.owner_id = {{owner_id}} ]]

-- name: Failure rate by corridor and rail
-- collection: Risk
-- display: table
-- params: [date_from, date_to, segment, corridor, owner_id]
-- description: Payments, failures and failure rate for each corridor on each payment rail.
select
    d.corridor,
    d.rail,
    sum(d.txn_count) as transactions,
    sum(d.failed_count) as failed,
    sum(d.failed_count) * 1.0 / nullif(sum(d.txn_count), 0) as failure_rate
from analytics.fct_account_daily as d
inner join analytics.dim_accounts as a on d.account_id = a.account_id
where 1 = 1
  [[ and d.activity_date >= {{date_from}} ]]
  [[ and d.activity_date <= {{date_to}} ]]
  [[ and a.segment = {{segment}} ]]
  [[ and d.corridor = {{corridor}} ]]
  [[ and a.owner_id = {{owner_id}} ]]
group by d.corridor, d.rail
order by d.corridor, d.rail

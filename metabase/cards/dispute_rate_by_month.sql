-- name: Dispute and return rate by month
-- collection: Risk
-- display: line
-- params: [date_from, date_to, segment, corridor, owner_id]
-- description: Disputes plus returns opened in the month / succeeded transactions in the month.
-- viz: {graph.dimensions: [month], graph.metrics: [dispute_return_rate], column_settings: {'["name","dispute_return_rate"]': {number_style: percent, decimals: 2}}}
select
    d.activity_month as month,
    sum(d.disputes_opened + d.returns_opened) * 1.0 / nullif(sum(d.succeeded_count), 0) as dispute_return_rate
from analytics.fct_account_daily as d
inner join analytics.dim_accounts as a on d.account_id = a.account_id
where 1 = 1
  [[ and d.activity_date >= {{date_from}} ]]
  [[ and d.activity_date <= {{date_to}} ]]
  [[ and a.segment = {{segment}} ]]
  [[ and d.corridor = {{corridor}} ]]
  [[ and a.owner_id = {{owner_id}} ]]
group by 1
order by 1

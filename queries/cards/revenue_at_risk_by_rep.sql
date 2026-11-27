-- name: Revenue at risk by rep
-- collection: Risk
-- display: row
-- params: [date_to, segment, owner_id]
-- required: [date_to]
-- description: Revenue at risk in the month of the To date, by account owner.
-- viz: {graph.dimensions: [rep_name], graph.metrics: [revenue_at_risk_usd]}
select
    a.owner_id,
    coalesce(r.name, 'No owner') as rep_name,
    count(*) as accounts,
    sum(h.revenue_at_risk_usd) as revenue_at_risk_usd
from analytics.fct_account_health_monthly as h
inner join analytics.dim_accounts as a on h.account_id = a.account_id
left join analytics.dim_reps as r on a.owner_id = r.rep_id
where h.month_start = date_trunc('month', cast({{date_to}} as date))
  [[ and a.segment = {{segment}} ]]
  [[ and a.owner_id = {{owner_id}} ]]
  and h.is_at_risk
group by a.owner_id, r.name
order by revenue_at_risk_usd desc

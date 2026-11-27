-- name: Account net revenue by month
-- collection: Accounts
-- display: bar
-- params: [account_id, date_from, date_to]
-- required: [account_id]
-- viz: {graph.dimensions: [month, component], graph.metrics: [amount_usd], stackable.stack_type: stacked}
select r.revenue_month as month, c.component, c.amount_usd
from analytics.fct_revenue_monthly as r
cross join lateral (
    values
        ('platform_fee', r.platform_fee_usd),
        ('usage_fee', r.usage_fee_usd),
        ('fx_margin', r.fx_margin_usd),
        ('true_up', r.true_up_usd)
) as c (component, amount_usd)
where r.account_id = {{account_id}}
  [[ and r.revenue_month >= date_trunc('month', cast({{date_from}} as date)) ]]
  [[ and r.revenue_month <= {{date_to}} ]]
order by 1, 2

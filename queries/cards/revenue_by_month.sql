-- name: Net revenue by month and component
-- collection: Revenue
-- display: bar
-- params: [date_from, date_to, segment, lead_source]
-- viz: {graph.dimensions: [month, component], graph.metrics: [amount_usd], stackable.stack_type: stacked}
select
    r.revenue_month as month,
    c.component,
    sum(c.amount_usd) as amount_usd
from analytics.fct_revenue_monthly as r
inner join analytics.dim_accounts as a on r.account_id = a.account_id
cross join lateral (
    values
        ('platform_fee', r.platform_fee_usd),
        ('usage_fee', r.usage_fee_usd),
        ('fx_margin', r.fx_margin_usd),
        ('true_up', r.true_up_usd)
) as c (component, amount_usd)
where 1 = 1
  [[ and r.revenue_month >= date_trunc('month', cast({{date_from}} as date)) ]]
  [[ and r.revenue_month <= {{date_to}} ]]
  [[ and a.segment = {{segment}} ]]
  [[ and a.lead_source = {{lead_source}} ]]
group by 1, 2
order by 1, 2

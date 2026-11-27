-- name: Revenue bridge by month
-- collection: Revenue
-- display: bar
-- params: [date_from, date_to, segment, lead_source]
-- description: How net revenue moved from the previous month: new, reactivation, expansion, contraction, churn.
-- viz: {graph.dimensions: [month, category], graph.metrics: [amount_usd], stackable.stack_type: stacked}
select revenue_month as month, category, sum(amount_usd) as amount_usd
from analytics.fct_revenue_bridge
where 1 = 1
  [[ and revenue_month >= date_trunc('month', cast({{date_from}} as date)) ]]
  [[ and revenue_month <= {{date_to}} ]]
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]
group by 1, 2
order by 1, 2

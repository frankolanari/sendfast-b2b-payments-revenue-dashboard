-- name: 12-month net revenue per account by lead source
-- collection: Revenue
-- display: bar
-- params: [segment, lead_source]
-- description: Median net revenue in an account's first 12 months from go-live. Click a bar to filter to that lead source.
-- viz: {graph.dimensions: [lead_source], graph.metrics: [median_net_revenue_first_12m_usd]}
select
    lead_source,
    percentile_cont(0.5) within group (order by net_revenue_first_12m_usd) as median_net_revenue_first_12m_usd,
    count(*) as accounts
from analytics.dim_accounts
where is_customer and not is_excluded and net_revenue_first_12m_usd is not null
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]
group by lead_source
order by lead_source

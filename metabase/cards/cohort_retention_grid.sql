-- name: Retention by go-live cohort (grid)
-- collection: Revenue
-- display: table
-- params: [segment, lead_source]
-- description: Go-live quarter x months since go-live (0-12), complete months only: accounts, still active, logo retention, revenue in the month and to date, NRR and GRR against month 1. Feeds the cohort heatmap.
with accounts as (
    select *
    from analytics.fct_cohort_account_months
    where 1 = 1
      [[ and segment = {{segment}} ]]
      [[ and lead_source = {{lead_source}} ]]
),
sizes as (
    select cohort_quarter, count(distinct account_id) as cohort_accounts
    from accounts
    group by cohort_quarter
)
select
    a.cohort_quarter,
    a.months_since_live,
    s.cohort_accounts,
    count(*) filter (where a.is_active) as active_accounts,
    count(*) filter (where a.is_active) * 1.0 / s.cohort_accounts as logo_retention,
    sum(a.net_revenue_usd) as net_revenue_usd,
    sum(sum(a.net_revenue_usd)) over (partition by a.cohort_quarter order by a.months_since_live) as revenue_to_date_usd,
    sum(a.net_revenue_usd) / nullif(sum(a.base_revenue_usd), 0) as nrr
from accounts as a
inner join sizes as s on a.cohort_quarter = s.cohort_quarter
where a.months_since_live <= 12
group by a.cohort_quarter, a.months_since_live, s.cohort_accounts
-- complete cells only: every account in the (filtered) cohort has reached this month
having count(*) = s.cohort_accounts
order by a.cohort_quarter, a.months_since_live

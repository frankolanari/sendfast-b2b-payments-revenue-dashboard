-- Cohort quarter (go-live quarter, inside the data window) x months since go-live:
-- logo retention, NRR and GRR against each cohort's month-1 revenue (month 0 is partial).
-- Active = a succeeded transaction in the month and no contract end before the month starts.

with accounts as (

    select * from {{ ref('dim_accounts') }}
    where is_customer and not is_excluded and live_date >= {{ window_start() }}

),

with_base as (

    select * from {{ ref('fct_cohort_account_months') }}

),

cohort_sizes as (

    select
        cohort_quarter,
        count(*) as cohort_accounts,
        -- The latest go-live month in the cohort: a month-since-live is complete only if even
        -- this account had reached it by the as-of month (else the cell is right-censored).
        max({{ month_of('live_date') }}) as last_live_month
    from accounts
    group by cohort_quarter

)

select
    with_base.cohort_quarter,
    with_base.months_since_live,
    cohort_sizes.cohort_accounts,
    sum(case when with_base.is_active then 1 else 0 end) as active_accounts,
    sum(case when with_base.is_active then 1 else 0 end) * 1.0 / cohort_sizes.cohort_accounts as logo_retention,
    sum(with_base.net_revenue_usd) as net_revenue_usd,
    sum(with_base.base_revenue_usd) as base_revenue_usd,
    sum(with_base.net_revenue_usd) / nullif(sum(with_base.base_revenue_usd), 0) as nrr,
    sum(least(with_base.net_revenue_usd, with_base.base_revenue_usd))
    / nullif(sum(with_base.base_revenue_usd), 0) as grr,
    cohort_sizes.last_live_month + cast(with_base.months_since_live as integer) * interval '1 month'
    <= {{ month_of(as_of_date()) }} as is_complete
from with_base
inner join cohort_sizes
    on with_base.cohort_quarter = cohort_sizes.cohort_quarter
group by
    with_base.cohort_quarter,
    with_base.months_since_live,
    cohort_sizes.cohort_accounts,
    cohort_sizes.last_live_month

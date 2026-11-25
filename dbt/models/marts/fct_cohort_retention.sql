-- Cohort quarter (go-live quarter, inside the data window) x months since go-live:
-- logo retention, NRR and GRR against each cohort's month-1 revenue (month 0 is partial).
-- Active = a succeeded transaction in the month and no contract end before the month starts.

with accounts as (

    select * from {{ ref('dim_accounts') }}
    where is_customer and not is_excluded and live_date >= {{ window_start() }}

),

months as (

    select distinct month_start
    from {{ ref('dim_date') }}
    where is_in_data_window

),

active_months as (

    select distinct
        account_id,
        activity_month
    from {{ ref('fct_account_daily') }}
    where succeeded_count > 0

),

revenue as (

    select * from {{ ref('fct_revenue_monthly') }}

),

grid as (

    select
        accounts.account_id,
        accounts.cohort_quarter,
        months.month_start,
        (extract(year from months.month_start) - extract(year from accounts.live_date)) * 12
        + extract(month from months.month_start) - extract(month from accounts.live_date) as months_since_live,
        accounts.contract_end_date
    from accounts
    inner join months
        on months.month_start >= {{ month_of('accounts.live_date') }}

),

per_account as (

    select
        grid.account_id,
        grid.cohort_quarter,
        grid.months_since_live,
        coalesce(revenue.net_revenue_usd, 0) as net_revenue_usd,
        active_months.account_id is not null
        and (grid.contract_end_date is null or grid.contract_end_date >= grid.month_start) as is_active
    from grid
    left join active_months
        on
            grid.account_id = active_months.account_id
            and grid.month_start = active_months.activity_month
    left join revenue
        on
            grid.account_id = revenue.account_id
            and grid.month_start = revenue.revenue_month

),

with_base as (

    select
        per_account.account_id,
        per_account.cohort_quarter,
        per_account.months_since_live,
        per_account.net_revenue_usd,
        per_account.is_active,
        base.net_revenue_usd as base_revenue_usd
    from per_account
    left join per_account as base
        on
            per_account.account_id = base.account_id
            and base.months_since_live = 1

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

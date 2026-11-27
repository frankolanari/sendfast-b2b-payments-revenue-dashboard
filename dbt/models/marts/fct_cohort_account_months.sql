-- Account x month since go-live, for accounts that went live inside the data window: the
-- grain behind fct_cohort_retention, so cohort charts can filter by segment or lead source.
-- A row exists only once the account has reached that month by the as-of date.
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
        accounts.segment,
        accounts.lead_source,
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
        grid.segment,
        grid.lead_source,
        grid.month_start,
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

)

select
    per_account.account_id,
    per_account.cohort_quarter,
    per_account.segment,
    per_account.lead_source,
    per_account.month_start,
    per_account.months_since_live,
    per_account.net_revenue_usd,
    per_account.is_active,
    base.net_revenue_usd as base_revenue_usd
from per_account
left join per_account as base
    on
        per_account.account_id = base.account_id
        and base.months_since_live = 1

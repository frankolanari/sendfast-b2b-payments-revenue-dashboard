-- Account x month from go-live (or the window start) until contract end or the as-of month:
-- failure rate, dispute rate, volume trend, health score and revenue at risk.
-- At risk (same rule as the answer key): live for 3 full months before this one, not
-- contract-churned by the month end, and either volume < at_risk_volume_drop x its 3-month
-- average, or failure rate > at_risk_failure_rate on at least at_risk_min_transactions.

with lifecycle as (

    select
        *,
        coalesce(crm_account_id, 'billing:' || billing_customer_id) as account_id
    from {{ ref('int_account_lifecycle') }}
    where not is_excluded and live_date is not null

),

months as (

    select distinct month_start
    from {{ ref('dim_date') }}
    where is_in_data_window

),

daily as (

    select
        account_id,
        activity_month,
        sum(txn_count) as txn_count,
        sum(failed_count) as failed_count,
        sum(succeeded_count) as succeeded_count,
        sum(volume_usd) as volume_usd,
        sum(disputes_opened + returns_opened) as disputes_opened
    from {{ ref('fct_account_daily') }}
    group by account_id, activity_month

),

revenue as (

    select * from {{ ref('fct_revenue_monthly') }}

),

grid as (

    select
        lifecycle.account_id,
        lifecycle.live_date,
        lifecycle.contract_end_date,
        months.month_start
    from lifecycle
    inner join months
        on
            months.month_start >= {{ month_of('lifecycle.live_date') }}
            and months.month_start
            <= coalesce({{ month_of('lifecycle.contract_end_date') }}, {{ month_of(as_of_date()) }})

),

monthly as (

    select
        grid.account_id,
        grid.month_start,
        grid.live_date,
        grid.contract_end_date,
        coalesce(daily.txn_count, 0) as txn_count,
        coalesce(daily.failed_count, 0) as failed_count,
        coalesce(daily.volume_usd, 0) as volume_usd,
        coalesce(daily.disputes_opened, 0) as disputes_opened,
        coalesce(daily.succeeded_count, 0) as succeeded_count,
        coalesce(revenue.net_revenue_usd, 0) as net_revenue_usd
    from grid
    left join daily
        on
            grid.account_id = daily.account_id
            and grid.month_start = daily.activity_month
    left join revenue
        on
            grid.account_id = revenue.account_id
            and grid.month_start = revenue.revenue_month

),

windowed as (

    select
        account_id,
        month_start,
        live_date,
        contract_end_date,
        txn_count,
        failed_count,
        volume_usd,
        disputes_opened,
        succeeded_count,
        net_revenue_usd,
        sum(volume_usd) over prev_3m / 3 as avg_volume_prev_3m_usd,
        sum(net_revenue_usd) over prev_3m / 3 as avg_revenue_prev_3m_usd
    from monthly
    window prev_3m as (partition by account_id order by month_start rows between 3 preceding and 1 preceding)

),

scored as (

    select
        account_id,
        month_start,
        txn_count,
        failed_count,
        volume_usd,
        disputes_opened,
        net_revenue_usd,
        avg_volume_prev_3m_usd,
        avg_revenue_prev_3m_usd,
        case when txn_count > 0 then failed_count * 1.0 / txn_count end as failure_rate,
        case when succeeded_count > 0 then disputes_opened * 1.0 / succeeded_count end as dispute_rate,
        volume_usd / nullif(avg_volume_prev_3m_usd, 0) as volume_trend,
        live_date < cast(month_start - interval '3 months' as date)
        and (contract_end_date is null or contract_end_date > cast(month_start + interval '1 month - 1 day' as date))
        and (
            (avg_volume_prev_3m_usd > 0 and volume_usd < {{ var("at_risk_volume_drop") }} * avg_volume_prev_3m_usd)
            or (
                txn_count >= {{ var("at_risk_min_transactions") }}
                and failed_count * 1.0 / nullif(txn_count, 0) > {{ var("at_risk_failure_rate") }}
            )
        ) as is_at_risk
    from windowed

)

select
    account_id,
    month_start,
    txn_count,
    failed_count,
    failure_rate,
    volume_usd,
    avg_volume_prev_3m_usd,
    volume_trend,
    disputes_opened,
    dispute_rate,
    net_revenue_usd,
    avg_revenue_prev_3m_usd,
    is_at_risk,
    case when is_at_risk then avg_revenue_prev_3m_usd else 0 end as revenue_at_risk_usd,
    greatest(
        0,
        100
        - least(50, round(coalesce(failure_rate, 0) * 500))
        - case when volume_trend < 0.8 then least(50, round((1 - volume_trend) * 100)) else 0 end
    ) as health_score,
    case
        when is_at_risk then 'at_risk'
        when coalesce(failure_rate, 0) > 0.06 or volume_trend < 0.8 then 'watch'
        else 'healthy'
    end as health_status
from scored

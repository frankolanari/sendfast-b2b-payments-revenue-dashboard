-- One row per dated event in an account's life, lead to risk: the Account 360 timeline.
-- Events up to the as-of date only. event_order breaks ties on the same day.

with accounts as (

    select * from {{ ref('dim_accounts') }}
    where not is_excluded

),

leads as (

    select * from {{ ref('fct_leads_funnel') }}

),

opportunities as (

    select * from {{ ref('fct_opportunities') }}

),

pricing as (

    select * from {{ ref('stg_rates__pricing_rates') }}

),

health as (

    select
        account_id,
        month_start,
        is_at_risk,
        revenue_at_risk_usd,
        lag(is_at_risk) over (partition by account_id order by month_start) as was_at_risk
    from {{ ref('fct_account_health_monthly') }}

),

events as (

    select
        account_id,
        created_date as event_date,
        1 as event_order,
        'lead' as event_type,
        'Lead created (' || lead_source || ')' as title,
        cast(null as numeric) as amount_usd
    from leads

    union all

    select
        account_id,
        created_date as event_date,
        2 as event_order,
        'deal' as event_type,
        'Deal opened' as title,
        amount_usd
    from opportunities

    union all

    select
        account_id,
        close_date as event_date,
        3 as event_order,
        case when is_won then 'won' else 'lost' end as event_type,
        case when is_won then 'Deal won' else 'Deal lost' end as title,
        amount_usd
    from opportunities
    where is_closed and not has_invalid_close_date

    union all

    select
        account_id,
        live_date as event_date,
        4 as event_order,
        'live' as event_type,
        'Went live' as title,
        null as amount_usd
    from accounts

    union all

    select
        account_id,
        won_date + activation_days as event_date,
        5 as event_order,
        'first_payment' as event_type,
        'First payment, ' || activation_days || ' days after winning' as title,
        null as amount_usd
    from accounts
    where activation_days is not null

    union all

    select
        accounts.account_id,
        pricing.effective_from as event_date,
        6 as event_order,
        'pricing' as event_type,
        'Pricing: ' || pricing.fee_bps || ' bps fee, ' || pricing.fx_margin_bps || ' bps FX margin' as title,
        pricing.platform_fee_usd as amount_usd
    from pricing
    inner join accounts
        on pricing.billing_customer_id = accounts.billing_customer_id

    union all

    select
        account_id,
        month_start as event_date,
        7 as event_order,
        'risk' as event_type,
        'Flagged at risk' as title,
        revenue_at_risk_usd as amount_usd
    from health
    where is_at_risk and not coalesce(was_at_risk, false)

    union all

    select
        account_id,
        churn_date as event_date,
        8 as event_order,
        'churn' as event_type,
        case when churn_type = 'silent' then 'Stopped paying (silent churn)' else 'Contract ended' end as title,
        null as amount_usd
    from accounts

)

select
    account_id,
    event_date,
    event_order,
    event_type,
    title,
    amount_usd
from events
where account_id is not null and event_date is not null and event_date <= {{ as_of_date() }}

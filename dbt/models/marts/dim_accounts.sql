-- One unified account: every CRM account (prospect or customer), plus billing customers the
-- CRM can't be matched to (account_id 'billing:<customer id>'). Excluded accounts stay here,
-- flagged; the fact tables leave them out.

with crm_accounts as (

    select * from {{ ref('stg_crm__accounts') }}

),

lifecycle as (

    select * from {{ ref('int_account_lifecycle') }}

),

customers as (

    select * from {{ ref('stg_billing__customers') }}

),

merchants as (

    select * from {{ ref('stg_ledger__merchants') }}

),

health_now as (

    select
        account_id,
        health_status
    from {{ ref('fct_account_health_monthly') }}
    where month_start = {{ month_of(as_of_date()) }}

),

-- Net revenue in the first 12 calendar months from the go-live month, for accounts that went
-- live inside the data window early enough to have had all 12 months by the as-of month.
first_year_revenue as (

    select
        revenue.account_id,
        sum(revenue.net_revenue_usd) as net_revenue_first_12m_usd
    from {{ ref('fct_revenue_monthly') }} as revenue
    inner join {{ ref('int_account_lifecycle') }} as lifecycle
        on revenue.billing_customer_id = lifecycle.billing_customer_id
    where
        revenue.revenue_month >= {{ month_of('lifecycle.live_date') }}
        and revenue.revenue_month < {{ month_of('lifecycle.live_date') }} + interval '12 months'
    group by revenue.account_id

),

first_won_source as (

    select distinct on (account_id)
        account_id,
        coalesce(lead_source, 'unknown') as lead_source
    from {{ ref('stg_crm__opportunities') }}
    where is_won
    order by account_id asc, close_date asc, opportunity_id asc

),

crm_side as (

    select
        crm_accounts.account_id,
        crm_accounts.account_id as crm_account_id,
        lifecycle.billing_customer_id,
        lifecycle.merchant_id,
        crm_accounts.name,
        crm_accounts.domain,
        crm_accounts.segment,
        crm_accounts.country,
        crm_accounts.industry,
        crm_accounts.owner_id,
        coalesce(first_won_source.lead_source, 'unknown') as lead_source,
        coalesce(lifecycle.match_method, 'crm_only') as match_method,
        lifecycle.billing_customer_id is not null as is_customer,
        coalesce(
            lifecycle.exclusion_reason,
            {{ exclusion_reason('crm_accounts.name', 'crm_accounts.domain') }}
        ) as exclusion_reason,
        lifecycle.won_date,
        lifecycle.live_date,
        lifecycle.cohort_quarter,
        lifecycle.activation_days,
        lifecycle.contract_end_date,
        lifecycle.churn_type,
        lifecycle.churn_date
    from crm_accounts
    left join lifecycle
        on crm_accounts.account_id = lifecycle.crm_account_id
    left join first_won_source
        on crm_accounts.account_id = first_won_source.account_id

),

billing_only as (

    select
        'billing:' || lifecycle.billing_customer_id as account_id,
        cast(null as text) as crm_account_id,
        lifecycle.billing_customer_id,
        lifecycle.merchant_id,
        customers.name,
        merchants.domain,
        cast(null as text) as segment,
        cast(null as text) as country,
        cast(null as text) as industry,
        cast(null as text) as owner_id,
        'unknown' as lead_source,
        lifecycle.match_method,
        true as is_customer,
        lifecycle.exclusion_reason,
        lifecycle.won_date,
        lifecycle.live_date,
        lifecycle.cohort_quarter,
        lifecycle.activation_days,
        lifecycle.contract_end_date,
        lifecycle.churn_type,
        lifecycle.churn_date
    from lifecycle
    inner join customers
        on lifecycle.billing_customer_id = customers.customer_id
    left join merchants
        on lifecycle.merchant_id = merchants.merchant_id
    where lifecycle.crm_account_id is null

),

unified as (

    select * from crm_side
    union all
    select * from billing_only

)

select
    unified.account_id,
    unified.crm_account_id,
    unified.billing_customer_id,
    unified.merchant_id,
    unified.name,
    unified.domain,
    unified.segment,
    unified.country,
    unified.industry,
    unified.owner_id,
    unified.lead_source,
    unified.match_method,
    unified.is_customer,
    unified.exclusion_reason,
    unified.exclusion_reason is not null as is_excluded,
    unified.won_date,
    unified.live_date,
    unified.cohort_quarter,
    unified.activation_days,
    unified.contract_end_date,
    unified.churn_type,
    unified.churn_date,
    case
        when unified.activation_days is null then null
        when unified.activation_days <= {{ var("activation_slow_days") }} then 'fast'
        else 'slow'
    end as activation_speed,
    case
        when
            unified.live_date >= {{ window_start() }}
            and unified.live_date < {{ month_of(as_of_date()) }} - interval '11 months'
            then coalesce(first_year_revenue.net_revenue_first_12m_usd, 0)
    end as net_revenue_first_12m_usd,
    health_now.health_status
from unified
left join health_now
    on unified.account_id = health_now.account_id
left join first_year_revenue
    on unified.account_id = first_year_revenue.account_id

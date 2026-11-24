-- One row per billing customer (orphan merchants excluded): won, live, activation, churn.

{{ config(materialized='table') }}

with identity_map as (

    select * from {{ ref('int_identity_map') }}
    where billing_customer_id is not null

),

merchants as (

    select * from {{ ref('stg_ledger__merchants') }}

),

opportunities as (

    select * from {{ ref('stg_crm__opportunities') }}

),

subscriptions as (

    select * from {{ ref('stg_billing__subscriptions') }}

),

succeeded as (

    select * from {{ ref('int_transactions_enriched') }}
    where status = 'succeeded'

),

first_won as (

    select
        account_id,
        min(close_date) as won_date
    from opportunities
    where is_won
    group by account_id

),

activity as (

    select
        merchant_id,
        min(txn_date) as first_succeeded_date,
        max(txn_date) as last_succeeded_date
    from succeeded
    group by merchant_id

),

contract_ends as (

    select
        customer_id,
        max(ended_at) as ended_at
    from subscriptions
    where ended_at is not null
    group by customer_id

),

joined as (

    select
        identity_map.billing_customer_id,
        identity_map.crm_account_id,
        identity_map.merchant_id,
        identity_map.match_method,
        identity_map.exclusion_reason,
        identity_map.is_excluded,
        first_won.won_date,
        merchants.live_at,
        {{ utc_date('merchants.live_at') }} as live_date,
        activity.first_succeeded_date,
        activity.last_succeeded_date,
        {{ utc_date('contract_ends.ended_at') }} as contract_end_date
    from identity_map
    left join merchants
        on identity_map.merchant_id = merchants.merchant_id
    left join first_won
        on identity_map.crm_account_id = first_won.account_id
    left join activity
        on identity_map.merchant_id = activity.merchant_id
    left join contract_ends
        on identity_map.billing_customer_id = contract_ends.customer_id

)

select
    billing_customer_id,
    crm_account_id,
    merchant_id,
    match_method,
    exclusion_reason,
    is_excluded,
    won_date,
    live_at,
    live_date,
    to_char(live_date, 'YYYY"Q"Q') as cohort_quarter,
    first_succeeded_date,
    last_succeeded_date,
    first_succeeded_date - won_date as activation_days,
    contract_end_date,
    case
        when contract_end_date is not null then 'contract'
        when last_succeeded_date <= {{ as_of_date() }} - {{ var("silent_churn_days") }} then 'silent'
    end as churn_type,
    case
        when contract_end_date is not null then contract_end_date
        when last_succeeded_date <= {{ as_of_date() }} - {{ var("silent_churn_days") }}
            then last_succeeded_date
    end as churn_date
from joined

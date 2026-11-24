-- One row per transaction: identity, USD amount at the transaction date's FX rate, and the
-- usage fee and FX margin from the pricing effective on that date. Fees only on succeeded.

{{ config(materialized='table') }}

with transactions as (

    select * from {{ ref('stg_ledger__transactions') }}

),

identity_map as (

    select * from {{ ref('int_identity_map') }}

),

fx as (

    select * from {{ ref('stg_rates__fx_rates') }}
    where base_currency = 'USD'

),

pricing as (

    select * from {{ ref('stg_rates__pricing_rates') }}

),

dated as (

    select
        transactions.transaction_id,
        transactions.merchant_id,
        identity_map.billing_customer_id,
        identity_map.crm_account_id,
        identity_map.is_excluded,
        transactions.created_at,
        {{ utc_date('transactions.created_at') }} as txn_date,
        transactions.status,
        transactions.rail,
        transactions.corridor,
        transactions.source_currency,
        transactions.dest_currency,
        transactions.amount
    from transactions
    inner join identity_map
        on transactions.merchant_id = identity_map.merchant_id

),

converted as (

    select
        dated.transaction_id,
        dated.merchant_id,
        dated.billing_customer_id,
        dated.crm_account_id,
        dated.is_excluded,
        dated.created_at,
        dated.txn_date,
        dated.status,
        dated.rail,
        dated.corridor,
        dated.source_currency,
        dated.dest_currency,
        dated.amount,
        case when dated.source_currency = 'USD' then 1 else fx.rate end as fx_rate
    from dated
    left join fx
        on
            dated.txn_date = fx.rate_date
            and dated.source_currency = fx.quote_currency

),

priced as (

    select
        converted.transaction_id,
        converted.merchant_id,
        converted.billing_customer_id,
        converted.crm_account_id,
        converted.is_excluded,
        converted.created_at,
        converted.txn_date,
        converted.status,
        converted.rail,
        converted.corridor,
        converted.source_currency,
        converted.dest_currency,
        converted.amount,
        converted.fx_rate,
        pricing.fee_bps,
        pricing.fx_margin_bps,
        converted.amount / converted.fx_rate as amount_usd,
        converted.source_currency != converted.dest_currency as is_cross_currency
    from converted
    left join pricing
        on
            converted.billing_customer_id = pricing.billing_customer_id
            and converted.txn_date >= pricing.effective_from
            and converted.txn_date <= coalesce(pricing.effective_to, cast('9999-12-31' as date))

)

select
    transaction_id,
    merchant_id,
    billing_customer_id,
    crm_account_id,
    coalesce(crm_account_id, 'billing:' || billing_customer_id) as account_id,
    is_excluded,
    created_at,
    txn_date,
    {{ month_of('txn_date') }} as txn_month,
    status,
    rail,
    corridor,
    source_currency,
    dest_currency,
    is_cross_currency,
    amount,
    fx_rate,
    amount_usd,
    fee_bps,
    fx_margin_bps,
    case when status = 'succeeded' then amount_usd * fee_bps / 10000 else 0 end as usage_fee_usd,
    case
        when status = 'succeeded' and is_cross_currency then amount_usd * fx_margin_bps / 10000
        else 0
    end as fx_margin_usd
from priced

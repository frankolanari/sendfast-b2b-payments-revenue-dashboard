-- Account x day x corridor x rail: volume, counts, failures, fees, disputes and returns.
-- Rail is part of the grain (finer than the plan's account x day x corridor) for page 3.

with transactions as (

    select * from {{ ref('int_transactions_enriched') }}
    where not is_excluded

),

disputes as (

    select * from {{ ref('stg_ledger__disputes') }}

),

txn_rows as (

    select
        account_id,
        billing_customer_id,
        txn_date as activity_date,
        corridor,
        rail,
        1 as txn_count,
        case when status = 'succeeded' then 1 else 0 end as succeeded_count,
        case when status = 'failed' then 1 else 0 end as failed_count,
        case when status = 'reversed' then 1 else 0 end as reversed_count,
        case when status = 'succeeded' then amount_usd else 0 end as volume_usd,
        usage_fee_usd,
        fx_margin_usd,
        0 as disputes_opened,
        0 as returns_opened
    from transactions

),

dispute_rows as (

    select
        transactions.account_id,
        transactions.billing_customer_id,
        {{ utc_date('disputes.opened_at') }} as activity_date,
        transactions.corridor,
        transactions.rail,
        0 as txn_count,
        0 as succeeded_count,
        0 as failed_count,
        0 as reversed_count,
        0 as volume_usd,
        0 as usage_fee_usd,
        0 as fx_margin_usd,
        case when disputes.dispute_type = 'dispute' then 1 else 0 end as disputes_opened,
        case when disputes.dispute_type = 'return' then 1 else 0 end as returns_opened
    from disputes
    inner join transactions
        on disputes.transaction_id = transactions.transaction_id

),

all_rows as (

    select * from txn_rows
    union all
    select * from dispute_rows

)

select
    account_id,
    billing_customer_id,
    activity_date,
    {{ month_of('activity_date') }} as activity_month,
    corridor,
    rail,
    sum(txn_count) as txn_count,
    sum(succeeded_count) as succeeded_count,
    sum(failed_count) as failed_count,
    sum(reversed_count) as reversed_count,
    sum(volume_usd) as volume_usd,
    sum(usage_fee_usd) as usage_fee_usd,
    sum(fx_margin_usd) as fx_margin_usd,
    sum(disputes_opened) as disputes_opened,
    sum(returns_opened) as returns_opened
from all_rows
group by account_id, billing_customer_id, activity_date, corridor, rail

with source as (

    select * from {{ source('ledger', 'transactions') }}

),

normalized as (

    select
        transaction_id,
        merchant_id,
        created_at,
        status,
        rail,
        {{ normalize_currency('source_currency') }} as source_currency,
        {{ normalize_currency('dest_currency') }} as dest_currency,
        amount_minor,
        failure_reason
    from source

)

select
    transaction_id,
    merchant_id,
    created_at,
    status,
    rail,
    source_currency,
    dest_currency,
    source_currency || '-' || dest_currency as corridor,
    {{ minor_to_major('amount_minor', 'source_currency') }} as amount,
    source_currency as currency,
    failure_reason
from normalized

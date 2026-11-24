with source as (

    select * from {{ source('ledger', 'disputes') }}

)

select
    dispute_id,
    transaction_id,
    kind as dispute_type,
    opened_at,
    resolved_at,
    outcome,
    {{ minor_to_major('amount_minor', 'currency') }} as amount,
    {{ normalize_currency('currency') }} as currency
from source

with source as (

    select * from {{ source('billing', 'invoices') }}

)

select
    id as invoice_id,
    customer as customer_id,
    subscription as subscription_id,
    status,
    {{ normalize_currency('currency') }} as currency,
    {{ minor_to_major('total', 'currency') }} as total,
    {{ minor_to_major('amount_paid', 'currency') }} as amount_paid,
    to_timestamp(period_start) as period_start,
    to_timestamp(period_end) as period_end,
    to_timestamp(created) as created_at
from source

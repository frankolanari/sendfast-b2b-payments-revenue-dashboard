with source as (

    select * from {{ source('billing', 'subscriptions') }}

)

select
    id as subscription_id,
    customer as customer_id,
    status,
    {{ minor_to_major('plan_amount', 'currency') }} as monthly_amount,
    {{ normalize_currency('currency') }} as currency,
    to_timestamp(start_date) as started_at,
    to_timestamp(canceled_at) as canceled_at,
    to_timestamp(ended_at) as ended_at
from source

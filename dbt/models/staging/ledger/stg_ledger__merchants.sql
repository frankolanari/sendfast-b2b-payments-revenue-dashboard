with source as (

    select * from {{ source('ledger', 'merchants') }}

)

select
    merchant_id,
    billing_customer_id,
    legal_name,
    {{ normalize_domain('website') }} as domain,
    went_live_at as live_at
from source

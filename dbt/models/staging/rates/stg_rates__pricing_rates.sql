with source as (

    select * from {{ source('rates', 'pricing_rates') }}

)

select
    billing_customer_id,
    fee_bps,
    fx_margin_bps,
    platform_fee_usd,
    min_commit_usd,
    effective_from,
    effective_to
from source

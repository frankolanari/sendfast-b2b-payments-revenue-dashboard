with source as (

    select * from {{ source('rates', 'fx_rates') }}

)

select
    rate_date,
    {{ normalize_currency('base_currency') }} as base_currency,
    {{ normalize_currency('quote_currency') }} as quote_currency,
    rate,
    source
from source

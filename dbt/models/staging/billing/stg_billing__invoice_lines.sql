with source as (

    select * from {{ source('billing', 'invoice_lines') }}

)

select
    id as invoice_line_id,
    invoice as invoice_id,
    case type
        when 'subscription' then 'platform_fee'
        when 'invoiceitem' then 'usage_true_up'
        else type
    end as line_type,
    {{ minor_to_major('amount', 'currency') }} as amount,
    {{ normalize_currency('currency') }} as currency,
    to_timestamp(period_start) as period_start,
    to_timestamp(period_end) as period_end
from source

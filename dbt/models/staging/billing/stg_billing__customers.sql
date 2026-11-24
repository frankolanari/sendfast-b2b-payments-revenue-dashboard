with source as (

    select * from {{ source('billing', 'customers') }}

)

select
    id as customer_id,
    name,
    email,
    to_timestamp(created) as created_at
from source

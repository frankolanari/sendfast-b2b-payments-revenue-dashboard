select
    user_id as rep_id,
    name,
    team,
    active
from {{ ref('stg_crm__users') }}

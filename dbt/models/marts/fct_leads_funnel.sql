-- One row per lead. Excluded (test/internal) accounts are left out.

with leads as (

    select * from {{ ref('stg_crm__leads') }}

),

accounts as (

    select * from {{ ref('dim_accounts') }}

)

select
    leads.lead_id,
    leads.account_id,
    leads.contact_id,
    -- The linked account's segment and owner, so lead conversion can follow those filters.
    accounts.segment,
    accounts.owner_id,
    coalesce(leads.lead_source, 'unknown') as lead_source,
    leads.created_at,
    {{ utc_date('leads.created_at') }} as created_date,
    leads.converted_at,
    leads.converted_at is not null as is_converted
from leads
left join accounts
    on leads.account_id = accounts.account_id
where not coalesce(accounts.is_excluded, false)

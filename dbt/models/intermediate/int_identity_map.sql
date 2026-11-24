-- One row per ledger merchant: merchant <-> billing customer <-> CRM account.
-- Match by the Stripe id stored on the CRM account; otherwise by a unique normalised domain.
-- Exclusions (cleaning): orphan merchants (no billing customer), test and internal accounts.

with merchants as (

    select * from {{ ref('stg_ledger__merchants') }}

),

customers as (

    select * from {{ ref('stg_billing__customers') }}

),

crm_accounts as (

    select * from {{ ref('stg_crm__accounts') }}

),

explicit_refs as (

    select
        billing_customer_ref as billing_customer_id,
        min(account_id) as crm_account_id
    from crm_accounts
    where billing_customer_ref is not null
    group by billing_customer_ref
    having count(*) = 1

),

unique_domains as (

    select
        domain,
        min(account_id) as crm_account_id
    from crm_accounts
    where domain is not null
    group by domain
    having count(*) = 1

),

matched as (

    select
        merchants.merchant_id,
        merchants.billing_customer_id,
        customers.name as customer_name,
        split_part(customers.email, '@', 2) as email_domain,
        explicit_refs.crm_account_id as explicit_crm_account_id,
        unique_domains.crm_account_id as domain_crm_account_id
    from merchants
    left join customers
        on merchants.billing_customer_id = customers.customer_id
    left join explicit_refs
        on merchants.billing_customer_id = explicit_refs.billing_customer_id
    left join unique_domains
        on
            merchants.domain = unique_domains.domain
            and merchants.billing_customer_id is not null

),

resolved as (

    select
        matched.merchant_id,
        matched.billing_customer_id,
        matched.customer_name,
        matched.email_domain,
        coalesce(matched.explicit_crm_account_id, matched.domain_crm_account_id) as crm_account_id,
        case
            when matched.explicit_crm_account_id is not null then 'explicit_id'
            when matched.domain_crm_account_id is not null then 'domain'
            else 'unmatched'
        end as match_method
    from matched

),

classified as (

    select
        resolved.merchant_id,
        resolved.billing_customer_id,
        resolved.crm_account_id,
        resolved.match_method,
        coalesce(
            case when resolved.billing_customer_id is null then 'orphan' end,
            {{ exclusion_reason('resolved.customer_name', 'resolved.email_domain') }},
            {{ exclusion_reason('crm_accounts.name', 'crm_accounts.domain') }}
        ) as exclusion_reason
    from resolved
    left join crm_accounts
        on resolved.crm_account_id = crm_accounts.account_id

)

select
    merchant_id,
    billing_customer_id,
    crm_account_id,
    match_method,
    exclusion_reason,
    exclusion_reason is not null as is_excluded
from classified

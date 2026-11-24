-- One row per opportunity, current state. Excluded accounts are left out.

with opportunities as (

    select * from {{ ref('stg_crm__opportunities') }}

),

accounts as (

    select * from {{ ref('dim_accounts') }}

),

dated as (

    select
        opportunities.opportunity_id,
        opportunities.account_id,
        opportunities.owner_id,
        accounts.segment,
        coalesce(opportunities.lead_source, 'unknown') as lead_source,
        opportunities.amount_usd,
        opportunities.created_at,
        {{ utc_date('opportunities.created_at') }} as created_date,
        opportunities.close_date,
        opportunities.stage,
        opportunities.is_closed,
        opportunities.is_won
    from opportunities
    inner join accounts
        on opportunities.account_id = accounts.account_id
    where not accounts.is_excluded

)

select
    opportunity_id,
    account_id,
    owner_id,
    segment,
    lead_source,
    amount_usd,
    created_at,
    created_date,
    close_date,
    stage,
    is_closed,
    is_won,
    close_date < created_date as has_invalid_close_date,
    case when is_closed and close_date >= created_date then close_date - created_date end as sales_cycle_days,
    not is_closed as is_open,
    not is_closed and close_date < {{ as_of_date() }} as is_past_due
from dated

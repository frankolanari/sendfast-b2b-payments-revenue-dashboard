-- One row per opportunity, current state. Excluded accounts are left out.

with opportunities as (

    select * from {{ ref('stg_crm__opportunities') }}

),

accounts as (

    select * from {{ ref('dim_accounts') }}

),

furthest as (

    -- How far each deal got: the highest funnel rank among the stages it entered.
    select
        transitions.opportunity_id,
        max(stage_ranks.stage_rank) as furthest_stage_rank
    from {{ ref('int_opportunity_stage_transitions') }} as transitions
    inner join {{ ref('dim_stages') }} as stage_ranks
        on transitions.stage = stage_ranks.stage
    group by transitions.opportunity_id

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
        opportunities.is_won,
        furthest.furthest_stage_rank
    from opportunities
    left join furthest
        on opportunities.opportunity_id = furthest.opportunity_id
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
    furthest_stage_rank,
    close_date < created_date as has_invalid_close_date,
    case when is_closed and close_date >= created_date then close_date - created_date end as sales_cycle_days,
    not is_closed as is_open,
    not is_closed and close_date < {{ as_of_date() }} as is_past_due
from dated

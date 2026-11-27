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

reps as (

    select * from {{ ref('dim_reps') }}

),

dated as (

    select
        opportunities.opportunity_id,
        opportunities.account_id,
        opportunities.owner_id,
        accounts.segment,
        accounts.industry,
        reps.name as rep_name,
        reps.team as rep_team,
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
    left join reps
        on opportunities.owner_id = reps.rep_id
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
    industry,
    rep_name,
    rep_team,
    lead_source,
    amount_usd,
    created_at,
    created_date,
    close_date,
    stage,
    is_closed,
    is_won,
    furthest_stage_rank,
    case when is_won then 'won' when is_closed then 'lost' else 'open' end as outcome,
    close_date < created_date as has_invalid_close_date,
    case when is_closed and close_date >= created_date then close_date - created_date end as sales_cycle_days,
    not is_closed as is_open,
    not is_closed and close_date < {{ as_of_date() }} as is_past_due,
    -- Pipeline ageing, as of the as-of date: open deals only.
    case when not is_closed then {{ as_of_date() }} - created_date end as age_days,
    case
        when is_closed then null
        when {{ as_of_date() }} - created_date <= 30 then '0-30 days'
        when {{ as_of_date() }} - created_date <= 60 then '31-60 days'
        when {{ as_of_date() }} - created_date <= 90 then '61-90 days'
        else 'Over 90 days'
    end as age_bucket
from dated

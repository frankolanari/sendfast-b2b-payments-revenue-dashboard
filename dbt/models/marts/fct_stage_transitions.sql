-- One row per opportunity stage entry, for opportunities in the funnel fact.

with transitions as (

    select * from {{ ref('int_opportunity_stage_transitions') }}

),

opportunities as (

    select * from {{ ref('fct_opportunities') }}

)

select
    transitions.opportunity_id,
    opportunities.account_id,
    opportunities.owner_id,
    opportunities.lead_source,
    transitions.stage,
    transitions.stage_sequence,
    transitions.entered_at,
    transitions.exited_at,
    transitions.days_in_stage
from transitions
inner join opportunities
    on transitions.opportunity_id = opportunities.opportunity_id

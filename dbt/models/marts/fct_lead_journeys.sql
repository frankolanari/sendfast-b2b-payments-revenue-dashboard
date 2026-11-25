-- One row per lead, followed through to its deal: the lead -> opportunity -> won funnel.
-- The CRM contract has no lead id on the opportunity, so a converted lead is matched to the
-- opportunity of the same account created on the conversion date (one to one, in id order).
-- stage_reached: 0 = lead only, 1-5 = furthest funnel rank of its deal (dim_stages).

with leads as (

    select
        *,
        {{ utc_date('converted_at') }} as converted_date
    from {{ ref('fct_leads_funnel') }}

),

opportunities as (

    select * from {{ ref('fct_opportunities') }}

),

numbered_leads as (

    select
        lead_id,
        row_number() over (partition by account_id, converted_date order by lead_id) as nth
    from leads
    where is_converted

),

numbered_opportunities as (

    select
        opportunity_id,
        account_id,
        created_date,
        row_number() over (partition by account_id, created_date order by opportunity_id) as nth
    from opportunities

),

matched as (

    select
        numbered_leads.lead_id,
        numbered_opportunities.opportunity_id
    from leads
    inner join numbered_leads
        on leads.lead_id = numbered_leads.lead_id
    inner join numbered_opportunities
        on
            leads.account_id = numbered_opportunities.account_id
            and leads.converted_date = numbered_opportunities.created_date
            and numbered_leads.nth = numbered_opportunities.nth

)

select
    leads.lead_id,
    leads.account_id,
    leads.lead_source,
    leads.segment,
    coalesce(opportunities.owner_id, leads.owner_id) as owner_id,
    leads.created_date,
    leads.is_converted,
    opportunities.opportunity_id,
    coalesce(opportunities.furthest_stage_rank, 0) as stage_reached,
    opportunities.outcome,
    opportunities.amount_usd
from leads
left join matched
    on leads.lead_id = matched.lead_id
left join opportunities
    on matched.opportunity_id = opportunities.opportunity_id

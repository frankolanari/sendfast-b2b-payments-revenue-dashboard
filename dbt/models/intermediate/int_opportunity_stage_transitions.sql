-- One row per stage entry, with when the opportunity left it and how long it stayed.

with history as (

    select * from {{ ref('stg_crm__opportunity_stage_history') }}

),

sequenced as (

    select
        opportunity_id,
        stage,
        entered_at,
        lead(entered_at) over (partition by opportunity_id order by entered_at, stage) as exited_at,
        row_number() over (partition by opportunity_id order by entered_at, stage) as stage_sequence
    from history

)

select
    opportunity_id,
    stage,
    stage_sequence,
    entered_at,
    exited_at,
    extract(epoch from (exited_at - entered_at)) / 86400.0 as days_in_stage
from sequenced

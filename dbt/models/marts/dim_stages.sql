-- Opportunity stages in funnel order (the schema contract's allowed_values order).
-- lost is terminal and has no rank: a lost deal counts at the furthest stage it reached.

select
    stage,
    stage_rank,
    stage in ('discovery', 'qualified', 'proposal', 'negotiation') as is_open_stage
from (
    values
    ('discovery', 1),
    ('qualified', 2),
    ('proposal', 3),
    ('negotiation', 4),
    ('won', 5),
    ('lost', null)
) as stage_list (stage, stage_rank)

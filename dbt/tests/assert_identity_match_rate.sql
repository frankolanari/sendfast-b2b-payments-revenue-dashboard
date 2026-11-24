-- At least 95% of billing customers resolve to a CRM account (PLAN.md Stage 4).
select
    count(*) as billing_customers,
    avg(case when match_method != 'unmatched' then 1.0 else 0 end) as match_rate
from {{ ref('int_identity_map') }}
where billing_customer_id is not null
having avg(case when match_method != 'unmatched' then 1.0 else 0 end) < 0.95

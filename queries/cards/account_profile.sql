-- name: Account profile
-- collection: Accounts
-- display: object
-- params: [account_id]
-- required: [account_id]
select
    a.account_id, a.name, a.segment, a.country, a.industry, r.name as rep_name, a.lead_source,
    a.match_method, a.won_date, a.live_date, a.activation_days, a.contract_end_date, a.churn_type,
    a.churn_date, a.health_status
from analytics.dim_accounts as a
left join analytics.dim_reps as r on a.owner_id = r.rep_id
where a.account_id = {{account_id}}

-- name: Account opportunities
-- collection: Accounts
-- display: table
-- params: [account_id]
-- required: [account_id]
select opportunity_id, stage, lead_source, amount_usd, created_date, close_date, is_won, sales_cycle_days
from analytics.fct_opportunities
where account_id = {{account_id}}
order by created_date

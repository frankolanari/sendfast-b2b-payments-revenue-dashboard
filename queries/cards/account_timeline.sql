-- name: Account timeline
-- collection: Accounts
-- display: table
-- params: [account_id]
-- required: [account_id]
-- description: Every dated event for the account, newest first.
select event_date, event_type, title, amount_usd
from analytics.fct_account_timeline
where account_id = {{account_id}}
order by event_date desc, event_order desc

-- name: Filter values: accounts
-- collection: Filter values
-- display: table
-- params: []
select account_id, name as account_name
from analytics.dim_accounts
where is_customer and not is_excluded
order by name

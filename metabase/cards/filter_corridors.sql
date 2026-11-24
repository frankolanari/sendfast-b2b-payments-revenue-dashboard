-- name: Filter values: corridors
-- collection: Filter values
-- display: table
-- params: []
select distinct corridor
from analytics.fct_account_daily
order by corridor

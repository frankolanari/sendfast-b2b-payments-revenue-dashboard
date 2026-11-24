-- name: Filter values: reps
-- collection: Filter values
-- display: table
-- params: []
select rep_id, name as rep_name
from analytics.dim_reps
order by name

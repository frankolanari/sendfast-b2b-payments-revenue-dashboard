-- name: Retention by go-live cohort (grid)
-- collection: Revenue
-- display: table
-- params: []
-- description: Go-live quarter x months since go-live (0-12): logo retention, NRR and GRR against month 1, complete months only (no right-censored cells). Feeds the cohort heatmap.
select cohort_quarter, months_since_live, cohort_accounts, logo_retention, nrr, grr
from analytics.fct_cohort_retention
where months_since_live <= 12 and is_complete
order by cohort_quarter, months_since_live

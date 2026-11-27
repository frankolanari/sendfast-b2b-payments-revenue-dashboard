-- name: Logo retention by go-live cohort
-- collection: Revenue
-- display: line
-- params: []
-- description: Share of each go-live quarter's accounts still active, by months since go-live.
-- viz: {graph.dimensions: [months_since_live, cohort_quarter], graph.metrics: [logo_retention], column_settings: {'["name","logo_retention"]': {number_style: percent, decimals: 0}}}
select cohort_quarter, months_since_live, logo_retention, cohort_accounts
from analytics.fct_cohort_retention
order by cohort_quarter, months_since_live

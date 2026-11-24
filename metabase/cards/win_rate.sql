-- name: Win rate
-- collection: Pipeline
-- display: scalar
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Won / closed opportunities with close_date in the period.
-- viz: {column_settings: {'["name","win_rate"]': {number_style: percent, decimals: 1}}}
select avg(case when is_won then 1.0 else 0.0 end) as win_rate
from analytics.fct_opportunities
where is_closed
  [[ and close_date >= {{date_from}} ]]
  [[ and close_date <= {{date_to}} ]]
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]
  [[ and owner_id = {{owner_id}} ]]

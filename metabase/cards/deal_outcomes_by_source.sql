-- name: Deal outcomes by lead source
-- collection: Pipeline
-- display: table
-- params: [date_from, date_to, segment, lead_source, owner_id]
-- description: Deals created in the period, per lead source: won, lost, still open, won share, and open value.
-- viz: {column_settings: {'["name","won_share"]': {number_style: percent, decimals: 1}}}
select
    lead_source,
    count(*) as deals,
    sum(case when outcome = 'won' then 1 else 0 end) as won,
    sum(case when outcome = 'lost' then 1 else 0 end) as lost,
    sum(case when outcome = 'open' then 1 else 0 end) as still_open,
    avg(case when outcome = 'won' then 1.0 else 0.0 end) as won_share,
    coalesce(sum(amount_usd) filter (where outcome = 'won'), 0) as won_usd,
    coalesce(sum(amount_usd) filter (where outcome = 'open'), 0) as open_usd
from analytics.fct_opportunities
where 1 = 1
  [[ and created_date >= {{date_from}} ]]
  [[ and created_date <= {{date_to}} ]]
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]
  [[ and owner_id = {{owner_id}} ]]
group by lead_source
order by lead_source

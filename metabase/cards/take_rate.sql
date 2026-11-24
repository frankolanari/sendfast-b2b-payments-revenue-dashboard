-- name: Take rate
-- collection: Revenue
-- display: scalar
-- params: [date_from, date_to, segment, lead_source]
-- description: Net revenue / total payment volume for the months in the period.
-- viz: {column_settings: {'["name","take_rate"]': {number_style: percent, decimals: 2}}}
with accounts as (
    select account_id
    from analytics.dim_accounts
    where 1 = 1
      [[ and segment = {{segment}} ]]
      [[ and lead_source = {{lead_source}} ]]
),
revenue as (
    select sum(r.net_revenue_usd) as net_revenue_usd
    from analytics.fct_revenue_monthly as r
    inner join accounts on r.account_id = accounts.account_id
    where 1 = 1
      [[ and r.revenue_month >= date_trunc('month', cast({{date_from}} as date)) ]]
      [[ and r.revenue_month <= {{date_to}} ]]
),
volume as (
    select sum(d.volume_usd) as volume_usd
    from analytics.fct_account_daily as d
    inner join accounts on d.account_id = accounts.account_id
    where 1 = 1
      [[ and d.activity_month >= date_trunc('month', cast({{date_from}} as date)) ]]
      [[ and d.activity_month <= {{date_to}} ]]
)
select revenue.net_revenue_usd / nullif(volume.volume_usd, 0) as take_rate
from revenue cross join volume

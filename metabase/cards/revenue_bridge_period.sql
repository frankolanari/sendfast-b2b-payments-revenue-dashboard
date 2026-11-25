-- name: Revenue bridge over the period
-- collection: Revenue
-- display: table
-- params: [date_from, date_to, segment, lead_source]
-- required: [date_from, date_to]
-- description: Net revenue in the month before the period, the moves during it (new, reactivation, expansion, contraction, churn), and net revenue in its last month. Start + moves = end.
with start_rev as (
    select coalesce(sum(r.net_revenue_usd), 0) as amount_usd
    from analytics.fct_revenue_monthly as r
    inner join analytics.dim_accounts as a on r.account_id = a.account_id
    where r.revenue_month = cast(date_trunc('month', cast({{date_from}} as date)) - interval '1 month' as date)
      [[ and a.segment = {{segment}} ]]
      [[ and a.lead_source = {{lead_source}} ]]
),
end_rev as (
    select coalesce(sum(r.net_revenue_usd), 0) as amount_usd
    from analytics.fct_revenue_monthly as r
    inner join analytics.dim_accounts as a on r.account_id = a.account_id
    where r.revenue_month = cast(date_trunc('month', cast({{date_to}} as date)) as date)
      [[ and a.segment = {{segment}} ]]
      [[ and a.lead_source = {{lead_source}} ]]
),
moves as (
    select category, sum(amount_usd) as amount_usd
    from analytics.fct_revenue_bridge
    where revenue_month >= cast(date_trunc('month', cast({{date_from}} as date)) as date)
      and revenue_month <= {{date_to}}
      [[ and segment = {{segment}} ]]
      [[ and lead_source = {{lead_source}} ]]
    group by category
)
select 'start' as step, 0 as step_order, amount_usd from start_rev
union all
select
    category,
    case category when 'new' then 1 when 'reactivation' then 2 when 'expansion' then 3 when 'contraction' then 4 else 5 end,
    amount_usd
from moves
union all
select 'end', 9, amount_usd from end_rev
order by step_order

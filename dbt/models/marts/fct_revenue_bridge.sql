-- Month x category: how net revenue moved from the previous month.
-- new: first revenue ever; reactivation: back after a zero month; expansion / contraction:
-- up / down while paying; churn: to zero. The window's first month has no prior month to compare.

with revenue as (

    select * from {{ ref('fct_revenue_monthly') }}

),

accounts as (

    select * from {{ ref('dim_accounts') }}

),

months as (

    select distinct month_start
    from {{ ref('dim_date') }}
    where is_in_data_window

),

first_months as (

    select
        account_id,
        min(revenue_month) as first_month
    from revenue
    group by account_id

),

grid as (

    select
        first_months.account_id,
        months.month_start
    from first_months
    inner join months
        on first_months.first_month <= months.month_start

),

filled as (

    select
        grid.account_id,
        grid.month_start,
        coalesce(revenue.net_revenue_usd, 0) as net_revenue_usd
    from grid
    left join revenue
        on
            grid.account_id = revenue.account_id
            and grid.month_start = revenue.revenue_month

),

lagged as (

    select
        account_id,
        month_start,
        net_revenue_usd,
        lag(net_revenue_usd, 1, 0) over (partition by account_id order by month_start) as previous_usd,
        coalesce(sum(net_revenue_usd) over (
            partition by account_id order by month_start
            rows between unbounded preceding and 1 preceding
        ), 0) as earlier_total_usd
    from filled

),

classified as (

    select
        account_id,
        month_start,
        net_revenue_usd - previous_usd as change_usd,
        case
            when previous_usd = 0 and net_revenue_usd > 0 and earlier_total_usd = 0 then 'new'
            when previous_usd = 0 and net_revenue_usd > 0 then 'reactivation'
            when previous_usd > 0 and net_revenue_usd = 0 then 'churn'
            when previous_usd > 0 and net_revenue_usd > previous_usd then 'expansion'
            when previous_usd > 0 and net_revenue_usd < previous_usd then 'contraction'
        end as category
    from lagged
    where month_start > {{ window_start() }}

)

select
    classified.month_start as revenue_month,
    classified.category,
    accounts.segment,
    accounts.lead_source,
    sum(classified.change_usd) as amount_usd,
    count(*) as account_count
from classified
inner join accounts
    on classified.account_id = accounts.account_id
where classified.category is not null
group by classified.month_start, classified.category, accounts.segment, accounts.lead_source

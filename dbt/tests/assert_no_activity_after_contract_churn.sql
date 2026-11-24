-- Invariant: no succeeded transactions and no revenue after a subscription has ended.
select revenue.account_id, revenue.revenue_month
from {{ ref('fct_revenue_monthly') }} as revenue
inner join {{ ref('dim_accounts') }} as accounts
    on revenue.account_id = accounts.account_id
where revenue.revenue_month > cast(date_trunc('month', accounts.contract_end_date) as date)

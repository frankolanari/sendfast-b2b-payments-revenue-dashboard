-- name: Churn rate by activation speed
-- collection: Revenue
-- display: bar
-- params: [segment, lead_source]
-- description: Accounts that went live in the data window; slow = more than 45 days from won to first payment.
-- viz: {graph.dimensions: [activation_speed], graph.metrics: [churn_rate], column_settings: {'["name","churn_rate"]': {number_style: percent, decimals: 0}}}
select
    activation_speed,
    count(*) as accounts,
    sum(case when churn_type is not null then 1 else 0 end) as churned_accounts,
    avg(case when churn_type is not null then 1.0 else 0.0 end) as churn_rate
from analytics.dim_accounts
where is_customer and not is_excluded and activation_speed is not null
  and live_date >= (select min(date_day) from analytics.dim_date where is_in_data_window)
  [[ and segment = {{segment}} ]]
  [[ and lead_source = {{lead_source}} ]]
group by activation_speed
order by activation_speed

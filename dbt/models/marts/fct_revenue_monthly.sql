-- Account x month net revenue in USD: platform fee + usage fee + FX margin + min-commit true-up.
-- Invoice lines count in the month of their period; usage fee and FX margin in the transaction month.

with invoice_line_rows as (

    select
        invoices.customer_id as billing_customer_id,
        {{ month_of(utc_date('invoice_line_rows.period_start')) }} as revenue_month,
        invoice_line_rows.line_type,
        invoice_line_rows.amount
    from {{ ref('stg_billing__invoice_lines') }} as invoice_line_rows
    inner join {{ ref('stg_billing__invoices') }} as invoices
        on invoice_line_rows.invoice_id = invoices.invoice_id

),

fees as (

    select
        billing_customer_id,
        revenue_month,
        sum(case when line_type = 'platform_fee' then amount else 0 end) as platform_fee_usd,
        sum(case when line_type = 'usage_true_up' then amount else 0 end) as true_up_usd
    from invoice_line_rows
    group by billing_customer_id, revenue_month

),

usage_fees as (

    select
        billing_customer_id,
        txn_month as revenue_month,
        sum(usage_fee_usd) as usage_fee_usd,
        sum(fx_margin_usd) as fx_margin_usd
    from {{ ref('int_transactions_enriched') }}
    where status = 'succeeded' and billing_customer_id is not null
    group by billing_customer_id, txn_month

),

account_months as (

    select
        billing_customer_id,
        revenue_month
    from fees
    union
    select
        billing_customer_id,
        revenue_month
    from usage_fees

),

lifecycle as (

    select * from {{ ref('int_account_lifecycle') }}

)

select
    coalesce(lifecycle.crm_account_id, 'billing:' || account_months.billing_customer_id) as account_id,
    account_months.billing_customer_id,
    account_months.revenue_month,
    coalesce(fees.platform_fee_usd, 0) as platform_fee_usd,
    coalesce(usage_fees.usage_fee_usd, 0) as usage_fee_usd,
    coalesce(usage_fees.fx_margin_usd, 0) as fx_margin_usd,
    coalesce(fees.true_up_usd, 0) as true_up_usd,
    coalesce(fees.platform_fee_usd, 0) + coalesce(usage_fees.usage_fee_usd, 0)
    + coalesce(usage_fees.fx_margin_usd, 0) + coalesce(fees.true_up_usd, 0) as net_revenue_usd
from account_months
inner join lifecycle
    on account_months.billing_customer_id = lifecycle.billing_customer_id
left join fees
    on
        account_months.billing_customer_id = fees.billing_customer_id
        and account_months.revenue_month = fees.revenue_month
left join usage_fees
    on
        account_months.billing_customer_id = usage_fees.billing_customer_id
        and account_months.revenue_month = usage_fees.revenue_month
where
    not lifecycle.is_excluded
    and account_months.revenue_month >= {{ window_start() }}

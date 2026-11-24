-- Calendar from the start of the simulated history to the fixed as-of date (D11). UTC (D15).

with days as (

    select cast(day_ts as date) as date_day
    from generate_series(
        cast('{{ var("history_start") }}' as timestamp),
        cast({{ as_of_date() }} as timestamp),
        interval '1 day'
    ) as series (day_ts)

)

select
    date_day,
    {{ month_of('date_day') }} as month_start,
    cast(date_trunc('quarter', date_day) as date) as quarter_start,
    to_char(date_day, 'YYYY"Q"Q') as quarter_label,
    extract(year from date_day) as calendar_year,
    extract(isodow from date_day) as iso_day_of_week,
    extract(isodow from date_day) in (6, 7) as is_weekend,
    date_day >= {{ window_start() }} as is_in_data_window
from days

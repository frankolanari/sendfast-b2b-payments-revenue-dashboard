-- Shared helpers. Fixed dates come from vars (D11: never now()); everything is UTC (D15).

{% macro as_of_date() -%}
    cast('{{ var("as_of_date") }}' as date)
{%- endmacro %}

{% macro window_start() -%}
    cast('{{ var("window_start") }}' as date)
{%- endmacro %}

{% macro utc_date(ts) -%}
    cast(({{ ts }} at time zone 'UTC') as date)
{%- endmacro %}

{% macro month_of(d) -%}
    cast(date_trunc('month', {{ d }}) as date)
{%- endmacro %}

{# Minor units -> major units by ISO 4217 exponent (most currencies have 2 decimals). #}
{% macro minor_to_major(amount, currency) -%}
    (
        cast({{ amount }} as numeric)
        / power(10, case upper(trim({{ currency }}))
            when 'JPY' then 0 when 'KRW' then 0 when 'KWD' then 3 when 'BHD' then 3 else 2
        end)
    )
{%- endmacro %}

{# Upper-case ISO 4217; currency symbols seen in sources map to their code. #}
{% macro normalize_currency(col) -%}
    case trim({{ col }})
        when '₦' then 'NGN' when '$' then 'USD' when '£' then 'GBP' when '€' then 'EUR'
        else upper(trim({{ col }}))
    end
{%- endmacro %}

{# Lower-case domain without scheme, www. or path; empty -> null. #}
{% macro normalize_domain(col) -%}
    nullif(regexp_replace(lower(trim({{ col }})), '^(https?://)?(www\.)?|/.*$', '', 'g'), '')
{%- endmacro %}

{# Cleaning rule: test accounts by name, internal accounts by domain. Null when neither. #}
{% macro exclusion_reason(name, domain) -%}
    case
        when {{ name }} ~* '^test[ -]' then 'test'
        when {{ domain }} in (
            {%- for d in var("internal_domains") %}'{{ d }}'{% if not loop.last %}, {% endif %}{% endfor -%}
        ) then 'internal'
    end
{%- endmacro %}

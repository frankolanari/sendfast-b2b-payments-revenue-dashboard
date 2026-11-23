-- Use custom schema names as-is (staging, intermediate, analytics) instead of dbt's
-- default "<target>_<custom>" prefixing. Nothing is ever built in `public` (Section 2A, rule 3).
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}

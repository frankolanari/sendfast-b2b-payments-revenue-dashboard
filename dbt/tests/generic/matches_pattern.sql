{% test matches_pattern(model, column_name, pattern) %}
-- Contract regex patterns (currency codes, country codes, corridors).
select {{ column_name }}
from {{ model }}
where {{ column_name }} is not null and not ({{ column_name }} ~ '{{ pattern }}')
{% endtest %}

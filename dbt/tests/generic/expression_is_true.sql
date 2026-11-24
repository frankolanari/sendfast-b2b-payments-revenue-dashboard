{% test expression_is_true(model, expression) %}
-- Sanity ranges and row-level invariants.
select *
from {{ model }}
where not ({{ expression }})
{% endtest %}

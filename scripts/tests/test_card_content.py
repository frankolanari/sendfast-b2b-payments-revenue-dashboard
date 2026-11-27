"""Tests for scripts/card_content.py: repo content is valid; broken content is rejected."""

from __future__ import annotations

import copy

import card_content as mc
import golden_check as gc
import pytest
import yaml


@pytest.fixture(scope="module")
def content():
    return mc.load_content()


@pytest.fixture
def params(content):
    return copy.deepcopy(content.params)


COLLECTIONS = {"Pipeline", "Revenue"}


def card(sql: str, params: list[str], **kw) -> mc.Card:
    return mc.Card(name="t", collection="Pipeline", display="scalar", sql=sql, params=params, **kw)


def test_repo_content_is_valid(content):
    assert mc.validate(content) == []


def test_one_golden_card_per_metric_with_periods_written_in(content):
    spec = mc.load_yaml(mc.METRICS_PATH)
    assert [c.name for c in content.golden] == [
        mc.GOLDEN_PREFIX + m["name"] for m in spec["metrics"]
    ]
    for c in content.golden:
        assert "%(" not in c.sql and c.params == []


def test_golden_card_refs_name_real_cards_and_contract_params(content):
    spec = mc.load_yaml(mc.METRICS_PATH)
    names = {c.name for c in content.cards}
    for m in spec["metrics"]:
        ref = m["golden"].get("card")
        if ref:
            assert ref["name"] in names, m["name"]
            assert ref["column"] in next(c.sql for c in content.cards if c.name == ref["name"])
            assert set(ref.get("parameters") or {}) <= set(content.params)


def test_static_filter_values_match_the_schema_contract(content):
    contract = mc.load_yaml(mc.ROOT / "contract" / "schema_contract.yml")
    text = yaml.safe_dump(contract)
    for v in content.params["segment"]["values"]["static"]:
        assert v in text
    lead = set(content.params["lead_source"]["values"]["static"])
    assert lead == {"inbound", "outbound", "paid", "partner", "unknown"}


def test_parameter_defaults_are_fixed_dates_not_the_clock(content):
    assert content.params["date_to"]["default"] == "2026-10-31"
    assert content.params["date_from"]["default"] == "2025-11-01"


# ── Cards: broken ones are rejected ──────────────────────────────────────
GOOD_SQL = "select 1 as x from analytics.dim_accounts where 1 = 1 [[ and segment = {{segment}} ]]"


def test_good_card_passes(params):
    assert mc.validate_card(card(GOOD_SQL, ["segment"]), params, COLLECTIONS) == []


def test_tag_not_listed_in_params_is_rejected(params):
    problems = mc.validate_card(card(GOOD_SQL, []), params, COLLECTIONS)
    assert any("not listed in params" in p for p in problems)


def test_param_outside_contract_is_rejected(params):
    sql = GOOD_SQL.replace("segment", "region")
    problems = mc.validate_card(card(sql, ["region"]), params, COLLECTIONS)
    assert any("not in the parameter contract" in p for p in problems)


def test_unused_param_is_rejected(params):
    problems = mc.validate_card(card(GOOD_SQL, ["segment", "corridor"]), params, COLLECTIONS)
    assert any("never used" in p for p in problems)


@pytest.mark.parametrize("schema", ["staging", "intermediate", "billing", "crm_hubspot", "public"])
def test_card_reading_outside_the_marts_is_rejected(params, schema):
    sql = f"select 1 from {schema}.x join analytics.dim_accounts on true"
    problems = mc.validate_card(card(sql, []), params, COLLECTIONS)
    assert any("other than analytics" in p for p in problems)


def test_card_using_the_clock_is_rejected(params):
    sql = "select 1 from analytics.dim_date where date_day <= current_date"
    assert any("clock" in p for p in mc.validate_card(card(sql, []), params, COLLECTIONS))


def test_required_param_needs_a_contract_default(params):
    sql = "select 1 from analytics.dim_accounts where segment = {{segment}}"
    c = card(sql, ["segment"], required=["segment"])
    assert any("no default" in p for p in mc.validate_card(c, params, COLLECTIONS))


def test_unknown_display_and_collection_are_rejected(params):
    c = card(GOOD_SQL, ["segment"])
    c.display, c.collection = "sankey", "Nowhere"
    problems = "\n".join(mc.validate_card(c, params, COLLECTIONS))
    assert "display" in problems and "collection" in problems


def test_front_matter_parses_and_rejects_unknown_keys():
    text = (
        "-- name: X: with a colon\n-- collection: Pipeline\n-- display: bar\n"
        "-- params: [segment]\n-- viz: {graph.metrics: [x]}\nselect {{segment}}\n"
    )
    c = mc.parse_card(text)
    assert c.name == "X: with a colon" and c.params == ["segment"]
    assert c.viz == {"graph.metrics": ["x"]} and c.sql.startswith("select")
    with pytest.raises(ValueError):
        mc.parse_card("-- name: X\n-- colour: red\nselect 1\n")
    with pytest.raises(ValueError):
        mc.parse_card("-- name: X\nselect 1\n")


def test_rows_as_entry_scalar_and_map():
    assert gc.rows_as_entry(["value", "n"], [(1.0, 2)], None) == {"value": 1.0, "n": 2}
    entry = gc.rows_as_entry(["src", "value", "n"], [("a", 1.0, 3), ("b", 2.0, 4)], "src")
    assert entry == {"value": {"a": 1.0, "b": 2.0}, "n": {"a": 3, "b": 4}}


def test_card_parameters_resolve_periods_and_types(content):
    ref = {"parameters": {"date_to": "golden_month_end", "segment": "as_of"}}
    out = gc.card_parameters(ref, {"golden_month_end": "2026-09-30", "as_of": "x"})
    assert out == {"date_to": "2026-09-30", "segment": "x"}


def test_card_ref_with_unknown_period_is_caught(content):
    spec = copy.deepcopy(mc.load_yaml(mc.METRICS_PATH))
    key = gc.json.loads(gc.answer_key_path(1.0).read_text(encoding="utf-8"))
    ref = next(m["golden"]["card"] for m in spec["metrics"] if m["golden"].get("card"))
    ref["parameters"]["date_to"] = "next_tuesday"
    assert any("not a period" in p for p in gc.validate_spec(spec, key))

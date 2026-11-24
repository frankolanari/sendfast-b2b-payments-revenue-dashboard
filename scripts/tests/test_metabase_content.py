"""Tests for scripts/metabase_content.py: repo content is valid; broken content is rejected."""

from __future__ import annotations

import copy

import golden_check as gc
import metabase_content as mc
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


# ── The real content ─────────────────────────────────────────────────────
def test_repo_content_is_valid(content):
    assert mc.validate(content) == []


def test_four_dashboards_one_per_page(content):
    assert {d["name"] for d in content.dashboards} == {
        "Pipeline & funnel",
        "Revenue & retention",
        "Account health & risk",
        "Account 360",
    }


def test_every_dashboard_has_a_cross_filter_or_drill(content):
    for d in content.dashboards:
        if d["name"] == "Account 360":
            continue
        assert any(dc.get("crossfilter") or dc.get("link") for dc in d["cards"]), d["name"]


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


def test_template_tags_mark_required_with_default(params):
    c = card("select {{date_to}} from analytics.x", ["date_to"], required=["date_to"])
    [tag] = mc.template_tags(c, params)
    assert tag == {
        "id": "date_to",
        "name": "date_to",
        "display-name": "To",
        "type": "date",
        "required": True,
        "default": "2026-10-31",
    }


# ── Dashboards: broken ones are rejected ─────────────────────────────────
def dash_problems(content, mutate) -> str:
    dashboards = copy.deepcopy(content.dashboards)
    mutate(dashboards)
    collections = {c["name"] for c in content.collections}
    return "\n".join(mc.validate_dashboards(dashboards, content.cards, content.params, collections))


def test_overlapping_cards_are_rejected(content):
    def m(ds):
        ds[0]["cards"][1].update(row=0, col=0)

    assert "overlaps" in dash_problems(content, m)


def test_card_past_the_grid_is_rejected(content):
    assert "past the 24-column grid" in dash_problems(
        content, lambda ds: ds[0]["cards"][0].update(col=20, size_x=8)
    )


def test_unknown_card_is_rejected(content):
    assert "not in metabase/cards" in dash_problems(
        content, lambda ds: ds[0]["cards"][0].update(card="Nope")
    )


def test_crossfilter_to_a_filter_not_on_the_dashboard_is_rejected(content):
    def m(ds):
        pipeline = next(d for d in ds if d["name"] == "Pipeline & funnel")
        pipeline["parameters"].remove("lead_source")

    assert "cross-filters 'lead_source'" in dash_problems(content, m)


def test_link_to_unknown_dashboard_is_rejected(content):
    def m(ds):
        risk = next(d for d in ds if d["name"] == "Account health & risk")
        next(dc for dc in risk["cards"] if dc.get("link"))["link"]["dashboard"] = "Nowhere"

    assert "unknown dashboard" in dash_problems(content, m)


def test_required_card_param_must_be_a_dashboard_filter(content):
    def m(ds):
        next(d for d in ds if d["name"] == "Account 360")["parameters"].remove("account_id")

    assert "requires ['account_id']" in dash_problems(content, m)


# ── Payload shaping ──────────────────────────────────────────────────────
def test_dashcards_keep_existing_ids_and_map_only_shared_params(content):
    d = next(d for d in content.dashboards if d["name"] == "Pipeline & funnel")
    cards = {c.name: c for c in content.cards}
    card_ids = {name: i for i, name in enumerate(cards, start=1)}
    dash_ids = {x["name"]: 100 + i for i, x in enumerate(content.dashboards)}
    first = card_ids[d["cards"][0]["card"]]
    out = mc.desired_dashcards(d, cards, card_ids, dash_ids, {first: 77})
    assert out[0]["id"] == 77 and all(dc["id"] < 0 for dc in out[1:])
    assert len({dc["id"] for dc in out}) == len(out)
    open_pipeline = next(dc for dc in out if dc["card_id"] == card_ids["Open pipeline (USD)"])
    mapped = {m["parameter_id"] for m in open_pipeline["parameter_mappings"]}
    assert mapped == {"segment", "lead_source", "owner_id"}  # no date filter on this card


def test_click_settings_crossfilter_and_column_link(content):
    xf = mc.click_settings({"crossfilter": {"corridor": "corridor"}}, {})
    assert xf["click_behavior"]["type"] == "crossfilter"
    assert xf["click_behavior"]["parameterMapping"]["corridor"]["source"]["name"] == "corridor"
    link = {
        "dashboard": "Account 360",
        "column": "account_name",
        "parameters": {"account_id": "account_id"},
    }
    out = mc.click_settings({"link": link}, {"Account 360": 9})
    behavior = out["column_settings"]['["name","account_name"]']["click_behavior"]
    assert behavior["targetId"] == 9 and behavior["linkType"] == "dashboard"


def test_dashboard_parameters_carry_defaults_and_value_sources(content):
    d = next(d for d in content.dashboards if d["name"] == "Account health & risk")
    card_ids = {c.name: i for i, c in enumerate(content.cards, start=1)}
    ps = {p["id"]: p for p in mc.dashboard_parameters(d, content.params, card_ids)}
    assert ps["date_to"]["type"] == "date/single" and ps["date_to"]["default"] == "2026-10-31"
    assert ps["segment"]["values_source_type"] == "static-list"
    corridor = ps["corridor"]["values_source_config"]
    assert corridor["card_id"] == card_ids["Filter values: corridors"]


def test_canon_makes_legacy_and_mbql5_measures_equal():
    legacy = ["count-where", ["=", ["field", 46, None], True]]
    mbql5 = [
        "count-where",
        {"lib/uuid": "a"},
        ["=", {"lib/uuid": "b"}, ["field", {"x": 1}, 46], True],
    ]
    assert mc.canon(legacy) == mc.canon(mbql5)
    assert mc.canon(["sum", ["field", 46, None]]) != mc.canon(legacy)


def test_measures_must_be_simple_additive():
    bad = {"models": [], "measures": [{"name": "NRR", "aggregation": {"ratio": "x"}}]}
    assert mc.validate_models(bad)


# ── golden_check stage 2 helpers ─────────────────────────────────────────
def test_rows_as_entry_scalar_and_map():
    assert gc.rows_as_entry(["value", "n"], [(1.0, 2)], None) == {"value": 1.0, "n": 2}
    entry = gc.rows_as_entry(["src", "value", "n"], [("a", 1.0, 3), ("b", 2.0, 4)], "src")
    assert entry == {"value": {"a": 1.0, "b": 2.0}, "n": {"a": 3, "b": 4}}


def test_card_parameters_resolve_periods_and_types(content):
    ref = {"parameters": {"date_to": "golden_month_end", "segment": "as_of"}}
    out = gc.card_parameters(ref, {"golden_month_end": "2026-09-30", "as_of": "x"}, content.params)
    by = {p["id"]: p for p in out}
    assert by["date_to"]["type"] == "date/single" and by["date_to"]["value"] == "2026-09-30"
    assert by["segment"]["type"] == "string/="
    assert by["date_to"]["target"] == ["variable", ["template-tag", "date_to"]]


def test_card_ref_with_unknown_period_is_caught(content):
    spec = copy.deepcopy(mc.load_yaml(mc.METRICS_PATH))
    key = gc.json.loads(gc.answer_key_path(1.0).read_text(encoding="utf-8"))
    ref = next(m["golden"]["card"] for m in spec["metrics"] if m["golden"].get("card"))
    ref["parameters"]["date_to"] = "next_tuesday"
    assert any("not a period" in p for p in gc.validate_spec(spec, key))

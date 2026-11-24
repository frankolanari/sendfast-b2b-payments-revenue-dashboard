"""Tests for scripts/golden_check.py: the spec matches the key; mismatches are caught."""

from __future__ import annotations

import copy
import json

import golden_check as gc
import pytest


@pytest.fixture(scope="module")
def spec():
    return gc.load_spec()


@pytest.fixture(scope="module", params=[1.0, 0.1])
def key(request):
    return json.loads(gc.answer_key_path(request.param).read_text(encoding="utf-8"))


RAW_AND_INNER_SCHEMAS = (
    "staging.",
    "intermediate.",
    "crm_hubspot.",
    "billing.",
    "ledger.",
    "rates.",
)
GOLDEN = {"tolerance": 0.01, "query": "select 1"}
ENTRY = {"value": 100.0, "opportunities": 4, "definition": "d"}


# ── The real spec against both committed keys ────────────────────────────
def test_spec_matches_answer_key(spec, key):
    assert gc.validate_spec(spec, key) == []


def test_every_query_reads_the_analytics_marts_only(spec):
    for m in spec["metrics"]:
        q = m["golden"]["query"].lower()
        for schema in (
            "staging.",
            "intermediate.",
            "crm_hubspot.",
            "billing.",
            "ledger.",
            "rates.",
        ):
            assert schema not in q, f"{m['name']} reads {schema}"
        assert "analytics." in q, m["name"]


def test_no_query_uses_the_clock(spec):
    for m in spec["metrics"]:
        q = m["golden"]["query"].lower()
        assert "now()" not in q and "current_date" not in q, m["name"]


# ── Spec drift is caught ─────────────────────────────────────────────────
def test_reworded_definition_is_caught(spec, key):
    s = copy.deepcopy(spec)
    s["metrics"][0]["definition"] += " Slightly different."
    assert any("definition differs" in p for p in gc.validate_spec(s, key))


def test_missing_and_extra_metrics_are_caught(spec, key):
    s = copy.deepcopy(spec)
    dropped = s["metrics"].pop()
    s["metrics"].append({**copy.deepcopy(s["metrics"][0]), "name": "made_up_metric"})
    problems = "\n".join(gc.validate_spec(s, key))
    assert dropped["name"] in problems and "made_up_metric" in problems


def test_period_out_of_step_with_key_is_caught(spec, key):
    s = copy.deepcopy(spec)
    s["periods"]["t12_start"] = "2025-10-01"
    assert any("periods.t12_start" in p for p in gc.validate_spec(s, key))


def test_negative_tolerance_is_rejected(spec, key):
    s = copy.deepcopy(spec)
    s["metrics"][0]["golden"]["tolerance"] = -1
    assert any("tolerance" in p for p in gc.validate_spec(s, key))


# ── compare(): scalar metrics ────────────────────────────────────────────
def test_exact_and_within_tolerance_pass():
    assert gc.compare("m", ENTRY, ["value", "opportunities"], [(100.0, 4)], GOLDEN) == []
    assert gc.compare("m", ENTRY, ["value"], [(100.009,)], GOLDEN) == []


def test_outside_tolerance_fails_with_expected_and_actual():
    [p] = gc.compare("m", ENTRY, ["value"], [(100.02,)], GOLDEN)
    assert "expected 100.0" in p and "actual 100.02" in p


def test_side_column_mismatch_fails():
    [p] = gc.compare("m", ENTRY, ["value", "opportunities"], [(100.0, 5)], GOLDEN)
    assert p.startswith("opportunities")


def test_null_actual_fails():
    assert gc.compare("m", ENTRY, ["value"], [(None,)], GOLDEN)


def test_wrong_row_count_fails():
    assert gc.compare("m", ENTRY, ["value"], [], GOLDEN)
    assert gc.compare("m", ENTRY, ["value"], [(100.0,), (100.0,)], GOLDEN)


def test_unknown_column_fails_rather_than_being_ignored():
    [p] = gc.compare("m", ENTRY, ["value", "typo_count"], [(100.0, 1)], GOLDEN)
    assert "typo_count" in p


def test_missing_value_column_fails():
    assert gc.compare("m", ENTRY, ["opportunities"], [(4,)], GOLDEN)


def test_zero_tolerance_means_exact():
    g = {**GOLDEN, "tolerance": 0}
    assert gc.compare("m", ENTRY, ["value"], [(100.0,)], g) == []
    assert gc.compare("m", ENTRY, ["value"], [(100.5,)], g)


# ── compare(): metrics broken down by a column ───────────────────────────
MAP_ENTRY = {"value": {"a": 1.0, "b": 2.0}, "accounts": {"a": 3, "b": 4}, "definition": "d"}
MAP_GOLDEN = {**GOLDEN, "by": "source"}
COLS = ["source", "value", "accounts"]


def test_map_metric_passes():
    assert gc.compare("m", MAP_ENTRY, COLS, [("a", 1.0, 3), ("b", 2.0, 4)], MAP_GOLDEN) == []


def test_map_metric_catches_wrong_value_missing_and_extra_keys():
    problems = gc.compare("m", MAP_ENTRY, COLS, [("a", 1.5, 3), ("c", 2.0, 4)], MAP_GOLDEN)
    text = "\n".join(problems)
    assert "value[a]" in text and "source=b" in text and "source=c" in text


def test_report_prints_sql_on_failure_only():
    ok = gc.Result("good", sql="select 1")
    bad = gc.Result(
        "bad", sql="select 2 from analytics.x", problems=["value: expected 1, actual 2"]
    )
    out = gc.report([ok, bad])
    assert "PASS  good" in out and "FAIL  bad" in out
    assert "select 2 from analytics.x" in out and "select 1\n" not in out
    assert "1/2 golden metrics" in out

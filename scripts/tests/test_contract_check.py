"""Tests for scripts/contract_check.py: the real contract passes, broken ones are rejected."""

from __future__ import annotations

import copy
from typing import Any

import contract_check as cc
import pytest


@pytest.fixture(scope="module")
def schema() -> dict[str, Any]:
    return cc.load_schema()


@pytest.fixture
def contract() -> dict[str, Any]:
    return cc.load_yaml(cc.CONTRACT_PATH.read_text(encoding="utf-8"))


def table(contract: dict[str, Any], name: str) -> dict[str, Any]:
    return next(t for t in contract["tables"] if t["name"] == name)


def column(contract: dict[str, Any], table_name: str, col: str) -> dict[str, Any]:
    return next(c for c in table(contract, table_name)["columns"] if c["name"] == col)


# ── The real contract ────────────────────────────────────────────────────
def test_real_contract_is_valid(contract, schema):
    assert cc.validate(contract, schema) == []


def test_real_contract_has_every_plan_table(contract):
    expected = {
        "stg_crm__accounts", "stg_crm__contacts", "stg_crm__leads", "stg_crm__opportunities",
        "stg_crm__opportunity_stage_history", "stg_crm__users",
        "stg_billing__customers", "stg_billing__subscriptions", "stg_billing__invoices",
        "stg_billing__invoice_lines",
        "stg_ledger__merchants", "stg_ledger__transactions", "stg_ledger__disputes",
        "stg_rates__fx_rates", "stg_rates__pricing_rates",
    }  # fmt: skip
    assert {t["name"] for t in contract["tables"]} == expected


def test_real_repo_check_passes_without_base():
    assert cc.run_check(base_ref=None) == []


def test_dictionary_render_is_deterministic(contract):
    assert cc.render_dictionary(contract) == cc.render_dictionary(copy.deepcopy(contract))


# ── Schema-level rejections ──────────────────────────────────────────────
def test_rejects_column_without_nullable(contract, schema):
    del column(contract, "stg_crm__users", "name")["nullable"]
    assert any("nullable" in e for e in cc.validate(contract, schema))


def test_rejects_unknown_type(contract, schema):
    column(contract, "stg_crm__users", "name")["type"] = "varchar"
    assert any("varchar" in e for e in cc.validate(contract, schema))


def test_rejects_bad_version_string(contract, schema):
    contract["contract_version"] = "1.0"
    assert cc.validate(contract, schema)


def test_rejects_unknown_table_key(contract, schema):
    table(contract, "stg_crm__users")["primary_keys"] = ["user_id"]
    assert cc.validate(contract, schema)


# ── Semantic rejections ──────────────────────────────────────────────────
def test_rejects_primary_key_not_a_column(contract, schema):
    table(contract, "stg_crm__users")["primary_key"] = ["id"]
    assert any("primary key column 'id'" in e for e in cc.validate(contract, schema))


def test_rejects_nullable_primary_key(contract, schema):
    column(contract, "stg_crm__users", "user_id")["nullable"] = True
    assert any("must not be nullable" in e for e in cc.validate(contract, schema))


def test_rejects_foreign_key_to_missing_table(contract, schema):
    fk = table(contract, "stg_crm__accounts")["foreign_keys"][0]
    fk["references"]["table"] = "stg_crm__owners"
    assert any("does not exist" in e for e in cc.validate(contract, schema))


def test_rejects_foreign_key_type_mismatch(contract, schema):
    column(contract, "stg_crm__accounts", "owner_id")["type"] = "integer"
    assert any("type mismatch" in e for e in cc.validate(contract, schema))


def test_rejects_foreign_key_not_targeting_primary_key(contract, schema):
    fk = table(contract, "stg_crm__accounts")["foreign_keys"][0]
    fk["references"]["columns"] = ["name"]
    assert any("primary key" in e for e in cc.validate(contract, schema))


def test_rejects_allowed_values_on_non_text(contract, schema):
    column(contract, "stg_crm__users", "active")["allowed_values"] = ["yes"]
    assert any("only apply to text" in e for e in cc.validate(contract, schema))


def test_rejects_name_not_matching_source(contract, schema):
    table(contract, "stg_crm__users")["source"] = "billing"
    assert any("must start with 'stg_billing__'" in e for e in cc.validate(contract, schema))


def test_rejects_duplicate_column(contract, schema):
    cols = table(contract, "stg_crm__users")["columns"]
    cols.append(copy.deepcopy(cols[0]))
    assert any("duplicate column" in e for e in cc.validate(contract, schema))


# ── Versioning and changelog ─────────────────────────────────────────────
def test_no_base_means_no_bump_needed(contract):
    assert cc.version_bump_errors(contract, None) == []


def test_unchanged_contract_needs_no_bump(contract):
    assert cc.version_bump_errors(contract, copy.deepcopy(contract)) == []


def test_change_without_bump_is_rejected(contract):
    base = copy.deepcopy(contract)
    column(contract, "stg_crm__users", "name")["nullable"] = True
    assert any("bump it" in e for e in cc.version_bump_errors(contract, base))


def test_change_with_bump_is_accepted(contract):
    base = copy.deepcopy(contract)
    column(contract, "stg_crm__users", "name")["nullable"] = True
    major, minor, _ = cc.parse_version(base["contract_version"])
    contract["contract_version"] = f"{major}.{minor + 1}.0"  # a minor bump of the base
    assert cc.version_bump_errors(contract, base) == []


def test_version_going_backwards_is_rejected(contract):
    base = copy.deepcopy(contract)
    major, _, _ = cc.parse_version(contract["contract_version"])
    base["contract_version"] = f"{major + 1}.0.0"  # base ahead of the current contract
    assert any("backwards" in e for e in cc.version_bump_errors(contract, base))


def test_changelog_entry_found():
    assert cc.changelog_errors("1.0.0", "# Changelog\n\n## 1.0.0 · 2026-11-23\n") == []


def test_changelog_entry_missing():
    assert cc.changelog_errors("1.1.0", "# Changelog\n\n## 1.0.0 · 2026-11-23\n")


def test_changelog_does_not_match_prefix_versions():
    assert cc.changelog_errors("1.0.1", "## 1.0.10\n")

"""Generator invariants and determinism (PLAN.md Stage 3; CI job `generator-unit`).

Runs at scale 0.1, as CI does. Story detection and the full-run time limit run at full scale in
the gate (`make stories`, `make generate-timed`).
"""

from __future__ import annotations

import os
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from sendfast_gen.__main__ import load_config
from sendfast_gen.answer_key import compute
from sendfast_gen.raw import build_raw, digest
from sendfast_gen.world import build_world, month_start, opt

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def cfg():
    return load_config(0.1)


@pytest.fixture(scope="module")
def world(cfg):
    return build_world(cfg)


@pytest.fixture(scope="module")
def raw(world):
    return {t.qualified: t for t in build_raw(world)}


@pytest.fixture(scope="module")
def key(world):
    return compute(world)


# ── Determinism ──────────────────────────────────────────────────────────
def test_same_seed_same_bytes_in_process(cfg, raw):
    assert digest(build_raw(build_world(cfg))) == digest(list(raw.values()))


def test_same_seed_same_bytes_across_processes(raw):
    """A fresh interpreter with a different hash seed must produce the same bytes."""
    env = {**os.environ, "PYTHONHASHSEED": "12345", "PYTHONPATH": str(ROOT / "generator" / "src")}
    out = subprocess.run(
        [sys.executable, "-m", "sendfast_gen", "hash", "--scale", "0.1"],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    assert out.stdout.strip() == digest(list(raw.values()))


def test_different_seed_different_bytes(cfg, raw):
    other = {**cfg, "seed": int(cfg["seed"]) + 1}
    assert digest(build_raw(build_world(other))) != digest(list(raw.values()))


# ── Invariants ───────────────────────────────────────────────────────────
def test_no_transactions_before_go_live(raw):
    live = raw["ledger.merchants"].frame.set_index("merchant_id")["went_live_at"]
    tx = raw["ledger.transactions"].frame
    went_live = tx["merchant_id"].map(live)
    assert went_live.notna().all(), "every transaction's merchant is live"
    assert (tx["created_at"] >= went_live).all()


def test_no_transactions_or_revenue_after_contract_churn(world):
    c = world.customers
    ended = {
        int(a): e
        for a, e in zip(c["account_id"], c["contract_end"], strict=True)
        if opt(e) is not None
    }
    assert ended, "the sample has contract churn to check"
    tx = world.transactions
    assert not any(
        d > ended[a] for a, d in zip(tx["account_id"], tx["txn_date"], strict=True) if a in ended
    )
    rev = world.revenue_monthly
    late = [
        m > month_start(ended[a])
        for a, m in zip(rev["account_id"], rev["month"], strict=True)
        if a in ended
    ]
    assert not any(late)


def test_every_transaction_inside_the_data_window(world):
    assert min(world.transactions["txn_date"]) >= world.start
    assert max(world.transactions["txn_date"]) <= world.as_of


def test_disputes_arrive_30_to_90_days_after_their_transaction(raw):
    tx = raw["ledger.transactions"].frame.set_index("transaction_id")["created_at"]
    dp = raw["ledger.disputes"].frame
    assert dp["transaction_id"].isin(tx.index).all()
    lag = pd.to_datetime(dp["opened_at"]) - pd.to_datetime(dp["transaction_id"].map(tx))
    assert lag.min() >= pd.Timedelta(days=30)
    assert lag.max() < pd.Timedelta(days=91)


def test_every_succeeded_transaction_has_pricing(world):
    first = world.pricing.groupby("account_id")["effective_from"].min()
    tx = world.transactions
    ok = tx[(tx["account_id"] > 0) & (tx["status"] == "succeeded")]
    assert all(d >= first[a] for a, d in zip(ok["account_id"], ok["txn_date"], strict=True))


def test_pricing_periods_never_overlap(world):
    for _, g in world.pricing.groupby("account_id"):
        g = g.sort_values("effective_from")
        for to, nxt in zip(g["effective_to"].iloc[:-1], g["effective_from"].iloc[1:], strict=True):
            assert to == nxt - timedelta(days=1)


def test_failure_reason_only_on_failed(raw):
    tx = raw["ledger.transactions"].frame
    assert (tx["failure_reason"].notna() == (tx["status"] == "failed")).all()


def test_billing_is_stripe_shaped(raw):
    inv = raw["billing.invoices"].frame
    assert inv["currency"].eq("usd").all()
    assert inv["total"].astype(np.int64).ge(0).all()
    assert inv["created"].str.fullmatch(r"\d{10}").all()  # Unix seconds


def test_invoice_totals_equal_their_lines(raw):
    inv = raw["billing.invoices"].frame.set_index("id")["total"].astype(np.int64)
    lines = raw["billing.invoice_lines"].frame
    sums = lines.groupby("invoice")["amount"].apply(lambda s: s.astype(np.int64).sum())
    assert (sums.reindex(inv.index) == inv).all()


def test_hubspot_timestamps_are_naive_business_hours(raw):
    stamps = raw["crm_hubspot.deals"].frame["createdate"]
    assert not stamps.str.contains(r"[+Z]").any()
    assert stamps.str.slice(11, 13).astype(int).between(8, 19).all()


def test_ids_are_unique(raw):
    for name, col in [
        ("ledger.transactions", "transaction_id"),
        ("billing.invoices", "id"),
        ("billing.invoice_lines", "id"),
        ("crm_hubspot.deals", "hs_object_id"),
        ("ledger.merchants", "merchant_id"),
    ]:
        assert raw[name].frame[col].is_unique, name


def test_billing_ids_do_not_leak_crm_ids(raw):
    crm_ids = set(raw["crm_hubspot.companies"].frame["hs_object_id"])
    for value in raw["ledger.merchants"].frame["merchant_id"]:
        assert not any(i in value for i in crm_ids)


def test_fx_rates_positive_and_ngn_devalues(world):
    assert (world.fx["rate"] > 0).all()
    ngn = world.fx[world.fx["quote_currency"] == "NGN"].set_index("rate_date")["rate"]
    dev = world.cfg["fx"]["devaluation"]
    d = dev["date"] if isinstance(dev["date"], date) else date.fromisoformat(str(dev["date"]))
    assert ngn[d] / ngn[d - timedelta(days=1)] > 1.3


# ── Dirty rows and answer key ────────────────────────────────────────────
def test_every_dirty_row_type_is_present(key):
    for name, value in key["dirty_rows"].items():
        if isinstance(value, int):
            assert value > 0, f"no dirty rows of type {name}"


def test_dirty_currency_spellings_present_in_raw(raw):
    assert {"NGN", "ngn", "₦"} <= set(raw["ledger.transactions"].frame["dest_currency"])


def test_identity_match_rate_is_at_least_95_percent(key):
    assert key["identity"]["match_rate"] >= 0.95


def test_answer_key_has_every_golden_metric(key):
    expected = {
        "pipeline_created_usd",
        "lead_to_opp_conversion",
        "win_rate",
        "sales_cycle_days",
        "sales_velocity_usd_per_day",
        "total_payment_volume_usd",
        "net_revenue_usd",
        "take_rate",
        "platform_mrr_usd",
        "net_revenue_retention",
        "gross_revenue_retention",
        "logo_churn_contract",
        "logo_churn_silent",
        "activation_days",
        "failure_rate",
        "dispute_return_rate",
        "top10_revenue_concentration",
        "revenue_at_risk_usd",
        "net_revenue_12m_per_account_by_lead_source",
    }
    assert set(key["metrics"]) == expected
    assert all(m.get("definition") for m in key["metrics"].values())


def test_committed_answer_key_is_current():
    from sendfast_gen.__main__ import main

    assert main(["check-answer-key", "--scale", "0.1"]) == 0


def test_as_of_is_fixed(cfg):
    assert str(cfg["as_of"]) == "2026-10-31"

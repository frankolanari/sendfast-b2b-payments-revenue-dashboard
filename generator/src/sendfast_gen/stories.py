"""Planted-story detection from the RAW tables alone (PLAN.md Stage 3 acceptance).

These read only what the upstream sources land (strings, minor units, local times, dirty
currencies), never the generator's internal truth. Where possible a detector searches for the
story rather than being told where it is, and then checks it found the planted one.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd

from .raw import RawTable
from .world import add_months, as_date

CLOSED = {"closedwon", "closedlost"}
SOURCE_OF = {
    "ORGANIC_SEARCH": "inbound",
    "DIRECT_TRAFFIC": "inbound",
    "PAID_SEARCH": "paid",
    "PAID_SOCIAL": "paid",
    "REFERRALS": "partner",
    "OFFLINE": "outbound",
}


def _frames(tables: list[RawTable]) -> dict[str, pd.DataFrame]:
    return {t.qualified: t.frame for t in tables}


def _ledger_usd(f: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Raw transactions with a parsed date, clean currencies, corridor and a USD amount."""
    tx = f["ledger.transactions"].copy()
    tx["day"] = tx["created_at"].str.slice(0, 10)
    tx["month"] = tx["created_at"].str.slice(0, 7)
    dest = tx["dest_currency"].str.upper().replace({"₦": "NGN"})
    tx["corridor"] = tx["source_currency"] + "-" + dest
    fx = f["rates.fx_rates"]
    rate = dict(
        zip(
            zip(fx["quote_currency"], fx["rate_date"], strict=True),
            fx["rate"].astype(float),
            strict=True,
        )
    )
    minor = tx["amount_minor"].astype(np.int64).to_numpy()
    r = np.array(
        [
            1.0 if c == "USD" else rate[(c, d)]
            for c, d in zip(tx["source_currency"], tx["day"], strict=True)
        ]
    )
    tx["usd"] = minor / 100.0 / r
    return tx


def _merchant_accounts(f: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """CRM company -> billing customer -> merchant, via the explicit Stripe id only."""
    co = f["crm_hubspot.companies"][["hs_object_id", "stripe_customer_id"]].dropna()
    me = f["ledger.merchants"][["merchant_id", "billing_customer_id", "went_live_at"]]
    return co.merge(
        me.dropna(subset=["billing_customer_id"]),
        left_on="stripe_customer_id",
        right_on="billing_customer_id",
    )


def corridor_spike(f, cfg) -> dict[str, Any]:
    tx = _ledger_usd(f)
    g = tx.groupby(["corridor", "rail", "month"])["status"].agg(
        n="size", failed=lambda s: int((s == "failed").sum())
    )
    g = g[g["n"] >= 200].copy()
    g["rate"] = g["failed"] / g["n"]
    g["lane_median"] = g.groupby(level=[0, 1])["rate"].transform("median")
    g["ratio"] = g["rate"] / g["lane_median"]
    corridor, rail, month = g["ratio"].idxmax()  # search every lane-month, don't look it up
    sp = cfg["stories"]["corridor_spike"]
    row = g.loc[(corridor, rail, month)]
    found = (corridor, rail, month) == (sp["corridor"], sp["rail"], sp["month"])
    return {
        "detected": bool(found and row["ratio"] > 3),
        "found": f"{corridor} via {rail} in {month}",
        "failure_rate": round(float(row["rate"]), 4),
        "lane_median": round(float(row["lane_median"]), 4),
    }


def partner_leads(f, cfg, as_of: date) -> dict[str, Any]:
    deals = f["crm_hubspot.deals"].copy()
    deals["source"] = deals["lead_source"].map(SOURCE_OF)
    closed = deals[deals["dealstage"].isin(CLOSED)].dropna(subset=["source"])
    win = closed.groupby("source")["dealstage"].apply(lambda s: float((s == "closedwon").mean()))

    won = deals[deals["dealstage"] == "closedwon"].dropna(subset=["source"])
    won = won.sort_values("closedate").drop_duplicates("associated_company_id")
    acct = _merchant_accounts(f).merge(
        won[["associated_company_id", "source"]],
        left_on="hs_object_id",
        right_on="associated_company_id",
    )
    window_start = add_months(as_of.replace(day=1), -(int(cfg["months"]) - 1)).isoformat()
    live_day = acct["went_live_at"].str.slice(0, 10)
    acct = acct[
        acct["went_live_at"].notna() & (live_day >= window_start) & (live_day <= "2025-10-31")
    ]
    tx = _ledger_usd(f)
    tx = tx[tx["status"] == "succeeded"]
    per_account = []
    for _, a in acct.iterrows():
        live = date.fromisoformat(a["went_live_at"][:10]).replace(day=1)
        end = add_months(live, 12).isoformat()
        sel = tx[
            (tx["merchant_id"] == a["merchant_id"])
            & (tx["day"] >= live.isoformat())
            & (tx["day"] < end)
        ]
        per_account.append({"source": a["source"], "usd": float(sel["usd"].sum())})
    tpv = pd.DataFrame(per_account).groupby("source")["usd"].median()
    return {
        "detected": bool(win.idxmin() == "partner" and tpv.idxmax() == "partner"),
        "win_rate_by_source": {k: round(float(v), 3) for k, v in win.items()},
        "median_12m_tpv_per_account_by_source": {k: round(float(v)) for k, v in tpv.items()},
    }


def pricing_change_cohort(f, cfg, as_of: date) -> dict[str, Any]:
    me = f["ledger.merchants"].dropna(subset=["went_live_at", "billing_customer_id"]).copy()
    me["live"] = [date.fromisoformat(s[:10]) for s in me["went_live_at"]]
    me["cohort"] = [f"{d.year}Q{(d.month - 1) // 3 + 1}" for d in me["live"]]
    tx = f["ledger.transactions"]
    ok = tx[tx["status"] == "succeeded"]
    active = set(zip(ok["merchant_id"], ok["created_at"].str.slice(0, 7), strict=True))
    out = {}
    for q, g in me.groupby("cohort"):
        m12 = [add_months(d.replace(day=1), 12) for d in g["live"]]
        if max(m12) > as_of.replace(day=1):
            continue
        kept = [
            (mid, m.isoformat()[:7]) in active for mid, m in zip(g["merchant_id"], m12, strict=True)
        ]
        out[str(q)] = round(float(np.mean(kept)), 3)
    target = str(cfg["stories"]["pricing_change_cohort"]["cohort"])
    others = [v for k, v in out.items() if k != target]
    detected = (
        target in out
        and out[target] == min(out.values())
        and out[target] < 0.8 * float(np.mean(others))
    )
    return {"detected": bool(detected), "month_12_activity_by_cohort": out}


def slipping_rep(f, cfg, as_of: date) -> dict[str, Any]:
    deals = f["crm_hubspot.deals"]
    open_ = deals[~deals["dealstage"].isin(CLOSED)].copy()
    open_["past_due"] = open_["closedate"].str.slice(0, 10) < as_of.isoformat()
    by = open_.groupby("hubspot_owner_id")["past_due"].agg(["sum", "size"])
    share = by["sum"] / by["size"]
    rep = str(70_000_000 + int(cfg["stories"]["slipping_rep"]["rep"]))
    others_share = float(by["sum"].drop(rep).sum() / by["size"].drop(rep).sum())
    hist = f["crm_hubspot.deal_property_history"]
    changes = (hist[hist["property_name"] == "closedate"].groupby("object_id").size() - 1).rename(
        "changes"
    )
    per_deal = (
        deals.set_index("hs_object_id")[["hubspot_owner_id"]].join(changes).fillna({"changes": 0})
    )
    changes_by_rep = per_deal.groupby("hubspot_owner_id")["changes"].mean()
    detected = (
        share.idxmax() == rep and share[rep] > 3 * others_share and changes_by_rep.idxmax() == rep
    )
    return {
        "detected": bool(detected),
        "rep": rep,
        "past_due_share_of_open": round(float(share[rep]), 3),
        "others_past_due_share_of_open": round(others_share, 3),
        "avg_close_date_changes": round(float(changes_by_rep[rep]), 2),
        "others_avg_close_date_changes": round(float(changes_by_rep.drop(rep).mean()), 2),
    }


def concentration(f, cfg, as_of: date) -> dict[str, Any]:
    tx = _ledger_usd(f)
    t12_from = add_months(as_of.replace(day=1), -11).isoformat()
    by = (
        tx[(tx["status"] == "succeeded") & (tx["day"] >= t12_from)]
        .groupby("merchant_id")["usd"]
        .sum()
    )
    share = float(by.max() / by.sum())
    target = cfg["stories"]["concentration"]["volume_share"]
    return {"detected": abs(share - target) < 0.05, "top_merchant_tpv_share_t12m": round(share, 3)}


def slow_activation(f, cfg, as_of: date) -> dict[str, Any]:
    deals = f["crm_hubspot.deals"]
    won = (
        deals[deals["dealstage"] == "closedwon"]
        .sort_values("closedate")
        .drop_duplicates("associated_company_id")
    )
    acct = _merchant_accounts(f).merge(
        won[["associated_company_id", "closedate"]],
        left_on="hs_object_id",
        right_on="associated_company_id",
    )
    ok = f["ledger.transactions"]
    ok = ok[ok["status"] == "succeeded"]
    first = ok.groupby("merchant_id")["created_at"].min().str.slice(0, 10)
    last = ok.groupby("merchant_id")["created_at"].max().str.slice(0, 10)
    subs = f["billing.subscriptions"]
    ended = set(subs.loc[subs["ended_at"].notna(), "customer"])
    thr = cfg["stories"]["slow_activation"]["threshold_days"]
    silent_cut = (as_of - timedelta(days=60)).isoformat()
    window_start = add_months(as_of.replace(day=1), -(int(cfg["months"]) - 1)).isoformat()
    acct = acct[
        acct["went_live_at"].notna() & (acct["went_live_at"].str.slice(0, 10) >= window_start)
    ]
    rows = []
    for _, a in acct.iterrows():
        mid = a["merchant_id"]
        if mid not in first.index:
            continue
        days = (date.fromisoformat(first[mid]) - date.fromisoformat(a["closedate"][:10])).days
        rows.append(
            {
                "slow": days > thr,
                "churned": a["billing_customer_id"] in ended or last[mid] <= silent_cut,
            }
        )
    r = pd.DataFrame(rows).groupby("slow")["churned"].mean()
    slow_rate, fast_rate = float(r.get(True, np.nan)), float(r.get(False, np.nan))
    return {
        "detected": bool(slow_rate > 1.3 * fast_rate),
        "churn_rate_slow": round(slow_rate, 3),
        "churn_rate_fast": round(fast_rate, 3),
    }


def detect_all(tables: list[RawTable], cfg: dict[str, Any]) -> dict[str, dict[str, Any]]:
    f = _frames(tables)
    as_of = as_date(cfg["as_of"])
    return {
        "corridor_failure_spike": corridor_spike(f, cfg),
        "partner_leads": partner_leads(f, cfg, as_of),
        "pricing_change_cohort": pricing_change_cohort(f, cfg, as_of),
        "slipping_rep": slipping_rep(f, cfg, as_of),
        "revenue_concentration": concentration(f, cfg, as_of),
        "slow_activation": slow_activation(f, cfg, as_of),
    }

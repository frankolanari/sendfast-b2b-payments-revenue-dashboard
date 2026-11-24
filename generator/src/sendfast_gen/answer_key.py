"""The answer key: expected values for every golden metric, from the generator's truth (Stage 3).

Computed after the exclusions correct cleaning must make, so it also tests the cleaning:
- test and internal accounts are excluded everywhere
- orphan merchants (in the ledger, not in billing or the CRM) are excluded everywhere
- closed deals with a close date before their created date are excluded from sales-cycle metrics
- a missing lead source is reported as `unknown`
Each metric's `definition` is the spec PLAN.md Stage 5's metrics.yml must implement.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd

from .raw import dirty_dest_currency
from .world import World, add_months, month_end, month_start, opt, quarter_label

GOLDEN_MONTH = date(2026, 9, 1)
AT_RISK_VOLUME_DROP = 0.5
AT_RISK_FAILURE_RATE = 0.10
AT_RISK_MIN_TXNS = 20
SILENT_CHURN_DAYS = 60


def _r(x: Any, nd: int = 6) -> Any:
    if isinstance(x, (float, np.floating)):
        return None if np.isnan(x) else round(float(x), nd)
    if isinstance(x, np.integer):
        return int(x)
    return x


def metric(value: Any, definition: str, **extra: Any) -> dict[str, Any]:
    return {
        "value": _r(value),
        "definition": " ".join(definition.split()),
        **{k: _r(v) for k, v in extra.items()},
    }


def compute(w: World) -> dict[str, Any]:
    as_of = w.as_of
    t12_from = add_months(month_start(as_of), -11)
    gm, gm_end = GOLDEN_MONTH, month_end(GOLDEN_MONTH)
    prior = add_months(gm, -12)

    real = set(w.accounts.loc[w.accounts["kind"] == "customer", "account_id"].astype(int))
    cust = w.customers[w.customers["account_id"].isin(real)].copy()
    opps = w.opps[w.opps["account_id"].isin(real)].copy()
    opps["created_date"] = [d.date() for d in opps["created_at"]]
    leads = w.leads[w.leads["account_id"].isin(real)]
    tx = w.transactions[w.transactions["account_id"].isin(real)].copy()
    tx["month"] = [d.replace(day=1) for d in tx["txn_date"]]
    ok = tx[tx["status"] == "succeeded"]
    rev = w.revenue_monthly[w.revenue_monthly["account_id"].isin(real)]
    disputes = w.disputes[w.disputes["account_id"].isin(real)].copy()
    disputes["month"] = [pd.Timestamp(d).date().replace(day=1) for d in disputes["opened_at"]]

    m: dict[str, Any] = {}

    # ── Pipeline and sales ───────────────────────────────────────────────
    created_gm = opps[[gm <= d <= gm_end for d in opps["created_date"]]]
    m["pipeline_created_usd"] = metric(
        created_gm["amount_usd"].dropna().sum(),
        "Sum of amount_usd of opportunities created in the golden month (null amounts excluded).",
        month=f"{gm:%Y-%m}",
        opportunities=len(created_gm),
    )

    leads_2025 = leads[[d.year == 2025 for d in leads["created_at"]]]
    m["lead_to_opp_conversion"] = metric(
        leads_2025["converted_at"].notna().mean(),
        "Share of leads created in calendar 2025 (UTC) that have converted_at set.",
        leads=len(leads_2025),
    )

    in_t12 = np.array([t12_from <= d <= as_of for d in opps["observed_close_date"]], dtype=bool)
    closed = opps[opps["is_closed"].to_numpy(dtype=bool) & in_t12]
    win_rate = closed["is_won"].mean()
    m["win_rate"] = metric(
        win_rate,
        "Won / closed (won + lost) opportunities with close_date in the trailing 12 months "
        "(2025-11-01..2026-10-31).",
        closed=len(closed),
        won=int(closed["is_won"].sum()),
    )

    won_t12 = closed[closed["is_won"]]
    valid = won_t12[won_t12["observed_close_date"] >= won_t12["created_date"]]
    cycle_days = [
        (c - d).days
        for c, d in zip(valid["observed_close_date"], valid["created_date"], strict=True)
    ]
    cycle = float(np.median(cycle_days))
    m["sales_cycle_days"] = metric(
        cycle,
        "Median days from created_at (UTC date) to close_date for won opportunities closed in the "
        "trailing 12 months, excluding rows whose close_date is before their created date.",
        opportunities=len(valid),
    )

    avg_won = won_t12["amount_usd"].dropna().mean()
    open_now = opps[~opps["is_closed"]]
    m["sales_velocity_usd_per_day"] = metric(
        len(open_now) * avg_won * win_rate / cycle,
        "open opportunities x average won amount_usd (trailing 12 months) x win_rate / "
        "sales_cycle_days, as of 2026-10-31.",
        open_opportunities=len(open_now),
        avg_won_amount_usd=avg_won,
    )

    # ── Volume and revenue ───────────────────────────────────────────────
    ok_gm, tx_gm = ok[ok["month"] == gm], tx[tx["month"] == gm]
    tpv_gm = ok_gm["usd_amount"].sum()
    m["total_payment_volume_usd"] = metric(
        tpv_gm,
        "Sum of succeeded transaction amounts in USD (amount / FX rate of the source currency on "
        "the transaction's UTC date) in the golden month.",
        transactions=len(ok_gm),
    )

    rev_gm = rev[rev["month"] == gm]
    net_gm = rev_gm["net_revenue"].sum()
    m["net_revenue_usd"] = metric(
        net_gm,
        "Platform fee (invoice lines for the month) + usage fee (succeeded USD volume x fee_bps "
        "effective on the transaction date) + FX margin (cross-currency succeeded USD volume x "
        "fx_margin_bps) + minimum-commit true-up (invoice lines whose period is the month), "
        "golden month.",
        platform_fee=rev_gm["platform_fee"].sum(),
        usage_fee=rev_gm["usage_fee"].sum(),
        fx_margin=rev_gm["fx_margin"].sum(),
        true_up=rev_gm["true_up"].sum(),
    )
    m["take_rate"] = metric(
        net_gm / tpv_gm, "net_revenue_usd / total_payment_volume_usd, golden month."
    )
    m["platform_mrr_usd"] = metric(
        rev_gm["platform_fee"].sum(),
        "Sum of platform-fee invoice lines whose period is the golden month.",
    )

    base_ids = cust[[opt(d) is not None and d <= month_end(prior) for d in cust["live_date"]]][
        "account_id"
    ]
    by = rev.pivot_table(index="account_id", columns="month", values="net_revenue", aggfunc="sum")
    by = by.reindex(base_ids).fillna(0.0)
    now_v = by[gm] if gm in by.columns else pd.Series(0.0, index=by.index)
    then_v = by[prior] if prior in by.columns else pd.Series(0.0, index=by.index)
    m["net_revenue_retention"] = metric(
        now_v.sum() / then_v.sum(),
        "Net revenue in the golden month from accounts live (went_live_at) on or before the end of "
        "the month 12 months earlier, divided by those accounts' net revenue in that earlier "
        "month. "
        "Churned accounts count as zero; reactivated accounts count.",
        accounts=len(base_ids),
    )
    m["gross_revenue_retention"] = metric(
        np.minimum(now_v, then_v).sum() / then_v.sum(),
        "As NRR, but each account's golden-month revenue is capped at its revenue 12 months "
        "earlier.",
    )

    # ── Churn and activation ─────────────────────────────────────────────
    live = cust[cust["live_date"].map(lambda d: opt(d) is not None)]
    churn_base = live[
        [
            d < t12_from and (opt(e) is None or e >= t12_from)
            for d, e in zip(live["live_date"], live["contract_end"], strict=True)
        ]
    ]
    churned = churn_base[
        [opt(e) is not None and t12_from <= e <= as_of for e in churn_base["contract_end"]]
    ]
    m["logo_churn_contract"] = metric(
        len(churned) / len(churn_base),
        "Accounts live by 2025-10-31 and not contract-churned by then, whose subscription ended in "
        "the trailing 12 months, as a share of those accounts.",
        churned=len(churned),
        base=len(churn_base),
    )
    last_ok = ok.groupby("account_id")["txn_date"].max()
    cutoff = as_of - timedelta(days=SILENT_CHURN_DAYS)
    silent = [
        a
        for a, e in zip(live["account_id"], live["contract_end"], strict=True)
        if opt(e) is None and a in last_ok.index and last_ok[a] <= cutoff
    ]
    m["logo_churn_silent"] = metric(
        len(silent),
        f"Live accounts with no contract end whose last succeeded transaction is on or before "
        f"{cutoff} ({SILENT_CHURN_DAYS} days before the as-of date).",
    )

    first_ok = ok.groupby("account_id")["txn_date"].min()
    won2025 = cust[[d.year == 2025 for d in cust["won_date"]]]
    act = [
        (first_ok[a] - d).days
        for a, d in zip(won2025["account_id"], won2025["won_date"], strict=True)
        if a in first_ok.index
    ]
    m["activation_days"] = metric(
        float(np.median(act)),
        "Median days from won date (close_date of the account's first won opportunity) to its "
        "first "
        "succeeded transaction, for accounts won in calendar 2025 that have transacted.",
        accounts=len(act),
    )

    # ── Risk ─────────────────────────────────────────────────────────────
    failed_gm = int((tx_gm["status"] == "failed").sum())
    m["failure_rate"] = metric(
        failed_gm / len(tx_gm),
        "Failed / all transactions (any status) in the golden month.",
        transactions=len(tx_gm),
    )
    disp_gm = disputes[disputes["month"] == gm]
    m["dispute_return_rate"] = metric(
        len(disp_gm) / len(ok_gm),
        "Disputes plus returns opened in the golden month / succeeded transactions in the golden "
        "month.",
        disputes=int((disp_gm["dispute_type"] == "dispute").sum()),
        returns=int((disp_gm["dispute_type"] == "return").sum()),
    )

    rev_t12 = rev[rev["month"] >= t12_from].groupby("account_id")["net_revenue"].sum()
    rev_t12 = rev_t12.sort_values(ascending=False)
    m["top10_revenue_concentration"] = metric(
        rev_t12.head(10).sum() / rev_t12.sum(),
        "Share of trailing-12-month net revenue earned from the 10 accounts with the most.",
    )

    window = [add_months(gm, -3), add_months(gm, -2), add_months(gm, -1)]
    vol = ok.groupby(["account_id", "month"])["usd_amount"].sum()
    cnt = tx.groupby(["account_id", "month"]).size()
    fail = tx[tx["status"] == "failed"].groupby(["account_id", "month"]).size()
    rev_w = rev[rev["month"].isin(window)].groupby("account_id")["net_revenue"].sum() / 3
    at_risk, at_risk_rev = [], 0.0
    for _, c in live.iterrows():
        a = int(c["account_id"])
        end = opt(c["contract_end"])
        if c["live_date"] >= window[0] or (end is not None and end <= gm_end):
            continue
        base_vol = float(np.mean([vol.get((a, mm), 0.0) for mm in window]))
        gm_vol = float(vol.get((a, gm), 0.0))
        n_gm = int(cnt.get((a, gm), 0))
        fr = fail.get((a, gm), 0) / n_gm if n_gm else 0.0
        dropped = base_vol > 0 and gm_vol < AT_RISK_VOLUME_DROP * base_vol
        failing = n_gm >= AT_RISK_MIN_TXNS and fr > AT_RISK_FAILURE_RATE
        if dropped or failing:
            at_risk.append(a)
            at_risk_rev += float(rev_w.get(a, 0.0))
    m["revenue_at_risk_usd"] = metric(
        at_risk_rev,
        f"Accounts live before {window[0]} and not contract-churned by the end of the golden month "
        f"are at risk if golden-month volume < {AT_RISK_VOLUME_DROP:g} x their average monthly "
        f"volume over the previous 3 months, or golden-month failure rate > "
        f"{AT_RISK_FAILURE_RATE:g} on at least {AT_RISK_MIN_TXNS} transactions. Revenue at risk = "
        f"their average monthly net revenue over those 3 months.",
        accounts=len(at_risk),
    )

    # ── 12-month net revenue by lead source ─────────────────────────────
    rev_idx = rev.groupby(["account_id", "month"])["net_revenue"].sum()
    per_source: dict[str, list[float]] = {}
    for _, c in live[[w.start <= d <= date(2025, 10, 31) for d in live["live_date"]]].iterrows():
        first_m = month_start(c["live_date"])
        total = sum(
            float(rev_idx.get((int(c["account_id"]), add_months(first_m, k)), 0.0))
            for k in range(12)
        )
        per_source.setdefault(opt(c["observed_source"]) or "unknown", []).append(total)
    m["net_revenue_12m_per_account_by_lead_source"] = {
        "value": {s: _r(float(np.median(v))) for s, v in sorted(per_source.items())},
        "accounts": {s: len(v) for s, v in sorted(per_source.items())},
        "definition": "For accounts that went live inside the data window and on or before "
        "2025-10-31: net revenue in their first 12 "
        "calendar months from the go-live month; the median per account, by the lead source of the "
        "account's first won opportunity (missing -> unknown). Median, not mean, so one very large "
        "account cannot decide the comparison.",
    }

    return {
        "meta": {
            "seed": int(w.cfg["seed"]),
            "scale": float(w.cfg["scale"]),
            "as_of": str(as_of),
            "history_from": str(w.start),
            "golden_month": f"{gm:%Y-%m}",
            "trailing_12_months": [str(t12_from), str(as_of)],
        },
        "metrics": m,
        "stories": stories(w, opps, cust, tx, ok, first_ok),
        "dirty_rows": dirty_rows(w),
        "identity": identity(w),
        "counts": {
            "leads": len(w.leads),
            "opportunities": len(w.opps),
            "accounts": len(w.accounts),
            "won_accounts_excluding_test": len(cust),
            "live_accounts_excluding_test": len(live),
            "transactions": len(w.transactions),
            "disputes_and_returns": len(w.disputes),
        },
    }


def stories(w: World, opps, cust, tx, ok, first_ok) -> dict[str, Any]:
    cfg = w.cfg["stories"]
    s: dict[str, Any] = {}

    sp = cfg["corridor_spike"]
    lane = tx[(tx["corridor"] == sp["corridor"]) & (tx["rail"] == sp["rail"])]
    rates_by_m = lane.groupby("month")["status"].apply(lambda st: float((st == "failed").mean()))
    spike_m = date.fromisoformat(f"{sp['month']}-01")
    s["corridor_failure_spike"] = {
        "corridor": sp["corridor"],
        "rail": sp["rail"],
        "month": sp["month"],
        "failure_rate": _r(rates_by_m.get(spike_m)),
        "median_failure_rate_other_months": _r(float(rates_by_m.drop(spike_m).median())),
    }

    closed = opps[opps["is_closed"]].copy()
    closed["src"] = [opt(x) or "unknown" for x in closed["observed_source"]]
    win_by_src = closed.groupby("src")["is_won"].mean().sort_index()
    s["partner_leads"] = {"win_rate_by_source": {k: _r(float(v)) for k, v in win_by_src.items()}}

    story3 = cfg["pricing_change_cohort"]
    live = cust[cust["live_date"].map(lambda d: opt(d) is not None)].copy()
    live["cohort"] = [quarter_label(d) for d in live["live_date"]]
    ok_months = set(zip(ok["account_id"], ok["month"], strict=True))
    retention = {}
    for q, g in live.groupby("cohort"):
        starts = [month_start(d) for d in g["live_date"]]
        if add_months(max(starts), 12) > month_start(w.as_of):
            continue
        kept = [
            (a, add_months(st, 12)) in ok_months and (opt(e) is None or e >= add_months(st, 12))
            for a, st, e in zip(g["account_id"], starts, g["contract_end"], strict=True)
        ]
        retention[str(q)] = {
            "accounts": len(g),
            "logo_retention_month_12": _r(float(np.mean(kept))),
        }
    s["pricing_change_cohort"] = {
        "cohort": str(story3["cohort"]),
        "change_date": str(story3["change_date"]),
        "logo_retention_month_12_by_cohort": retention,
    }

    rep = cfg["slipping_rep"]["rep"]
    open_now = opps[~opps["is_closed"]].copy()
    open_now["past_due"] = [d < w.as_of for d in open_now["observed_close_date"]]
    by_rep = open_now.groupby("owner_rep").agg(
        open=("opp_id", "size"), pipeline_usd=("amount_usd", "sum"), past_due=("past_due", "sum")
    )
    others = by_rep.drop(rep, errors="ignore")
    s["slipping_rep"] = {
        "rep_owner_id": 70_000_000 + rep,
        "open_pipeline_usd_share": _r(
            by_rep.at[rep, "pipeline_usd"] / by_rep["pipeline_usd"].sum()
        ),
        "past_due_share_of_open": _r(by_rep.at[rep, "past_due"] / by_rep.at[rep, "open"]),
        "past_due_share_of_open_other_reps": _r(others["past_due"].sum() / others["open"].sum()),
    }

    t12_from = add_months(month_start(w.as_of), -11)
    ok12 = ok[ok["month"] >= t12_from].groupby("account_id")["usd_amount"].sum()
    big = int(w.customers.loc[w.customers["concentration"], "account_id"].iloc[0])
    s["revenue_concentration"] = {
        "account_id": big,
        "tpv_share_t12m": _r(ok12.get(big, 0.0) / ok12.sum()),
    }

    thr = cfg["slow_activation"]["threshold_days"]
    act = {
        int(a): (first_ok[a] - d).days
        for a, d, lv in zip(live["account_id"], live["won_date"], live["live_date"], strict=True)
        if a in first_ok.index and lv >= w.start
    }
    churned = {
        int(a)
        for a, e, st in zip(
            live["account_id"], live["contract_end"], live["silent_stop"], strict=True
        )
        if opt(e) is not None or opt(st) is not None
    }
    slow = [a for a, d in act.items() if d > thr]
    fast = [a for a, d in act.items() if d <= thr]
    s["slow_activation"] = {
        "threshold_days": thr,
        "churn_rate_slow": _r(float(np.mean([a in churned for a in slow]))),
        "accounts_slow": len(slow),
        "churn_rate_fast": _r(float(np.mean([a in churned for a in fast]))),
        "accounts_fast": len(fast),
    }
    return s


def dirty_rows(w: World) -> dict[str, Any]:
    dest = dirty_dest_currency(w)
    return {
        "currency_written_ngn_lowercase": int((dest == "ngn").sum()),
        "currency_written_naira_sign": int((dest == "₦").sum()),
        "duplicate_contacts_mixed_case_email": int(w.contacts["duplicate_of"].notna().sum()),
        "test_accounts": int((w.accounts["kind"] == "test").sum()),
        "internal_accounts": int((w.accounts["kind"] == "internal").sum()),
        "close_date_before_created_date": int(w.opps["bad_close_date"].sum()),
        "null_lead_source_leads": int(w.leads["observed_source"].isna().sum()),
        "null_lead_source_opportunities": int(w.opps["observed_source"].isna().sum()),
        "naive_timestamps": {"source": "crm_hubspot", "timezone": w.cfg["crm"]["hubspot_timezone"]},
        "orphan_merchants": int((w.merchants["account_id"] < 0).sum()),
        "orphan_transactions": int((w.transactions["account_id"] < 0).sum()),
    }


def identity(w: World) -> dict[str, Any]:
    c = w.customers
    explicit = int(c["has_billing_ref"].sum())
    unmatched = int(c["unmatchable"].sum())
    domain = len(c) - explicit - unmatched
    return {
        "billing_customers": len(c),
        "explicit_id": explicit,
        "domain": domain,
        "unmatched": unmatched,
        "match_rate": _r((explicit + domain) / len(c)),
    }


def dumps(key: dict[str, Any]) -> str:
    return json.dumps(key, indent=2, sort_keys=True, ensure_ascii=False, default=str) + "\n"

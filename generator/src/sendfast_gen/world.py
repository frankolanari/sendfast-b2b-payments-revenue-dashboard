"""The generator's internal truth: a simulated SendFast world (PLAN.md Stage 3).

Everything here is in canonical terms (UTC, USD, canonical enum values). `raw.py` turns it into
what each upstream source actually lands; `answer_key.py` computes the expected metrics from it.
Each component draws from its own seeded stream, so changing one doesn't reshuffle the others.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

import numpy as np
import pandas as pd

STAGES = ["discovery", "qualified", "proposal", "negotiation"]
SEGMENTS = ["smb", "mid_market", "enterprise"]
STREAMS = ["reps", "crm", "customers", "fx", "usage", "disputes", "billing", "ids", "dirty"]

REPS = [  # (first, last, team); rep 5 is the slipping-rep story, rep 12 left the company
    ("Ada", "Okafor", "smb"),
    ("Ben", "Mensah", "smb"),
    ("Chioma", "Eze", "smb"),
    ("Dan", "Kariuki", "smb"),
    ("Efe", "Adeyemi", "mid_market"),
    ("Femi", "Bello", "mid_market"),
    ("Grace", "Wanjiru", "mid_market"),
    ("Hassan", "Ali", "enterprise"),
    ("Ifeoma", "Nwosu", "enterprise"),
    ("James", "Boateng", "enterprise"),
    ("Kemi", "Lawal", "partnerships"),
    ("Liam", "Otieno", "partnerships"),
]
ARCHIVED_REP, ARCHIVED_ON = 12, date(2025, 12, 31)

COUNTRIES = {
    "NG": 0.30,
    "KE": 0.12,
    "GH": 0.08,
    "ZA": 0.07,
    "GB": 0.15,
    "US": 0.12,
    "DE": 0.04,
    "FR": 0.03,
    "NL": 0.03,
    "IN": 0.03,
    "AE": 0.02,
    "CA": 0.01,
}
INDUSTRIES = [
    "Logistics",
    "Marketplaces",
    "Software",
    "Healthcare",
    "Education",
    "Travel",
    "Commodities",
    "Manufacturing",
    "Retail",
    "Media",
    None,
]
NAME_A = [
    "Acme",
    "Kora",
    "Zuri",
    "Baobab",
    "Savanna",
    "Nile",
    "Harbor",
    "Atlas",
    "Lumen",
    "Kilima",
    "Sahel",
    "Delta",
    "Ember",
    "Orbit",
    "Tamarind",
    "Kestrel",
    "Juniper",
    "Mango",
    "Cobalt",
    "Granite",
    "Ivory",
    "Pioneer",
    "Summit",
    "Tidal",
    "Umoja",
    "Volta",
    "Wren",
    "Yarrow",
    "Zenith",
    "Marula",
    "Obsidian",
    "Peregrine",
    "Quartz",
    "Rift",
    "Serengeti",
]
NAME_B = [
    "Pay",
    "Logistics",
    "Trade",
    "Foods",
    "Tech",
    "Health",
    "Energy",
    "Imports",
    "Labs",
    "Freight",
    "Markets",
    "Capital",
    "Supply",
    "Travel",
    "Learning",
    "Media",
    "Agro",
]
NAME_SUFFIX = ["Ltd", "Limited", "Inc", "PLC", "Group", "GmbH", "BV", "LLC"]
TLD = {
    "NG": "com.ng",
    "KE": "co.ke",
    "GH": "com.gh",
    "ZA": "co.za",
    "GB": "co.uk",
    "DE": "de",
    "FR": "fr",
    "NL": "nl",
    "IN": "in",
    "AE": "ae",
}
CORRIDOR_POPULARITY = {
    "USD-NGN": 0.22,
    "GBP-NGN": 0.12,
    "EUR-NGN": 0.06,
    "USD-KES": 0.10,
    "GBP-KES": 0.05,
    "USD-GHS": 0.07,
    "USD-ZAR": 0.06,
    "USD-INR": 0.08,
    "EUR-EUR": 0.08,
    "GBP-GBP": 0.07,
    "USD-USD": 0.09,
}
FAILURE_REASONS = [
    "insufficient_funds",
    "compliance_hold",
    "beneficiary_bank_reject",
    "invalid_account",
    "rail_timeout",
    "fx_quote_expired",
]
FAILURE_MIX = [0.25, 0.15, 0.25, 0.20, 0.10, 0.05]
SPIKE_FAILURE_MIX = [0.05, 0.05, 0.45, 0.05, 0.38, 0.02]


@dataclass
class World:
    cfg: dict[str, Any]
    start: date
    as_of: date
    reps: pd.DataFrame
    accounts: pd.DataFrame
    contacts: pd.DataFrame
    leads: pd.DataFrame
    opps: pd.DataFrame
    stage_history: pd.DataFrame
    close_date_history: pd.DataFrame
    customers: pd.DataFrame
    pricing: pd.DataFrame
    fx: pd.DataFrame
    merchants: pd.DataFrame
    transactions: pd.DataFrame
    disputes: pd.DataFrame
    subscriptions: pd.DataFrame
    invoices: pd.DataFrame
    invoice_lines: pd.DataFrame
    revenue_monthly: pd.DataFrame


# ── Helpers ──────────────────────────────────────────────────────────────
def opt(value: Any) -> Any:
    """None for missing values (None, NaN, NaT); the value otherwise."""
    if value is None:
        return None
    try:
        return None if pd.isna(value) else value
    except (TypeError, ValueError):
        return value


def stable_id(prefix: str, *parts: Any, n: int = 14) -> str:
    """An opaque, deterministic id (like Stripe's), so ids never leak another system's keys."""
    digest = hashlib.sha256("|".join(map(str, (prefix, *parts))).encode()).hexdigest()
    return f"{prefix}{digest[:n]}"


def month_start(d: date) -> date:
    return d.replace(day=1)


def add_months(d: date, n: int) -> date:
    y, m = divmod(d.month - 1 + n, 12)
    return date(d.year + y, m + 1, 1)


def month_end(d: date) -> date:
    return add_months(d, 1) - timedelta(days=1)


def quarter_label(d: date) -> str:
    return f"{d.year}Q{(d.month - 1) // 3 + 1}"


def as_date(value: Any) -> date:
    return value if isinstance(value, date) else date.fromisoformat(str(value))


def business_time(rng: np.random.Generator, d: date) -> datetime:
    """A UTC timestamp between 08:00 and 18:00 UTC on calendar date `d`. Everything is UTC."""
    seconds = int(rng.integers(8 * 3600, 18 * 3600))
    return datetime(d.year, d.month, d.day, tzinfo=UTC) + timedelta(seconds=seconds)


def scaled(cfg: dict[str, Any], n: float, minimum: int = 1) -> int:
    return max(minimum, round(n * float(cfg["scale"])))


def pick(rng: np.random.Generator, weights: dict[str, float]) -> str:
    keys = list(weights)
    p = np.array([weights[k] for k in keys], dtype=float)
    return keys[int(rng.choice(len(keys), p=p / p.sum()))]


# ── CRM ──────────────────────────────────────────────────────────────────
def add_bad_close_dates(
    cfg: dict[str, Any], rng: np.random.Generator, opps: pd.DataFrame
) -> pd.DataFrame:
    """Dirty rows: some closed-lost deals carry a close date before their created date.

    A fixed count (at least 2) rather than a per-deal coin flip, so every scale - including the
    0.1 CI scale - contains this dirty-row type.
    """
    opps = opps.copy()
    lost = opps.index[opps["stage"] == "lost"]
    k = min(len(lost), max(2, round(cfg["dirty"]["close_before_create_rate"] * len(opps))))
    for i in sorted(rng.choice(lost, size=k, replace=False)):
        created = opps.at[i, "created_at"].date()
        opps.at[i, "observed_close_date"] = created - timedelta(days=int(rng.integers(1, 31)))
        opps.at[i, "bad_close_date"] = True
    return opps


def make_reps() -> pd.DataFrame:
    rows = []
    for i, (first, last, team) in enumerate(REPS, start=1):
        rows.append(
            {
                "rep_id": i,
                "first_name": first,
                "last_name": last,
                "team": team,
                "email": f"{first.lower()}.{last.lower()}@sendfast.example",
                "archived": i == ARCHIVED_REP,
            }
        )
    return pd.DataFrame(rows)


def _company_name(rng: np.random.Generator, used: set[str]) -> tuple[str, str]:
    while True:
        base = f"{NAME_A[rng.integers(len(NAME_A))]} {NAME_B[rng.integers(len(NAME_B))]}"
        if base in used and len(used) > len(NAME_A) * len(NAME_B) * 0.8:
            base = f"{base} {len(used)}"  # name space nearly full: number them
        if base not in used:
            used.add(base)
            return base, f"{base} {NAME_SUFFIX[rng.integers(len(NAME_SUFFIX))]}"


def _owner(rng: np.random.Generator, cfg: dict[str, Any], team: str, on: date) -> int:
    story = cfg["stories"]["slipping_rep"]
    ids = [i for i, (_, _, t) in enumerate(REPS, start=1) if t == team]
    ids = [i for i in ids if not (i == ARCHIVED_REP and on > ARCHIVED_ON)]
    w = np.array([story["pipeline_weight"] if i == story["rep"] else 1.0 for i in ids])
    return int(ids[rng.choice(len(ids), p=w / w.sum())])


def _lead_dates(rng: np.random.Generator, n: int, start: date, as_of: date) -> list[date]:
    """Lead volume grows over time: density rises linearly from 1.0 to 1.6."""
    u = np.sort(rng.random(n))
    x = (-1 + np.sqrt(1 + 1.56 * u)) / 0.6
    span = (as_of - start).days
    return [start + timedelta(days=int(v * span)) for v in x]


def _stage_path(rng, cfg, outcome: str, progress: float) -> list[str]:
    crm = cfg["crm"]
    if outcome == "open":
        path = STAGES[: min(4, max(1, math.ceil(progress * 4)))]
    elif outcome == "lost":
        path = STAGES[: int(rng.integers(1, 5))] + ["lost"]
    elif rng.random() < crm["reopen_rate"]:
        path = ["discovery", "qualified", "lost", "discovery", "proposal", "negotiation", "won"]
    else:
        path = STAGES + ["won"]
    path = list(path)
    if outcome != "open" and len(path) > 3 and rng.random() < crm["stage_skip_rate"]:
        path.pop(int(rng.integers(1, 3)))  # skip qualified or proposal
    if "proposal" in path and rng.random() < crm["stage_backward_rate"]:
        i = path.index("proposal")
        path[i + 1 : i + 1] = ["qualified", "proposal"]  # back to qualified, then forward again
    return path


def make_crm(cfg: dict[str, Any], rng: np.random.Generator, start: date, as_of: date):
    crm, dirty = cfg["crm"], cfg["dirty"]
    story_rep, story_partner = cfg["stories"]["slipping_rep"], cfg["stories"]["partner_leads"]
    as_of_end = datetime(as_of.year, as_of.month, as_of.day, 23, 59, 59, tzinfo=UTC)
    used_names: set[str] = set()
    accounts: list[dict[str, Any]] = []
    contacts: list[dict[str, Any]] = []
    leads: list[dict[str, Any]] = []
    opps: list[dict[str, Any]] = []
    stage_rows: list[dict[str, Any]] = []
    close_rows: list[dict[str, Any]] = []
    n_internal = 0

    lead_days = _lead_dates(rng, scaled(cfg, cfg["size"]["leads"]), start, as_of)
    for lead_i, lead_day in enumerate(lead_days):
        lead_at = business_time(rng, lead_day)
        source = pick(rng, crm["lead_sources"])
        if not accounts or rng.random() < crm["new_company_share"]:
            # partners refer larger companies than other channels bring in
            segment = pick(
                rng, story_partner["segments"] if source == "partner" else crm["segments"]
            )
            country = pick(rng, COUNTRIES)
            short, legal = _company_name(rng, used_names)
            kind = "customer"
            r = rng.random()
            if r < dirty["test_account_rate"]:
                kind, short, legal = "test", f"Test {short}", f"Test - {legal}"
            elif r < dirty["test_account_rate"] + dirty["internal_account_rate"]:
                n_internal += 1
                kind = "internal"
                short = legal = f"SendFast Internal {n_internal}"
            slug = short.lower().replace(" ", "").replace("-", "")
            domain = (
                "sendfast.example" if kind == "internal" else f"{slug}.{TLD.get(country, 'com')}"
            )
            accounts.append(
                {
                    "account_id": 10_000_000 + len(accounts) + 1,
                    "name": legal,
                    "short_name": short,
                    "domain": domain,
                    "industry": INDUSTRIES[rng.integers(len(INDUSTRIES))],
                    "country": country,
                    "segment": segment,
                    "kind": kind,
                    "owner_rep": _owner(rng, cfg, segment, lead_day),
                    "created_at": lead_at - timedelta(minutes=int(rng.integers(5, 400))),
                }
            )
            account = accounts[-1]
        else:
            account = accounts[int(rng.integers(len(accounts)))]

        first = REPS[int(rng.integers(len(REPS)))][0]
        contact_id = 20_000_000 + len(contacts) + 1
        contacts.append(
            {
                "contact_id": contact_id,
                "account_id": account["account_id"],
                "email": f"{first.lower()}.{len(contacts) + 1}@{account['domain']}",
                "title": ["CFO", "Head of Finance", "COO", "Treasury Manager", "CEO", None][
                    rng.integers(6)
                ],
                "created_at": lead_at,
                "duplicate_of": None,
            }
        )

        observed_source = None if rng.random() < dirty["null_lead_source_rate"] else source
        converted_at = None
        if rng.random() < crm["conversion_rate"][source]:
            converted_at = business_time(rng, lead_day + timedelta(days=int(rng.integers(2, 40))))
            if converted_at > as_of_end:
                converted_at = None
        lead_id = 30_000_000 + lead_i + 1
        leads.append(
            {
                "lead_id": lead_id,
                "contact_id": contact_id,
                "account_id": account["account_id"],
                "source": source,
                "observed_source": observed_source,
                "created_at": lead_at,
                "converted_at": converted_at,
            }
        )
        if converted_at is None:
            continue

        # ── Opportunity ───────────────────────────────────────────────────
        team = "partnerships" if source == "partner" and rng.random() < 0.7 else account["segment"]
        owner = _owner(rng, cfg, team, converted_at.date())
        seg = account["segment"]
        median = crm["deal_size_median_usd"][seg]
        amount = round(float(rng.lognormal(math.log(median), crm["deal_size_sigma"])), -2)
        amount = None if rng.random() < 0.02 else amount
        p_win = crm["win_rate"][source]
        p_win *= story_partner["win_rate_multiplier"] if source == "partner" else 1.0
        is_story_rep = owner == story_rep["rep"]
        p_win *= story_rep["win_rate_multiplier"] if is_story_rep else 1.0
        slip_rate = story_rep["slip_rate"] if is_story_rep else crm["slip_rate"]
        stale_rate = (
            story_rep["stale_close_date_rate"] if is_story_rep else crm["stale_close_date_rate"]
        )

        created = converted_at
        cycle = max(7, int(rng.lognormal(math.log(crm["cycle_days_median"][seg]), 0.5)))
        expected = created.date() + timedelta(days=cycle)
        slips = [int(rng.integers(14, 46)) for _ in range(3) if rng.random() < slip_rate]
        final = expected + timedelta(days=sum(slips))
        me = month_end(final)
        if (me - final).days <= 10 and rng.random() < crm["month_end_snap_rate"]:
            final = me  # deals cluster at month end (and so at quarter end)
        closed = final <= as_of
        won = closed and rng.random() < p_win
        outcome = "won" if won else ("lost" if closed else "open")
        span = max(1, (final - created.date()).days)
        progress = min(1.0, (as_of - created.date()).days / span)

        stale = outcome == "open" and bool(slips) and rng.random() < stale_rate
        observed_close = expected if stale else final

        opp_id = 40_000_000 + len(opps) + 1
        path = _stage_path(rng, cfg, outcome, progress)
        end_at = business_time(rng, final) if closed else created + (as_of_end - created) * 0.9
        n = len(path)
        times = [created + (end_at - created) * (k / max(1, n - 1)) for k in range(n)]
        if closed:
            times[-1] = end_at
        for k in range(1, n):  # strictly increasing
            times[k] = max(times[k], times[k - 1] + timedelta(minutes=1))
        for stage, at in zip(path, times, strict=True):
            stage_rows.append({"opp_id": opp_id, "stage": stage, "entered_at": at})

        close_rows.append({"opp_id": opp_id, "value": expected, "changed_at": created})
        running = expected
        for slip in slips:
            if stale or running > as_of:
                break
            changed = business_time(rng, running)
            running = running + timedelta(days=slip)
            close_rows.append({"opp_id": opp_id, "value": running, "changed_at": changed})
        if closed and running != final:
            close_rows.append({"opp_id": opp_id, "value": final, "changed_at": end_at})

        opps.append(
            {
                "opp_id": opp_id,
                "account_id": account["account_id"],
                "owner_rep": owner,
                "amount_usd": amount,
                "created_at": created,
                "close_date": final,
                "observed_close_date": observed_close,
                "bad_close_date": False,
                "stage": path[-1],
                "is_closed": closed,
                "is_won": won,
                "source": source,
                "observed_source": observed_source,
                "lead_id": lead_id,
                "n_slips": len(slips),
                "stale_close_date": stale,
            }
        )

    # Duplicate contacts: the same person again, email in different case
    for c in list(contacts):
        if rng.random() < dirty["duplicate_contact_rate"]:
            local, _, dom = c["email"].partition("@")
            contacts.append(
                {
                    **c,
                    "contact_id": 20_000_000 + len(contacts) + 1,
                    "email": f"{local.capitalize()}@{dom.upper()}",
                    "created_at": c["created_at"] + timedelta(days=int(rng.integers(1, 60))),
                    "duplicate_of": c["contact_id"],
                }
            )

    return (
        pd.DataFrame(accounts),
        pd.DataFrame(contacts),
        pd.DataFrame(leads),
        pd.DataFrame(opps),
        pd.DataFrame(stage_rows),
        pd.DataFrame(close_rows),
    )


# ── Customers, pricing, lifecycle ────────────────────────────────────────
def _vary(rng: np.random.Generator, base: float, low: float = 0.85, high: float = 1.15) -> float:
    return round(base * float(rng.uniform(low, high)))


def _latest_price(pricing: list[dict[str, Any]], account_id: int, on: date) -> dict[str, Any]:
    rows = [p for p in pricing if p["account_id"] == account_id and p["effective_from"] <= on]
    return max(rows, key=lambda p: p["effective_from"])


def make_customers(cfg, rng, accounts: pd.DataFrame, opps: pd.DataFrame, as_of: date):
    cust_cfg, dirty, stories = cfg["customers"], cfg["dirty"], cfg["stories"]
    won = opps[opps["is_won"]].sort_values(["close_date", "opp_id"])
    first_won = won.drop_duplicates("account_id", keep="first")
    acc = accounts.set_index("account_id")
    story3 = stories["pricing_change_cohort"]
    change_date = as_date(story3["change_date"])
    slow_cfg = stories["slow_activation"]
    rows: list[dict[str, Any]] = []
    pricing: list[dict[str, Any]] = []

    for _, opp in first_won.iterrows():
        a = acc.loc[opp["account_id"]]
        seg, kind, aid = a["segment"], a["kind"], int(opp["account_id"])
        won_date = opp["close_date"]
        delay_cfg = cust_cfg["live_delay"]
        r = rng.random()
        if r < delay_cfg["never_live_share"]:
            delay = None
        elif r < delay_cfg["never_live_share"] + delay_cfg["slow"]["share"]:
            slow = delay_cfg["slow"]
            delay = int(rng.lognormal(math.log(slow["median"]), slow["sigma"]))
        else:
            fast = delay_cfg["fast"]
            delay = max(1, int(rng.lognormal(math.log(fast["median"]), fast["sigma"])))
        live = won_date + timedelta(days=delay) if delay is not None else None
        live = live if live is not None and live <= as_of else None

        has_ref = kind == "internal" or rng.random() >= dirty["missing_billing_ref_rate"]
        p_unmatch = dirty["unmatchable_rate"] / dirty["missing_billing_ref_rate"]
        unmatchable = (not has_ref) and rng.random() < p_unmatch
        p = cust_cfg["pricing"]
        pricing.append(
            {
                "account_id": aid,
                "effective_from": won_date,
                "reason": "initial",
                "fee_bps": _vary(rng, p["fee_bps"][seg]),
                "fx_margin_bps": _vary(rng, p["fx_margin_bps"][seg]),
                "platform_fee_usd": float(p["platform_fee_usd"][seg] * rng.choice([0.8, 1.0, 1.2])),
                "min_commit_usd": float(
                    p["min_commit_usd"][seg] * rng.choice([0.0, 1.0, 1.0, 1.5])
                ),
            }
        )
        rows.append(
            {
                "account_id": aid,
                "segment": seg,
                "kind": kind,
                "won_date": won_date,
                "won_opp_id": int(opp["opp_id"]),
                "source": opp["source"],
                "observed_source": opp["observed_source"],
                "live_date": live,
                "has_billing_ref": has_ref,
                "unmatchable": unmatchable,
                "contract_end": None,
                "silent_stop": None,
                "reactivated": None,
                "expansion_date": None,
                "expansion_mult": 1.0,
                "contraction_date": None,
                "contraction_mult": 1.0,
                "story3": live is not None
                and quarter_label(live) == str(story3["cohort"])
                and live < change_date,
                "concentration": False,
            }
        )

    # Concentration story: the earliest-live enterprise customer carries ~30% of TPV, never churns
    live_real = [r for r in rows if r["live_date"] is not None and r["kind"] == "customer"]
    ent = [r for r in live_real if r["segment"] == "enterprise"] or live_real
    min(ent, key=lambda r: (r["live_date"], r["account_id"]))["concentration"] = True

    for c in rows:
        live = c["live_date"]
        if live is None:
            continue
        activation = (live - c["won_date"]).days
        immune = c["concentration"] or c["kind"] != "customer"
        m, churn = month_start(live), None
        while m <= as_of and not immune:
            h = cust_cfg["monthly_churn_hazard"][c["segment"]]
            if (m - live).days < cust_cfg["early_life_days"]:
                h *= cust_cfg["early_life_multiplier"]
            if activation > slow_cfg["threshold_days"]:
                h *= slow_cfg["churn_hazard_multiplier"]
            if c["story3"] and m >= change_date:
                h *= story3["churn_hazard_multiplier"]
            if c["source"] == "partner":
                h *= stories["partner_leads"]["churn_hazard_multiplier"]
            if rng.random() < min(0.9, h):
                lo, hi = max(m, live + timedelta(days=14)), min(month_end(m), as_of)
                if lo <= hi:
                    churn = lo + timedelta(days=int(rng.integers(0, (hi - lo).days + 1)))
                    break
            m = add_months(m, 1)
        # the price rise is a shock: a share of the cohort leaves within ~4 months of it
        exposed = c["story3"] and not immune and (churn is None or churn > change_date)
        if exposed and rng.random() < story3["price_shock_churn_rate"]:
            shock = change_date + timedelta(days=int(rng.integers(14, 121)))
            if shock <= as_of:
                churn = shock
        if churn is not None:
            if rng.random() < cust_cfg["contract_churn_share"]:
                c["contract_end"] = churn
            else:
                c["silent_stop"] = churn
                if rng.random() < cust_cfg["silent_reactivation_rate"]:
                    back = churn + timedelta(days=int(rng.integers(60, 151)))
                    c["reactivated"] = back if back <= as_of else None
        end = c["contract_end"] or as_of
        if rng.random() < cust_cfg["expansion_rate"]:
            d = live + timedelta(days=int(rng.integers(150, 421)))
            if d < end:
                c["expansion_date"], c["expansion_mult"] = d, float(rng.uniform(1.4, 2.0))
                if rng.random() < 0.5:  # renegotiated: volume up, rate down
                    base = _latest_price(pricing, c["account_id"], d)
                    pricing.append(
                        {
                            **base,
                            "effective_from": d,
                            "reason": "expansion",
                            "fee_bps": round(base["fee_bps"] * 0.85),
                        }
                    )
        if rng.random() < cust_cfg["contraction_rate"]:
            d = live + timedelta(days=int(rng.integers(120, 501)))
            if d < end:
                c["contraction_date"], c["contraction_mult"] = d, float(rng.uniform(0.4, 0.7))
        silent_before = c["silent_stop"] is not None and c["silent_stop"] < change_date
        if c["story3"] and change_date < end and not silent_before:
            base = _latest_price(pricing, c["account_id"], change_date)
            pricing.append(
                {
                    **base,
                    "effective_from": change_date,
                    "reason": "price_rise",
                    "platform_fee_usd": base["platform_fee_usd"]
                    * story3["platform_fee_multiplier"],
                    "fee_bps": base["fee_bps"] + story3["fee_bps_increase"],
                }
            )

    pr = pd.DataFrame(pricing).sort_values(["account_id", "effective_from"], kind="stable")
    pr = pr.drop_duplicates(["account_id", "effective_from"], keep="last").reset_index(drop=True)
    nxt = pr.groupby("account_id")["effective_from"].shift(-1)
    pr["effective_to"] = [None if opt(n) is None else n - timedelta(days=1) for n in nxt]
    return pd.DataFrame(rows), pr


# ── FX ───────────────────────────────────────────────────────────────────
def make_fx(cfg, rng, start: date, as_of: date) -> pd.DataFrame:
    fx = cfg["fx"]
    days = (as_of - start).days + 1
    dates = [start + timedelta(days=k) for k in range(days)]
    dev = fx["devaluation"]
    rows = []
    for ccy, level in fx["start"].items():
        steps = rng.normal(0.0, fx["volatility"][ccy] / math.sqrt(365), days)
        steps[0] = 0.0
        path = level * np.exp(np.cumsum(steps))
        if ccy == dev["currency"]:
            after = np.array([d >= as_date(dev["date"]) for d in dates])
            path = np.where(after, path * (1 + dev["step"]), path)
        for d, v in zip(dates, path, strict=True):
            rows.append(
                {
                    "rate_date": d,
                    "base_currency": "USD",
                    "quote_currency": ccy,
                    "rate": round(float(v), 6),
                    "source": "sendfast-synthetic-fx",
                }
            )
    return pd.DataFrame(rows)


# ── Transactions ─────────────────────────────────────────────────────────
def _season(cfg, start: date, days: int) -> np.ndarray:
    u = cfg["usage"]
    out = np.empty(days)
    for k in range(days):
        d = start + timedelta(days=k)
        f = u["weekday_factor"][d.weekday()]
        f *= u["payday_factor"] if d.day in u["payday_days"] else 1.0
        f *= u["december_factor"] if d.month == 12 else 1.0
        out[k] = f
    return out


def _hex_ids(rng: np.random.Generator, prefix: str, n: int, width: int = 16) -> np.ndarray:
    ids = rng.integers(0, 2**62, n, dtype=np.int64)
    if len(np.unique(ids)) != n:
        raise RuntimeError(f"id collision generating {prefix} ids")
    return np.array([f"{prefix}{v:0{width}x}" for v in ids], dtype=object)


def _choice(rng: np.random.Generator, options: dict[str, float], n: int) -> np.ndarray:
    names = np.array(list(options), dtype=object)
    p = np.array(list(options.values()), dtype=float)
    return names[rng.choice(len(names), n, p=p / p.sum())]


def make_transactions(
    cfg,
    rng,
    ids_rng,
    customers: pd.DataFrame,
    fx: pd.DataFrame,
    sim_start: date,
    start: date,
    as_of: date,
):
    """Simulate from sim_start so customers exist when the window opens; calibrate on it."""
    u, stories = cfg["usage"], cfg["stories"]
    days = (as_of - sim_start).days + 1
    season = _season(cfg, sim_start, days)
    day_idx = np.arange(days)
    w0 = (start - sim_start).days  # first day of the data window
    t12_from = (add_months(month_start(as_of), -11) - sim_start).days
    fx_lookup = {
        c: g.sort_values("rate_date")["rate"].to_numpy() for c, g in fx.groupby("quote_currency")
    }

    actors = []
    for _, c in customers.iterrows():
        if opt(c["live_date"]) is None:
            continue
        actors.append(
            {
                "account_id": int(c["account_id"]),
                "segment": c["segment"],
                "kind": c["kind"],
                "live": c["live_date"],
                "contract_end": opt(c["contract_end"]),
                "silent_stop": opt(c["silent_stop"]),
                "reactivated": opt(c["reactivated"]),
                "source": c["source"],
                "concentration": bool(c["concentration"]),
                "events": [
                    (opt(c["expansion_date"]), c["expansion_mult"]),
                    (opt(c["contraction_date"]), c["contraction_mult"]),
                ],
            }
        )
    for k in range(scaled(cfg, cfg["size"]["orphan_merchants"])):
        live = start + timedelta(days=int(rng.integers(60, (as_of - start).days - 200)))
        actors.append(
            {
                "account_id": -(k + 1),
                "segment": "smb",
                "kind": "orphan",
                "live": live,
                "contract_end": None,
                "silent_stop": None,
                "reactivated": None,
                "source": None,
                "concentration": False,
                "events": [],
            }
        )

    corridors = list(CORRIDOR_POPULARITY)
    pop = np.array([CORRIDOR_POPULARITY[c] for c in corridors])
    shapes, rates, tickets, mixes, t12 = [], [], [], [], []
    for a in actors:
        live_i = (a["live"] - sim_start).days
        end_i = (a["contract_end"] - sim_start).days if a["contract_end"] else days - 1
        mask = (day_idx >= live_i) & (day_idx <= end_i)
        if a["silent_stop"]:
            stop_i = (a["silent_stop"] - sim_start).days
            back_i = (a["reactivated"] - sim_start).days if a["reactivated"] else days
            mask &= ~((day_idx >= stop_i) & (day_idx < back_i))
        t = day_idx - live_i
        ramp = 1.0 / (1.0 + np.exp(-(t - u["ramp_midpoint_days"]) / u["ramp_width_days"]))
        drift = np.exp(rng.normal(0.01, 0.025) * np.maximum(t, 0) / 30.0)
        events = np.ones(days)
        for d, mult in a["events"]:
            if d is not None:
                events[day_idx >= (d - sim_start).days] *= mult
        seg = a["segment"]
        rate = float(rng.lognormal(u["plateau_rate_log_mean"][seg], u["plateau_rate_log_sigma"]))
        rate *= stories["partner_leads"]["volume_multiplier"] if a["source"] == "partner" else 1.0
        rate *= 0.05 if a["kind"] in ("test", "internal") else 1.0
        rate = 0.4 if a["kind"] == "orphan" else rate
        ticket = float(rng.lognormal(math.log(u["ticket_usd_median"][seg]), 0.4))
        if a["concentration"]:
            ticket, mix = 25000.0, {"USD-NGN": 0.5, "GBP-NGN": 0.3, "USD-KES": 0.2}
        else:
            k = int(rng.integers(1, 5))
            chosen = sorted(rng.choice(len(corridors), size=k, replace=False, p=pop / pop.sum()))
            w = rng.dirichlet(np.ones(k))
            mix = {corridors[j]: float(wj) for j, wj in zip(chosen, w, strict=True)}
        shape = season * ramp * drift * events * mask
        shapes.append(shape)
        rates.append(rate)
        tickets.append(ticket)
        mixes.append(mix)
        t12.append(float(shape[t12_from:].sum()))

    # Calibrate: expected total count hits the target; the concentration account gets its TPV share
    target = cfg["size"]["transactions"] * float(cfg["scale"])
    share = stories["concentration"]["volume_share"]
    big = next(i for i, a in enumerate(actors) if a["concentration"])
    others = [i for i in range(len(actors)) if i != big]
    c_others = sum(rates[i] * shapes[i][w0:].sum() for i in others)
    v_others_t12 = sum(rates[i] * t12[i] * tickets[i] for i in others)
    k_big = (share / (1 - share)) * v_others_t12 / (t12[big] * tickets[big])
    factor = target / (c_others + k_big * shapes[big][w0:].sum())
    rates = [r * factor for r in rates]
    rates[big] = k_big * factor

    spike = cfg["stories"]["corridor_spike"]
    spike_m = date.fromisoformat(f"{spike['month']}-01")
    spike_from, spike_to = (spike_m - sim_start).days, (month_end(spike_m) - sim_start).days
    parts = []
    for a, shape, rate, ticket, mix in zip(actors, shapes, rates, tickets, mixes, strict=True):
        counts = rng.poisson(rate * shape)
        live_i = (a["live"] - sim_start).days
        counts[live_i] = max(1, counts[live_i])  # the first live transaction
        d = np.repeat(day_idx, counts)
        n = len(d)
        first = np.zeros(n, dtype=bool)
        first[0] = True
        secs = np.clip(rng.normal(14 * 3600, 3.5 * 3600, n), 0, 86399).astype(np.int64)
        corr = _choice(rng, mix, n)
        rail = np.empty(n, dtype=object)
        for cname in mix:
            sel = corr == cname
            rail[sel] = _choice(rng, u["corridors"][cname], int(sel.sum()))
        usd_target = ticket * rng.lognormal(0.0, 0.7, n)
        src = np.array([c.split("-")[0] for c in corr], dtype=object)
        dst = np.array([c.split("-")[1] for c in corr], dtype=object)
        src_rate = np.ones(n)
        for ccy in ("GBP", "EUR"):
            sel = src == ccy
            src_rate[sel] = fx_lookup[ccy][d[sel]]
        amount_minor = np.maximum(100, np.round(usd_target * src_rate * 100)).astype(np.int64)
        p_fail = np.array([u["failure_rate"][r] for r in rail])
        in_spike = (
            (corr == spike["corridor"])
            & (rail == spike["rail"])
            & (d >= spike_from)
            & (d <= spike_to)
        )
        p_fail = np.where(in_spike, spike["failure_rate"], p_fail)
        roll = rng.random(n)
        status = np.where(
            roll < p_fail,
            "failed",
            np.where(roll < p_fail + u["reversal_rate"], "reversed", "succeeded"),
        )
        status = np.where(first, "succeeded", status).astype(object)
        reason = np.full(n, None, dtype=object)
        failed = status == "failed"
        for mask, mix_p in (
            (failed & ~in_spike, FAILURE_MIX),
            (failed & in_spike, SPIKE_FAILURE_MIX),
        ):
            reason[mask] = _choice(
                rng, dict(zip(FAILURE_REASONS, mix_p, strict=True)), int(mask.sum())
            )
        parts.append(
            pd.DataFrame(
                {
                    "account_id": a["account_id"],
                    "day": d,
                    "secs": secs,
                    "corridor": corr,
                    "rail": rail,
                    "source_currency": src,
                    "dest_currency": dst,
                    "amount_minor": amount_minor,
                    "usd_amount": amount_minor / 100.0 / src_rate,
                    "status": status,
                    "failure_reason": reason,
                    "first_live": first,
                }
            )
        )
    tx = pd.concat(parts, ignore_index=True)
    base = np.datetime64(datetime(sim_start.year, sim_start.month, sim_start.day), "s")
    offsets = (tx["day"].to_numpy() * 86400 + tx["secs"].to_numpy()).astype("timedelta64[s]")
    tx["created_at"] = base + offsets
    tx["txn_date"] = [sim_start + timedelta(days=int(v)) for v in tx["day"]]
    tx = tx.sort_values(["created_at", "account_id", "amount_minor"], kind="stable").reset_index(
        drop=True
    )
    tx.insert(0, "transaction_id", _hex_ids(ids_rng, "txn_", len(tx)))
    return tx.drop(columns=["secs"])


def make_disputes(cfg, rng, ids_rng, tx: pd.DataFrame, as_of: date) -> pd.DataFrame:
    u = cfg["usage"]
    ok = tx[tx["status"] == "succeeded"]
    ret = np.array([u["return_rate"].get(r, u["return_rate"]["default"]) for r in ok["rail"]])
    roll = rng.random(len(ok))
    is_dispute = roll < u["dispute_rate"]
    is_return = ~is_dispute & (roll < u["dispute_rate"] + ret)
    picked = ok[is_dispute | is_return].copy()
    picked["dispute_type"] = np.where(is_dispute[is_dispute | is_return], "dispute", "return")
    n = len(picked)
    created = picked["created_at"].to_numpy().astype("datetime64[s]")
    opened = created + (rng.integers(30, 91, n) * 86400 + rng.integers(0, 86400, n)).astype(
        "timedelta64[s]"
    )
    resolved = opened + (rng.integers(7, 46, n) * 86400).astype("timedelta64[s]")
    won = rng.random(n) < 0.55
    as_of_end = np.datetime64(datetime(as_of.year, as_of.month, as_of.day, 23, 59, 59), "s")
    keep = opened <= as_of_end
    still_open = resolved > as_of_end
    out = pd.DataFrame(
        {
            "transaction_id": picked["transaction_id"].to_numpy(),
            "account_id": picked["account_id"].to_numpy(),
            "dispute_type": picked["dispute_type"].to_numpy(),
            "opened_at": opened,
            "resolved_at": np.where(still_open, np.datetime64("NaT", "s"), resolved),
            "outcome": np.where(still_open, None, np.where(won, "won", "lost")).astype(object),
            "amount_minor": picked["amount_minor"].to_numpy(),
            "currency": picked["source_currency"].to_numpy(),
        }
    )[keep].reset_index(drop=True)
    out.insert(0, "dispute_id", _hex_ids(ids_rng, "dp_", len(out), 12))
    return out


# ── Billing and revenue ──────────────────────────────────────────────────
def make_billing(
    cfg, rng, customers: pd.DataFrame, pricing: pd.DataFrame, tx: pd.DataFrame, as_of: date
):
    """Monthly platform-fee invoices plus next-month min-commit true-ups, and the revenue truth."""
    last_month = month_start(as_of)
    cols = ["account_id", "txn_date", "usd_amount", "source_currency", "dest_currency"]
    ok = tx[(tx["status"] == "succeeded") & (tx["account_id"] > 0)][cols].copy()
    ok["txn_ts"] = pd.to_datetime(ok["txn_date"])
    pr = pricing.copy()
    pr["eff_ts"] = pd.to_datetime(pr["effective_from"])
    ok = pd.merge_asof(
        ok.sort_values("txn_ts"),
        pr.sort_values("eff_ts"),
        left_on="txn_ts",
        right_on="eff_ts",
        by="account_id",
    )
    if ok["fee_bps"].isna().any():
        raise RuntimeError("a transaction has no pricing effective on its date")
    ok["usage_fee"] = ok["usd_amount"] * ok["fee_bps"] / 10_000
    cross = ok["source_currency"] != ok["dest_currency"]
    ok["fx_margin"] = np.where(cross, ok["usd_amount"] * ok["fx_margin_bps"] / 10_000, 0.0)
    ok["month"] = [d.replace(day=1) for d in ok["txn_date"]]
    usage = ok.groupby(["account_id", "month"])[["usage_fee", "fx_margin"]].sum()
    usage_d = {k: (float(v["usage_fee"]), float(v["fx_margin"])) for k, v in usage.iterrows()}
    price_rows = {
        aid: g.sort_values("effective_from").to_dict("records")
        for aid, g in pricing.groupby("account_id")
    }

    def price(aid: int, on: date) -> dict[str, Any]:
        return [p for p in price_rows[aid] if p["effective_from"] <= on][-1]

    subs, invoices, lines, revenue = [], [], [], []
    for _, c in customers.sort_values("account_id").iterrows():
        live = opt(c["live_date"])
        if live is None:
            continue
        aid, end = int(c["account_id"]), opt(c["contract_end"])
        months, m = [], month_start(live)
        while m <= min(month_start(end) if end else last_month, last_month):
            months.append(m)
            m = add_months(m, 1)
        waived = {months[0], month_start(end) if end else None}  # first (partial) and churn month
        true_ups = {}
        for m in months:
            if m in waived or add_months(m, 1) > last_month:
                continue
            commit = float(price(aid, m)["min_commit_usd"])
            used = sum(usage_d.get((aid, m), (0.0, 0.0)))
            if commit > used:
                true_ups[m] = round(commit - used, 2)
        sub_id = stable_id("sub_", aid)
        fees = {}
        for m in months:
            fees[m] = round(float(price(aid, max(m, live))["platform_fee_usd"]), 2)
            first = m == months[0]
            created = (
                datetime(live.year, live.month, live.day, 9, tzinfo=UTC)
                if first
                else datetime(m.year, m.month, 1, tzinfo=UTC)
            )
            inv_id = stable_id("in_", aid, m)
            inv_lines = [
                {
                    "line_id": stable_id("il_", aid, m, "fee"),
                    "invoice_id": inv_id,
                    "line_type": "platform_fee",
                    "amount_usd": fees[m],
                    "period": m,
                }
            ]
            prev = add_months(m, -1)
            if prev in true_ups:
                inv_lines.append(
                    {
                        "line_id": stable_id("il_", aid, m, "true_up"),
                        "invoice_id": inv_id,
                        "line_type": "usage_true_up",
                        "amount_usd": true_ups[prev],
                        "period": prev,
                    }
                )
            total = round(sum(x["amount_usd"] for x in inv_lines), 2)
            late = end is not None and (month_start(end) - m).days < 62
            status = (
                "open"
                if m == last_month
                else ("uncollectible" if late and rng.random() < 0.15 else "paid")
            )
            invoices.append(
                {
                    "invoice_id": inv_id,
                    "account_id": aid,
                    "subscription_id": sub_id,
                    "status": status,
                    "total_usd": total,
                    "paid_usd": total if status == "paid" else 0.0,
                    "period": m,
                    "created_at": created,
                }
            )
            lines += inv_lines
        started = datetime(live.year, live.month, live.day, 9, tzinfo=UTC)
        subs.append(
            {
                "subscription_id": sub_id,
                "account_id": aid,
                "status": "canceled" if end else "active",
                "monthly_fee_usd": round(float(price(aid, end or as_of)["platform_fee_usd"]), 2),
                "started_at": started,
                "canceled_at": max(
                    started,
                    datetime(end.year, end.month, end.day, 9, tzinfo=UTC) - timedelta(days=30),
                )
                if end
                else None,
                "ended_at": datetime(end.year, end.month, end.day, 23, 59, 59, tzinfo=UTC)
                if end
                else None,
            }
        )
        for m in months:
            uf, fxm = usage_d.get((aid, m), (0.0, 0.0))
            revenue.append(
                {
                    "account_id": aid,
                    "month": m,
                    "platform_fee": fees[m],
                    "usage_fee": uf,
                    "fx_margin": fxm,
                    "true_up": true_ups.get(m, 0.0),
                }
            )
    rev = pd.DataFrame(revenue)
    billed = set(zip(rev["account_id"], rev["month"], strict=True))
    unbilled = [k for k in usage_d if k not in billed]
    if unbilled:
        raise RuntimeError(f"{len(unbilled)} account-months have usage but no subscription month")
    rev["net_revenue"] = rev[["platform_fee", "usage_fee", "fx_margin", "true_up"]].sum(axis=1)
    return pd.DataFrame(subs), pd.DataFrame(invoices), pd.DataFrame(lines), rev


# ── Merchants ────────────────────────────────────────────────────────────
def make_merchants(
    customers: pd.DataFrame, accounts: pd.DataFrame, tx: pd.DataFrame
) -> pd.DataFrame:
    acc = accounts.set_index("account_id")
    rows = []
    for _, c in customers.sort_values("account_id").iterrows():
        a = acc.loc[c["account_id"]]
        rows.append(
            {
                "merchant_id": stable_id("mer_", int(c["account_id"]), n=12),
                "account_id": int(c["account_id"]),
                "legal_name": a["name"],
                "domain": a["domain"],
                "live_date": opt(c["live_date"]),
                "onboarded": c["won_date"],
                "in_billing": True,
            }
        )
    orphans = tx[tx["account_id"] < 0].groupby("account_id")["txn_date"].min()
    for aid, first in sorted(orphans.items(), key=lambda kv: -kv[0]):
        rows.append(
            {
                "merchant_id": stable_id("mer_", "orphan", int(aid), n=12),
                "account_id": int(aid),
                "legal_name": f"Pilot Merchant {-int(aid)}",
                "domain": None,
                "live_date": first,
                "onboarded": first - timedelta(days=7),
                "in_billing": False,
            }
        )
    return pd.DataFrame(rows)


# ── Assemble ─────────────────────────────────────────────────────────────
def build_world(cfg: dict[str, Any]) -> World:
    as_of = as_date(cfg["as_of"])
    start = add_months(
        month_start(as_of), -(int(cfg["months"]) - 1)
    )  # first day of the data window
    sim_start = add_months(
        start, -int(cfg.get("warmup_months", 0))
    )  # the business existed before it
    seeds = np.random.SeedSequence(int(cfg["seed"])).spawn(len(STREAMS))
    rng = {name: np.random.default_rng(s) for name, s in zip(STREAMS, seeds, strict=True)}

    reps = make_reps()
    accounts, contacts, leads, opps, stage_history, close_hist = make_crm(
        cfg, rng["crm"], sim_start, as_of
    )
    opps = add_bad_close_dates(cfg, rng["dirty"], opps)
    customers, pricing = make_customers(cfg, rng["customers"], accounts, opps, as_of)
    fx = make_fx(cfg, rng["fx"], sim_start, as_of)
    all_tx = make_transactions(
        cfg, rng["usage"], rng["ids"], customers, fx, sim_start, start, as_of
    )
    merchants = make_merchants(customers, accounts, all_tx)
    all_tx["merchant_id"] = all_tx["account_id"].map(
        merchants.set_index("account_id")["merchant_id"]
    )
    subs, invoices, lines, revenue = make_billing(
        cfg, rng["billing"], customers, pricing, all_tx, as_of
    )

    # The sources hold the data window only (the CRM keeps its full history, as CRMs do)
    tx = all_tx[all_tx["txn_date"] >= start].reset_index(drop=True)
    disputes = make_disputes(cfg, rng["disputes"], rng["ids"], tx, as_of)
    fx = fx[fx["rate_date"] >= start].reset_index(drop=True)
    invoices = invoices[invoices["period"] >= start].reset_index(drop=True)
    lines = lines[lines["invoice_id"].isin(set(invoices["invoice_id"]))].reset_index(drop=True)
    revenue = revenue[revenue["month"] >= start].reset_index(drop=True)
    return World(
        cfg,
        start,
        as_of,
        reps,
        accounts,
        contacts,
        leads,
        opps,
        stage_history,
        close_hist,
        customers,
        pricing,
        fx,
        merchants,
        tx,
        disputes,
        subs,
        invoices,
        lines,
        revenue,
    )

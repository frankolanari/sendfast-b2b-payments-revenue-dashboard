"""Turn the world into what each upstream source actually lands (PLAN.md Stage 3).

- crm_hubspot: HubSpot-shaped; internal stage and source codes; free-text countries; naive
  timestamps (no zone marker), which are UTC. Everything in this project is UTC.
- billing: Stripe-shaped; minor units; Unix timestamps; lower-case currency codes.
- ledger: the payments platform's own DB; minor units; timestamptz; NGN sometimes written `ngn`/`₦`.
- rates: FX rates and per-account pricing with effective dates.

Every table is pre-formatted to strings here, so the CSV (and its hash) is byte-for-byte stable.
"""

from __future__ import annotations

import hashlib
import io
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Any

import numpy as np
import pandas as pd

from .world import World, opt, stable_id

COUNTRY_NAMES = {
    "NG": "Nigeria",
    "KE": "Kenya",
    "GH": "Ghana",
    "ZA": "South Africa",
    "GB": "United Kingdom",
    "US": "United States",
    "DE": "Germany",
    "FR": "France",
    "NL": "Netherlands",
    "IN": "India",
    "AE": "United Arab Emirates",
    "CA": "Canada",
}
SEGMENT_HS = {"smb": "SMB", "mid_market": "Mid-Market", "enterprise": "Enterprise"}
TEAM_HS = {
    "smb": "SMB Sales",
    "mid_market": "Mid-Market Sales",
    "enterprise": "Enterprise Sales",
    "partnerships": "Partnerships",
}
SOURCE_HS = {
    "inbound": ["ORGANIC_SEARCH", "DIRECT_TRAFFIC"],
    "paid": ["PAID_SEARCH", "PAID_SOCIAL"],
    "partner": ["REFERRALS"],
    "outbound": ["OFFLINE"],
}
STAGE_HS = {
    "discovery": "appointmentscheduled",
    "qualified": "qualifiedtobuy",
    "proposal": "presentationscheduled",
    "negotiation": "contractsent",
    "won": "closedwon",
    "lost": "closedlost",
}
LEGAL_UPPER = {"Ltd": "LIMITED", "Limited": "LTD", "Inc": "INC.", "LLC": "L.L.C."}


@dataclass(frozen=True)
class RawTable:
    schema: str
    name: str
    columns: tuple[tuple[str, str], ...]  # (name, postgres type)
    frame: pd.DataFrame  # every value a str or None

    @property
    def qualified(self) -> str:
        return f"{self.schema}.{self.name}"

    def csv(self) -> str:
        buf = io.StringIO()
        self.frame.to_csv(buf, index=False, header=False, na_rep="", lineterminator="\n")
        return buf.getvalue()


# ── Formatting ───────────────────────────────────────────────────────────
def _s(values: Iterable[Any], fmt=str) -> list[str | None]:
    return [None if opt(v) is None else fmt(v) for v in values]


def _utc_text(v: Any) -> str:
    t = pd.Timestamp(v)
    t = t.tz_convert("UTC").tz_localize(None) if t.tzinfo else t
    return t.strftime("%Y-%m-%d %H:%M:%S") + "+00"


def _ts_utc(values) -> list[str | None]:
    return _s(values, _utc_text)


def _ts_naive_utc(values) -> list[str | None]:
    """UTC wall-clock time with the zone marker dropped, as HubSpot exports it."""
    return _s(values, lambda v: pd.Timestamp(v).tz_convert("UTC").strftime("%Y-%m-%d %H:%M:%S"))


def _unix(values) -> list[str | None]:
    return _s(values, lambda v: str(int(pd.Timestamp(v).timestamp())))


def _cents(values) -> list[str | None]:
    return _s(values, lambda v: str(round(float(v) * 100)))


def _bool(values) -> list[str | None]:
    return _s(values, lambda v: "true" if v else "false")


def _table(schema: str, name: str, cols: list[tuple[str, str, list]]) -> RawTable:
    for c, _, v in cols:
        if any(x == "" for x in v):
            raise ValueError(f"{schema}.{name}.{c}: empty strings would load as NULL")
    frame = pd.DataFrame({c: pd.Series(v, dtype=object) for c, _, v in cols})
    return RawTable(schema, name, tuple((c, t) for c, t, _ in cols), frame)


def _hash_pick(key: str, n: int) -> int:
    return int(hashlib.sha256(key.encode()).hexdigest(), 16) % n


def _noisy_domain(domain: str | None, key: int) -> str | None:
    """How people actually type a website into a system: mostly clean, sometimes not."""
    if domain is None:
        return None
    variants = {0: f"https://www.{domain}", 1: f"www.{domain}", 2: domain.upper()}
    return variants.get(_hash_pick(f"dom{key}", 10), domain)


def _legal_variant(name: str, key: int) -> str:
    """The ledger holds the registered legal name: 'Acme Ltd' in the CRM is 'ACME LIMITED' here."""
    if _hash_pick(f"legal{key}", 2):
        return name
    words = name.split(" ")
    words[-1] = LEGAL_UPPER.get(words[-1], words[-1])
    return " ".join(words).upper()


# ── Sources ──────────────────────────────────────────────────────────────
def crm_hubspot(w: World) -> list[RawTable]:
    reps, acc, cust = w.reps, w.accounts, w.customers.set_index("account_id")
    owner_id = {int(r): 70_000_000 + int(r) for r in reps["rep_id"]}
    has_ref = {int(a): bool(v) for a, v in cust["has_billing_ref"].items()}
    unmatchable = {int(a): bool(v) for a, v in cust["unmatchable"].items()}

    owners = _table(
        "crm_hubspot",
        "owners",
        [
            ("owner_id", "bigint", _s(owner_id[int(r)] for r in reps["rep_id"])),
            ("first_name", "text", _s(reps["first_name"])),
            ("last_name", "text", _s(reps["last_name"])),
            ("email", "text", _s(reps["email"])),
            ("team_name", "text", _s(TEAM_HS[t] for t in reps["team"])),
            ("archived", "boolean", _bool(reps["archived"])),
        ],
    )

    ids = [int(a) for a in acc["account_id"]]
    domains = [
        None if unmatchable.get(a, False) else _noisy_domain(d, a)
        for a, d in zip(ids, acc["domain"], strict=True)
    ]
    refs = [stable_id("cus_", a) if has_ref.get(a, False) else None for a in ids]
    companies = _table(
        "crm_hubspot",
        "companies",
        [
            ("hs_object_id", "bigint", _s(ids)),
            ("name", "text", _s(acc["name"])),
            ("domain", "text", domains),
            ("industry", "text", _s(acc["industry"])),
            ("country", "text", _s(COUNTRY_NAMES[c] for c in acc["country"])),
            ("customer_segment", "text", _s(SEGMENT_HS[s] for s in acc["segment"])),
            ("hubspot_owner_id", "bigint", _s(owner_id[int(r)] for r in acc["owner_rep"])),
            ("createdate", "timestamp", _ts_naive_utc(acc["created_at"])),
            ("stripe_customer_id", "text", refs),
        ],
    )

    con = w.contacts
    contacts = _table(
        "crm_hubspot",
        "contacts",
        [
            ("hs_object_id", "bigint", _s(con["contact_id"])),
            ("associatedcompanyid", "bigint", _s(con["account_id"])),
            ("email", "text", _s(con["email"])),
            ("jobtitle", "text", _s(con["title"])),
            ("createdate", "timestamp", _ts_naive_utc(con["created_at"])),
        ],
    )

    def hs_source(source: Any, key: int) -> str | None:
        source = opt(source)
        return None if source is None else SOURCE_HS[source][key % len(SOURCE_HS[source])]

    ld = w.leads
    leads = _table(
        "crm_hubspot",
        "leads",
        [
            ("hs_object_id", "bigint", _s(ld["lead_id"])),
            ("associated_contact_id", "bigint", _s(ld["contact_id"])),
            ("associated_company_id", "bigint", _s(ld["account_id"])),
            (
                "hs_analytics_source",
                "text",
                [
                    hs_source(s, int(i))
                    for s, i in zip(ld["observed_source"], ld["lead_id"], strict=True)
                ],
            ),
            ("createdate", "timestamp", _ts_naive_utc(ld["created_at"])),
            ("hs_lead_converted_at", "timestamp", _ts_naive_utc(ld["converted_at"])),
        ],
    )

    op = w.opps
    deals = _table(
        "crm_hubspot",
        "deals",
        [
            ("hs_object_id", "bigint", _s(op["opp_id"])),
            ("associated_company_id", "bigint", _s(op["account_id"])),
            ("hubspot_owner_id", "bigint", _s(owner_id[int(r)] for r in op["owner_rep"])),
            ("amount", "numeric", _s(op["amount_usd"], lambda v: f"{float(v):.2f}")),
            ("createdate", "timestamp", _ts_naive_utc(op["created_at"])),
            (
                "closedate",
                "timestamp",
                _s(op["observed_close_date"], lambda d: f"{d.isoformat()} 00:00:00"),
            ),
            ("dealstage", "text", _s(STAGE_HS[s] for s in op["stage"])),
            (
                "lead_source",
                "text",
                [
                    hs_source(s, int(i))
                    for s, i in zip(op["observed_source"], op["lead_id"], strict=True)
                ],
            ),
        ],
    )

    sh, ch = w.stage_history, w.close_date_history
    hist = pd.concat(
        [
            pd.DataFrame(
                {
                    "object_id": sh["opp_id"],
                    "property_name": "dealstage",
                    "value": [STAGE_HS[s] for s in sh["stage"]],
                    "at": sh["entered_at"],
                }
            ),
            pd.DataFrame(
                {
                    "object_id": ch["opp_id"],
                    "property_name": "closedate",
                    "value": [d.isoformat() for d in ch["value"]],
                    "at": ch["changed_at"],
                }
            ),
            pd.DataFrame(
                {
                    "object_id": op["opp_id"],
                    "property_name": "amount",
                    "value": [
                        None if opt(a) is None else f"{float(a):.2f}" for a in op["amount_usd"]
                    ],
                    "at": op["created_at"],
                }
            ),
        ],
        ignore_index=True,
    )
    hist = hist[hist["value"].notna()].sort_values(
        ["object_id", "at", "property_name"], kind="stable"
    )
    history = _table(
        "crm_hubspot",
        "deal_property_history",
        [
            ("object_id", "bigint", _s(hist["object_id"])),
            ("property_name", "text", _s(hist["property_name"])),
            ("value", "text", _s(hist["value"])),
            ("timestamp", "timestamp", _ts_naive_utc(hist["at"])),
        ],
    )
    return [owners, companies, contacts, leads, deals, history]


def _period_bounds(months) -> tuple[list[datetime], list[datetime]]:
    starts = [datetime(m.year, m.month, 1, tzinfo=UTC) for m in months]
    ends = [datetime(m.year + m.month // 12, m.month % 12 + 1, 1, tzinfo=UTC) for m in months]
    return starts, ends


def billing(w: World) -> list[RawTable]:
    cust = w.customers.sort_values("account_id")
    acc = w.accounts.set_index("account_id")
    aids = [int(a) for a in cust["account_id"]]
    noon = [datetime(d.year, d.month, d.day, 12, tzinfo=UTC) for d in cust["won_date"]]
    customers = _table(
        "billing",
        "customers",
        [
            ("id", "text", _s(stable_id("cus_", a) for a in aids)),
            ("name", "text", _s(acc.loc[a, "name"] for a in aids)),
            ("email", "text", _s(f"billing@{acc.loc[a, 'domain']}" for a in aids)),
            ("created", "bigint", _unix(noon)),
            ("livemode", "boolean", _bool(True for _ in aids)),
        ],
    )

    sub = w.subscriptions
    subscriptions = _table(
        "billing",
        "subscriptions",
        [
            ("id", "text", _s(sub["subscription_id"])),
            ("customer", "text", _s(stable_id("cus_", int(a)) for a in sub["account_id"])),
            ("status", "text", _s(sub["status"])),
            ("plan_amount", "bigint", _cents(sub["monthly_fee_usd"])),
            ("currency", "text", _s("usd" for _ in sub["account_id"])),
            ("start_date", "bigint", _unix(sub["started_at"])),
            ("canceled_at", "bigint", _unix(sub["canceled_at"])),
            ("ended_at", "bigint", _unix(sub["ended_at"])),
        ],
    )

    inv = w.invoices
    p_start, p_end = _period_bounds(inv["period"])
    invoices = _table(
        "billing",
        "invoices",
        [
            ("id", "text", _s(inv["invoice_id"])),
            ("customer", "text", _s(stable_id("cus_", int(a)) for a in inv["account_id"])),
            ("subscription", "text", _s(inv["subscription_id"])),
            ("status", "text", _s(inv["status"])),
            ("currency", "text", _s("usd" for _ in inv["invoice_id"])),
            ("total", "bigint", _cents(inv["total_usd"])),
            ("amount_paid", "bigint", _cents(inv["paid_usd"])),
            ("period_start", "bigint", _unix(p_start)),
            ("period_end", "bigint", _unix(p_end)),
            ("created", "bigint", _unix(inv["created_at"])),
        ],
    )

    li = w.invoice_lines
    l_start, l_end = _period_bounds(li["period"])
    stripe_type = {"platform_fee": "subscription", "usage_true_up": "invoiceitem"}
    description = {
        "platform_fee": "SendFast platform fee",
        "usage_true_up": "Minimum commitment true-up",
    }
    lines = _table(
        "billing",
        "invoice_lines",
        [
            ("id", "text", _s(li["line_id"])),
            ("invoice", "text", _s(li["invoice_id"])),
            ("type", "text", _s(stripe_type[t] for t in li["line_type"])),
            ("description", "text", _s(description[t] for t in li["line_type"])),
            ("amount", "bigint", _cents(li["amount_usd"])),
            ("currency", "text", _s("usd" for _ in li["line_id"])),
            ("period_start", "bigint", _unix(l_start)),
            ("period_end", "bigint", _unix(l_end)),
        ],
    )
    return [customers, subscriptions, invoices, lines]


def dirty_dest_currency(w: World) -> np.ndarray:
    """NGN destination currency as the ledger records it: sometimes `ngn` or `₦`."""
    rng = np.random.default_rng(np.random.SeedSequence([int(w.cfg["seed"]), 7]))
    dest = w.transactions["dest_currency"].to_numpy(dtype=object).copy()
    ngn = np.flatnonzero(dest == "NGN")
    dirty = ngn[rng.random(len(ngn)) < w.cfg["dirty"]["currency_variant_rate"]]
    dest[dirty] = np.where(rng.random(len(dirty)) < 0.5, "ngn", "₦")
    return dest


def ledger(w: World) -> list[RawTable]:
    me = w.merchants
    aids = [int(a) for a in me["account_id"]]
    live_midnight = [
        None if opt(d) is None else datetime(d.year, d.month, d.day, tzinfo=UTC)
        for d in me["live_date"]
    ]
    onboarded = [datetime(d.year, d.month, d.day, 12, tzinfo=UTC) for d in me["onboarded"]]
    merchants = _table(
        "ledger",
        "merchants",
        [
            ("merchant_id", "text", _s(me["merchant_id"])),
            (
                "billing_customer_id",
                "text",
                [
                    stable_id("cus_", a) if b else None
                    for a, b in zip(aids, me["in_billing"], strict=True)
                ],
            ),
            (
                "legal_name",
                "text",
                [_legal_variant(n, a) for n, a in zip(me["legal_name"], aids, strict=True)],
            ),
            (
                "website",
                "text",
                [_noisy_domain(opt(d), a + 1) for d, a in zip(me["domain"], aids, strict=True)],
            ),
            ("went_live_at", "timestamptz", _ts_utc(live_midnight)),
            ("created_at", "timestamptz", _ts_utc(onboarded)),
        ],
    )

    tx = w.transactions
    stamps = np.datetime_as_string(tx["created_at"].to_numpy().astype("datetime64[s]"), unit="s")
    created = [s.replace("T", " ") + "+00" for s in stamps]
    transactions = _table(
        "ledger",
        "transactions",
        [
            ("transaction_id", "text", list(tx["transaction_id"])),
            ("merchant_id", "text", list(tx["merchant_id"])),
            ("created_at", "timestamptz", created),
            ("status", "text", list(tx["status"])),
            ("rail", "text", list(tx["rail"])),
            ("source_currency", "text", list(tx["source_currency"])),
            ("dest_currency", "text", list(dirty_dest_currency(w))),
            ("amount_minor", "bigint", [str(v) for v in tx["amount_minor"]]),
            ("failure_reason", "text", _s(tx["failure_reason"])),
        ],
    )

    dp = w.disputes
    disputes = _table(
        "ledger",
        "disputes",
        [
            ("dispute_id", "text", _s(dp["dispute_id"])),
            ("transaction_id", "text", _s(dp["transaction_id"])),
            ("kind", "text", _s(dp["dispute_type"])),
            ("opened_at", "timestamptz", _ts_utc(dp["opened_at"])),
            ("resolved_at", "timestamptz", _ts_utc(dp["resolved_at"])),
            ("outcome", "text", _s(dp["outcome"])),
            ("amount_minor", "bigint", _s(dp["amount_minor"])),
            ("currency", "text", _s(dp["currency"])),
        ],
    )
    return [merchants, transactions, disputes]


def rates(w: World) -> list[RawTable]:
    fx, pr = w.fx, w.pricing
    fx_rates = _table(
        "rates",
        "fx_rates",
        [
            ("rate_date", "date", _s(fx["rate_date"], date.isoformat)),
            ("base_currency", "text", _s(fx["base_currency"])),
            ("quote_currency", "text", _s(fx["quote_currency"])),
            ("rate", "numeric", _s(fx["rate"], lambda v: f"{float(v):.6f}")),
            ("source", "text", _s(fx["source"])),
        ],
    )
    pricing = _table(
        "rates",
        "pricing_rates",
        [
            ("account_ref", "text", _s(pr["account_id"])),
            ("fee_bps", "numeric", _s(pr["fee_bps"], lambda v: f"{float(v):.2f}")),
            ("fx_margin_bps", "numeric", _s(pr["fx_margin_bps"], lambda v: f"{float(v):.2f}")),
            (
                "platform_fee_usd",
                "numeric",
                _s(pr["platform_fee_usd"], lambda v: f"{float(v):.2f}"),
            ),
            ("min_commit_usd", "numeric", _s(pr["min_commit_usd"], lambda v: f"{float(v):.2f}")),
            ("effective_from", "date", _s(pr["effective_from"], date.isoformat)),
            ("effective_to", "date", _s(pr["effective_to"], date.isoformat)),
        ],
    )
    return [fx_rates, pricing]


def build_raw(w: World) -> list[RawTable]:
    return crm_hubspot(w) + billing(w) + ledger(w) + rates(w)


def digest(tables: list[RawTable]) -> str:
    """sha256 over every table's name and CSV bytes: the determinism fingerprint."""
    h = hashlib.sha256()
    for t in tables:
        h.update(f"--{t.qualified}\n".encode())
        h.update(t.csv().encode())
    return h.hexdigest()

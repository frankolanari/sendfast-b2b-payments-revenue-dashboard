"""Static snapshot for the hosted demo (PLAN.md Stage 7): every card for every preset.

    uv run python scripts/export_snapshot.py                     # -> web/public/snapshot/*.json

Presets are what the front end offers in snapshot mode: each fixed period, combined with at
most one page filter value, and (for Account 360) the accounts a visitor can reach from the
default view. Cards are asked of the dashboard server, so the demo shows exactly what live
mode would. Synthetic data only. Output is gitignored and rebuilt on deploy.
"""

from __future__ import annotations

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import card_content as mc
from golden_check import dashboard_url, query_card

OUT = mc.ROOT / "web" / "public" / "snapshot"
# Mirrors web/src/state/filters.ts PERIODS (checked by a test).
PERIODS: dict[str, tuple[str | None, str | None]] = {
    "t12": ("2025-11-01", "2026-10-31"),
    "sep2026": ("2026-09-01", "2026-09-30"),
    "y2025": ("2025-01-01", "2025-12-31"),
    "all": (None, None),
}
FILTERS = ("segment", "lead_source", "owner_id", "corridor")
ACCOUNT_SOURCES = ("deals_list", "accounts_at_risk", "top_accounts")
DEFAULT_ACCOUNT = "10000006"


def key(params: dict[str, str]) -> str:
    """The lookup key the front end builds: parameters sorted by name."""
    return json.dumps(dict(sorted(params.items())), separators=(",", ":"))


def presets(accepted: list[str], values: dict[str, list[str]]) -> list[dict[str, str]]:
    """Distinct parameter sets for a card: period x (no filter, or one filter value)."""
    seen: dict[str, dict[str, str]] = {}
    for date_from, date_to in PERIODS.values():
        base = {}
        if date_from and "date_from" in accepted:
            base["date_from"] = date_from
        if date_to and "date_to" in accepted:
            base["date_to"] = date_to
        singles: list[dict[str, str]] = [{}]
        for name in FILTERS:
            if name in accepted:
                singles += [{name: v} for v in values[name]]
        for single in singles:
            p = {**base, **single}
            seen[key(p)] = p
    return list(seen.values())


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args(argv)

    contract = mc.load_parameters()
    cards = {Path(c.source).stem: c for c in mc.load_cards()}
    base = dashboard_url()

    def run(job: tuple[str, dict[str, str]]) -> tuple[str, dict[str, str], dict[str, Any]]:
        slug, params = job
        try:
            return slug, params, query_card(base, slug, params)
        except RuntimeError as err:
            raise RuntimeError(f"{slug} {params}: {err}") from err

    def run_all(jobs):
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            return list(pool.map(run, jobs))

    # Filter values come from the same cards that feed the dropdowns.
    values: dict[str, list[str]] = {}
    for name in FILTERS:
        spec = contract[name]["values"]
        if "static" in spec:
            values[name] = list(spec["static"])
        else:
            slug = next(s for s, c in cards.items() if c.name == spec["card"])
            values[name] = [str(r[0]) for r in run((slug, {}))[2]["rows"]]

    jobs = [
        (slug, p)
        for slug, c in cards.items()
        if "account_id" not in c.params
        for p in presets(c.params, values)
    ]
    results = run_all(jobs)

    # Accounts reachable from the default view: the drill targets.
    accounts = {DEFAULT_ACCOUNT}
    t12 = PERIODS["t12"]
    for slug, params, out in results:
        default = (
            all(k in ("date_from", "date_to") for k in params)
            and params.get("date_to", t12[1]) == t12[1]
        )
        if slug in ACCOUNT_SOURCES and default:
            col = [c["name"] for c in out["columns"]].index("account_id")
            accounts |= {str(r[col]) for r in out["rows"]}
    account_jobs = []
    for slug, c in cards.items():
        if "account_id" not in c.params:
            continue
        for account in sorted(accounts):
            for p in presets([x for x in c.params if x != "account_id"], values):
                account_jobs.append((slug, {**p, "account_id": account}))
    results += run_all(account_jobs)

    args.out.mkdir(parents=True, exist_ok=True)
    files: dict[str, dict[str, Any]] = {}
    for slug, params, out in results:
        files.setdefault(slug, {})[key(params)] = out
    size = 0
    for slug, content in files.items():
        text = json.dumps(content, separators=(",", ":"))
        (args.out / f"{slug}.json").write_text(text, encoding="utf-8")
        size += len(text)
    print(
        f"snapshot: {len(files)} cards, {len(results)} results, {len(accounts)} accounts, "
        f"{size / 1e6:.1f} MB -> {args.out.relative_to(mc.ROOT)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

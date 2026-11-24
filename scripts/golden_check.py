"""Golden-number check (PLAN.md Stages 5 and 6): answer key vs marts vs Metabase.

Stage 1: every metric in metrics/metrics.yml runs its golden query against the analytics marts,
as the bi_reader role (what BI sees), and is compared with generator/answer_keys/scale_<s>.json.
Stage 2 (--metabase): three-way agreement. Through the proxy's view-only API key, each metric's
generated golden card must match both the key and the marts, and where golden.card names a
dashboard card, that card (run with the listed filters) must match the key too.
A mismatch prints the metric, the source, expected, actual, tolerance and the SQL used.

Output is aggregates only (rule 8): metric values and counts, never rows.

    uv run python scripts/golden_check.py --scale 1.0 [--metabase]
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
METRICS_PATH = ROOT / "metrics" / "metrics.yml"
ANSWER_KEYS_DIR = ROOT / "generator" / "answer_keys"
FLOAT_SLACK = 1e-9  # binary representation only; real tolerances live in metrics.yml


@dataclass
class Result:
    name: str
    sql: str = ""
    problems: list[str] = field(default_factory=list)
    actual: Any = None
    columns: list[str] = field(default_factory=list)
    rows: list[tuple] = field(default_factory=list)
    checks: list[str] = field(default_factory=list)  # sources that agreed, for the report

    @property
    def ok(self) -> bool:
        return not self.problems


def answer_key_path(scale: float) -> Path:
    return ANSWER_KEYS_DIR / f"scale_{scale:g}.json"


def load_spec(path: Path = METRICS_PATH) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def normalise(text: str) -> str:
    return " ".join(str(text).split())


# ── The spec against the key (no database) ───────────────────────────────
def validate_spec(spec: dict[str, Any], key: dict[str, Any]) -> list[str]:
    """The spec and the key must describe the same metrics, words and dates."""
    problems: list[str] = []
    metrics = spec.get("metrics") or []
    names = [m.get("name") for m in metrics]
    dupes = sorted({n for n in names if names.count(n) > 1})
    if dupes:
        problems.append(f"metrics.yml lists these metrics twice: {dupes}")
    missing = sorted(set(key["metrics"]) - set(names))
    extra = sorted(set(names) - set(key["metrics"]))
    if missing:
        problems.append(f"in the answer key but not in metrics.yml: {missing}")
    if extra:
        problems.append(f"in metrics.yml but not in the answer key: {extra}")

    for m in metrics:
        name = m.get("name")
        if name not in key["metrics"]:
            continue
        if normalise(m.get("definition", "")) != key["metrics"][name]["definition"]:
            problems.append(f"{name}: definition differs from the answer key's")
        golden = m.get("golden") or {}
        if not golden.get("query"):
            problems.append(f"{name}: golden.query is missing")
        card = golden.get("card")
        if card is not None:
            if not card.get("name") or not card.get("column"):
                problems.append(f"{name}: golden.card needs name and column")
            for pname, period in (card.get("parameters") or {}).items():
                if period not in (spec.get("periods") or {}):
                    problems.append(
                        f"{name}: golden.card.parameters.{pname} {period!r} is not a period"
                    )
        tol = golden.get("tolerance")
        if not isinstance(tol, (int, float)) or isinstance(tol, bool) or tol < 0:
            problems.append(f"{name}: golden.tolerance must be a number >= 0")

    p, meta = spec.get("periods") or {}, key["meta"]
    expected_periods = {
        "as_of": meta["as_of"],
        "window_start": meta["history_from"],
        "t12_start": meta["trailing_12_months"][0],
        "t12_end": meta["trailing_12_months"][1],
    }
    for k, v in expected_periods.items():
        if str(p.get(k)) != v:
            problems.append(f"periods.{k} is {p.get(k)!r}; the answer key says {v!r}")
    if not str(p.get("golden_month_start", "")).startswith(meta["golden_month"]):
        problems.append(
            f"periods.golden_month_start is {p.get('golden_month_start')!r}; "
            f"the answer key's golden month is {meta['golden_month']!r}"
        )
    return problems


# ── One metric's rows against its key entry ──────────────────────────────
def _num(x: Any) -> float | None:
    if x is None:
        return None
    v = float(x)
    return None if math.isnan(v) else v


def _close(actual: Any, expected: Any, tol: float) -> bool:
    a, e = _num(actual), _num(expected)
    if a is None or e is None:
        return a is None and e is None
    return abs(a - e) <= tol + FLOAT_SLACK


def _mismatch(field_name: str, expected: Any, actual: Any, tol: float) -> str:
    return f"{field_name}: expected {expected}, actual {actual} (tolerance {tol:g})"


def compare(
    name: str, entry: dict[str, Any], columns: list[str], rows: list[tuple], golden: dict[str, Any]
) -> list[str]:
    """Problems found comparing query rows with the key entry; empty means a match."""
    tol = float(golden["tolerance"])
    by = golden.get("by")
    unknown = [c for c in columns if c != by and c not in entry]
    if unknown:
        return [f"query returns columns the answer key doesn't have: {unknown}"]
    if "value" not in columns:
        return ["query returns no `value` column"]

    problems: list[str] = []
    if by is None:
        if len(rows) != 1:
            return [f"query returned {len(rows)} rows; expected exactly 1"]
        for col, actual in zip(columns, rows[0], strict=True):
            if not _close(actual, entry[col], tol):
                problems.append(_mismatch(col, entry[col], actual, tol))
        return problems

    if not isinstance(entry["value"], dict):
        return [f"golden.by is {by!r}, but the answer key's value is not a map"]
    by_idx = columns.index(by)
    actual_by = {row[by_idx]: dict(zip(columns, row, strict=True)) for row in rows}
    expected_keys = set(entry["value"])
    for k in sorted(expected_keys - set(actual_by)):
        problems.append(f"{by}={k}: in the answer key, missing from the marts")
    for k in sorted(set(actual_by) - expected_keys):
        problems.append(f"{by}={k}: in the marts, not in the answer key")
    for k in sorted(expected_keys & set(actual_by)):
        for col in columns:
            if col == by:
                continue
            exp, act = entry[col].get(k), actual_by[k][col]
            if not _close(act, exp, tol):
                problems.append(_mismatch(f"{col}[{k}]", exp, act, tol))
    return problems


# ── Database ─────────────────────────────────────────────────────────────
def connect():
    """bi_reader from env only (cloud-ready rule 1); the local synthetic DB only (D12)."""
    import psycopg2

    return psycopg2.connect(
        host=os.environ.get("DATA_DB_HOST", "localhost"),
        port=int(os.environ.get("DATA_DB_HOST_PORT", "55432")),
        dbname=os.environ.get("DATA_DB_NAME", "sendfast"),
        user=os.environ.get("BI_READER_USER", "bi_reader"),
        password=os.environ["BI_READER_PASSWORD"],
        sslmode=os.environ.get("DATA_DB_SSLMODE", "disable"),
        options="-c timezone=UTC",
    )


def run(spec: dict[str, Any], key: dict[str, Any], conn) -> list[Result]:
    params = {k: str(v) for k, v in spec["periods"].items()}
    results = []
    with conn.cursor() as cur:
        for m in spec["metrics"]:
            golden = m["golden"]
            res = Result(m["name"])
            res.sql = cur.mogrify(golden["query"], params).decode()
            cur.execute(golden["query"], params)
            columns = [d.name for d in cur.description]
            rows = cur.fetchall()
            res.columns, res.rows = columns, [tuple(r) for r in rows]
            res.checks.append("marts")
            res.actual = rows[0][columns.index("value")] if len(rows) == 1 else len(rows)
            res.problems = compare(m["name"], key["metrics"][m["name"]], columns, rows, golden)
            results.append(res)
    return results


# ── Stage 2: Metabase ────────────────────────────────────────────────────
def rows_as_entry(columns: list[str], rows: list[tuple], by: str | None) -> dict[str, Any]:
    """Query rows in the answer key's shape, so one source can be compared with another."""
    if by is None:
        return dict(zip(columns, rows[0], strict=True)) if len(rows) == 1 else {}
    idx = columns.index(by)
    return {c: {r[idx]: r[i] for r in rows} for i, c in enumerate(columns) if c != by}


def card_parameters(card_ref: dict[str, Any], periods: dict[str, Any], contract: dict) -> list:
    out = []
    for pname, period in (card_ref.get("parameters") or {}).items():
        kind = "date/single" if contract[pname]["type"] == "date" else "string/="
        out.append(
            {
                "id": pname,
                "type": kind,
                "target": ["variable", ["template-tag", pname]],
                "value": str(periods[period]),
            }
        )
    return out


def run_metabase(spec, key, results: list[Result], mb, golden_prefix: str, contract) -> None:
    """Add Metabase's answers to each result: the golden card and, if named, the dashboard card."""
    cards = {c["name"]: c["id"] for c in mb.get("/api/card?f=all") if not c.get("archived")}
    for m, res in zip(spec["metrics"], results, strict=True):
        golden = m["golden"]
        entry = key["metrics"][m["name"]]
        gname = golden_prefix + m["name"]
        if gname not in cards:
            res.problems.append(f"Metabase: no card {gname!r} (run make metabase-bootstrap)")
            continue
        out = mb.post(f"/api/card/{cards[gname]}/query", {"parameters": []})
        if out.get("status") != "completed":
            res.problems.append(f"Metabase {gname!r}: {str(out.get('error'))[:200]}")
            continue
        columns = [c["name"] for c in out["data"]["cols"]]
        rows = [tuple(r) for r in out["data"]["rows"]]
        res.problems += [
            f"Metabase vs key: {p}" for p in compare(m["name"], entry, columns, rows, golden)
        ]
        marts = rows_as_entry(res.columns, res.rows, golden.get("by"))
        if marts:
            vs_marts = compare(m["name"], marts, columns, rows, golden)
            res.problems += [f"Metabase vs marts: {p}" for p in vs_marts]
        res.checks.append("golden card")

        ref = golden.get("card")
        if not ref:
            continue
        if ref["name"] not in cards:
            res.problems.append(f"Metabase: no dashboard card {ref['name']!r}")
            continue
        params = card_parameters(ref, spec["periods"], contract)
        out = mb.post(f"/api/card/{cards[ref['name']]}/query", {"parameters": params})
        if out.get("status") != "completed":
            res.problems.append(f"Metabase {ref['name']!r}: {str(out.get('error'))[:200]}")
            continue
        names = [c["name"] for c in out["data"]["cols"]]
        rows = out["data"]["rows"]
        if len(rows) != 1 or ref["column"] not in names:
            res.problems.append(
                f"dashboard card {ref['name']!r}: expected one row with {ref['column']!r}"
            )
            continue
        actual = rows[0][names.index(ref["column"])]
        tol = float(golden["tolerance"])
        if not _close(actual, entry["value"], tol):
            res.problems.append(
                f"dashboard card {ref['name']!r}: "
                + _mismatch("value", entry["value"], actual, tol)
            )
        res.checks.append(f"card {ref['name']!r}")


def report(results: list[Result]) -> str:
    lines = []
    for r in results:
        if r.ok:
            agreed = f"  ({' = '.join(['key', *r.checks])})" if len(r.checks) > 1 else ""
            lines.append(f"PASS  {r.name}{agreed}")
            continue
        lines.append(f"FAIL  {r.name}")
        lines += [f"        {p}" for p in r.problems]
        lines.append("        SQL used:")
        lines += [f"          {s}" for s in r.sql.strip().splitlines()]
    passed = sum(r.ok for r in results)
    lines.append(f"\n{passed}/{len(results)} golden metrics match the answer key.")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--scale", type=float, default=1.0, help="which answer key (1.0 or 0.1)")
    ap.add_argument("--metrics", type=Path, default=METRICS_PATH)
    ap.add_argument(
        "--metabase", action="store_true", help="three-way: also check Metabase (Stage 6)"
    )
    args = ap.parse_args(argv)

    key_path = answer_key_path(args.scale)
    key = json.loads(key_path.read_text(encoding="utf-8"))
    spec = load_spec(args.metrics)
    print(f"Answer key: {key_path.relative_to(ROOT)}  (golden month {key['meta']['golden_month']})")

    spec_problems = validate_spec(spec, key)
    if spec_problems:
        print("metrics.yml does not match the answer key:")
        print("\n".join(f"  - {p}" for p in spec_problems))
        return 1

    conn = connect()
    try:
        conn.set_session(readonly=True)
        results = run(spec, key, conn)
    finally:
        conn.close()
    if args.metabase:
        import metabase_content as mc
        from metabase_bootstrap import Client, read_key_file

        # The file the bootstrap just wrote beats the env: make reads .env.metabase once, at
        # start, so within `make gate-6` the env still holds the key from before the reset.
        api_key = read_key_file() or os.environ.get("MB_API_KEY")
        if not api_key:
            print("MB_API_KEY is not set: run make metabase-bootstrap (writes .env.metabase)")
            return 1
        mb = Client(os.environ["MB_SITE_URL"], api_key=api_key)  # the proxy's view-only key
        run_metabase(spec, key, results, mb, mc.GOLDEN_PREFIX, mc.load_parameters())
    print(report(results))
    return 0 if all(r.ok for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())

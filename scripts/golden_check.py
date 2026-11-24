"""Golden-number check, stage 1 of 2 (PLAN.md Stage 5): the answer key against the marts.

Every metric in metrics/metrics.yml runs its golden query against the analytics marts, as the
bi_reader role (what BI sees), and is compared with generator/answer_keys/scale_<scale>.json.
A mismatch prints the metric, expected, actual, tolerance and the exact SQL run.
Stage 6 adds Metabase as the third source.

Output is aggregates only (rule 8): metric values and counts, never rows.

    uv run python scripts/golden_check.py --scale 1.0
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
            res.actual = rows[0][columns.index("value")] if len(rows) == 1 else len(rows)
            res.problems = compare(m["name"], key["metrics"][m["name"]], columns, rows, golden)
            results.append(res)
    return results


def report(results: list[Result]) -> str:
    lines = []
    for r in results:
        if r.ok:
            lines.append(f"PASS  {r.name}")
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
    print(report(results))
    return 0 if all(r.ok for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())

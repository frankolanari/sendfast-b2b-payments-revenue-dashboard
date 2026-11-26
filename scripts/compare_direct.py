"""Run every card through the Metabase proxy and the direct Postgres server; fail on differences.

Both must be running (make dev, make dev-direct). Prints card names and counts only, no row values.
"""

import json
import math
import os
import sys
import urllib.error
import urllib.request

METABASE = os.environ.get("METABASE_PROXY", "http://localhost:8787")
DIRECT = os.environ.get("DIRECT_PROXY", "http://localhost:8788")

DATES = {"date_from": "2025-11-01", "date_to": "2026-10-31"}
CASES = [
    {},
    DATES,
    {"date_from": "2025-01-01", "date_to": "2025-12-31"},
    {**DATES, "segment": "smb"},
    {**DATES, "lead_source": "partner"},
    {**DATES, "corridor": "USD-NGN"},
    {**DATES, "owner_id": "<first rep>"},
    {**DATES, "account_id": "<second account>"},
]


def call(base: str, slug: str, params: dict | None = None) -> tuple[int, dict]:
    data = None if params is None else json.dumps({"parameters": params}).encode()
    request = urllib.request.Request(
        f"{base}/api/cards" + (f"/{slug}" if slug else ""),
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as err:
        return err.code, {}


def same(a: object, b: object) -> bool:
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-9)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(map(same, a, b))
    return a == b


def difference(a: dict, b: dict) -> str | None:
    if a["columns"] != b["columns"]:
        pairs = [(x, y) for x, y in zip(a["columns"], b["columns"], strict=False) if x != y]
        return f"columns differ: {pairs[:3] or 'different count'}"
    if len(a["rows"]) != len(b["rows"]):
        return f"row count {len(a['rows'])} vs {len(b['rows'])}"
    if same(a["rows"], b["rows"]):
        return None
    left, right = (sorted(x["rows"], key=json.dumps) for x in (a, b))
    return "row order differs" if same(left, right) else "values differ"


def main() -> int:
    cards = call(METABASE, "")[1]
    first_rep = call(METABASE, "filter_reps", {})[1]["rows"][0][0]
    account = call(METABASE, "filter_accounts", {})[1]["rows"][1][0]
    stand_ins = {"<first rep>": first_rep, "<second account>": account}
    compared, failures = 0, []
    for slug, card in sorted(cards.items()):
        seen = []
        for case in CASES:
            params = {k: stand_ins.get(v, v) for k, v in case.items() if k in card["params"]}
            if params in seen:
                continue
            seen.append(params)
            (status_a, a), (status_b, b) = call(METABASE, slug, params), call(DIRECT, slug, params)
            compared += 1
            if status_a != 200 or status_b != 200:
                problem = f"HTTP {status_a} vs {status_b}"
            else:
                problem = difference(a, b)
            if problem:
                failures.append(f"{slug} {sorted(params)}: {problem}")
    for line in failures:
        print(line)
    print(f"{len(cards)} cards, {compared} comparisons, {len(failures)} differences")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

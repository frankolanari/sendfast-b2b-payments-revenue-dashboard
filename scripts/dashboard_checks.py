"""Checks around the dashboard server (PLAN.md Stage 6). Aggregates and names only (rule 8).

uv run python scripts/dashboard_checks.py permissions   # bi_reader reads the marts, nothing else
uv run python scripts/dashboard_checks.py timing        # every card answers within the limit
uv run python scripts/dashboard_checks.py serve [--worker] -- <command ...>
                                                        # run a command with the server up
"""

from __future__ import annotations

import argparse
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request

import card_content
from golden_check import connect, dashboard_url, query_card

MAX_SECONDS = 2.0  # owner-approved limit, 2026-11-27
T12 = {"date_from": "2025-11-01", "date_to": "2026-10-31"}

# Every privilege bi_reader holds that it should not, from the catalog (so new tables count).
EXCESS_SQL = """
with relations as (
    select n.nspname as schema, c.relname as name, c.oid
    from pg_class as c
    inner join pg_namespace as n on c.relnamespace = n.oid
    where c.relkind in ('r', 'p', 'v', 'm')
      and n.nspname not in ('pg_catalog', 'information_schema')
      and n.nspname not like 'pg\\_%%'
),
schemas as (
    select nspname as schema from pg_namespace
    where nspname not in ('pg_catalog', 'information_schema') and nspname not like 'pg\\_%%'
)
select 'create in schema ' || schema from schemas
where has_schema_privilege(current_user, schema, 'create')
union all
select 'usage on schema ' || schema from schemas
where schema not in ('analytics', 'public') and has_schema_privilege(current_user, schema, 'usage')
union all
select 'select on ' || schema || '.' || name from relations
where schema != 'analytics' and has_table_privilege(current_user, oid, 'select')
  and has_schema_privilege(current_user, schema, 'usage')
union all
select 'write on ' || schema || '.' || name from relations
where has_table_privilege(current_user, oid, 'insert, update, delete, truncate')
"""


def permissions() -> int:
    conn = connect()
    try:
        with conn.cursor() as cur:
            cur.execute(EXCESS_SQL)
            excess = sorted(row[0] for row in cur.fetchall())
            cur.execute(
                "select count(*) filter (where schemaname = 'analytics'), "
                "count(*) filter (where schemaname != 'analytics' "
                "and schemaname not in ('pg_catalog', 'information_schema')) from pg_tables"
            )
            marts, others = cur.fetchone()
            cur.execute(
                "select count(*) from pg_tables where schemaname = 'analytics' "
                "and has_table_privilege(current_user, format('%I.%I', schemaname, tablename), "
                "'select')"
            )
            readable = cur.fetchone()[0]
        conn.rollback()
        # One real attempt, outside any read-only session: the database itself must refuse.
        try:
            with conn.cursor() as cur:
                cur.execute("delete from analytics.dim_reps where false")
            excess.append("delete on analytics.dim_reps was accepted")
        except Exception as err:  # noqa: BLE001 - only the refusal code passes
            if getattr(err, "pgcode", None) != "42501":
                excess.append(f"delete failed for another reason: {getattr(err, 'pgcode', None)}")
        conn.rollback()
    finally:
        conn.close()
    if not marts or not others or readable != marts:
        excess.append(f"marts readable {readable}/{marts}, other tables seen {others}")
    for line in excess:
        print(f"FAIL  bi_reader: {line}")
    if not excess:
        print(f"bi_reader reads all {marts} marts; no access to {others} other tables; no writes")
    return 1 if excess else 0


def timing() -> int:
    base, timings, failures = dashboard_url(), [], []
    for path in sorted((card_content.QUERY_DIR / "cards").glob("*.sql")):
        card = card_content.parse_card(path.read_text(encoding="utf-8"), path.name)
        dated = {k: v for k, v in T12.items() if k in card.params}
        for params in [{}] + ([dated] if dated else []):
            start = time.monotonic()
            try:
                query_card(base, path.stem, params)
            except RuntimeError as err:
                failures.append(f"{path.stem}: {err}")
                continue
            timings.append((time.monotonic() - start, path.stem))
    failures += [f"{slug}: {s:.2f} s > {MAX_SECONDS:g} s" for s, slug in timings if s > MAX_SECONDS]
    for line in failures:
        print(f"FAIL  {line}")
    if timings:
        seconds, slug = max(timings)
        print(f"{len(timings)} queries; slowest {slug} {seconds:.2f} s (limit {MAX_SECONDS:g} s)")
    return 1 if failures or not timings else 0


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def serve(command: list[str], worker: bool) -> int:
    port = free_port()
    url = f"http://localhost:{port}"
    env = {**os.environ, "PROXY_PORT": str(port), "DASHBOARD_URL": url}
    proxy = card_content.ROOT / "proxy"
    if worker:
        env["CLOUDFLARE_INCLUDE_PROCESS_ENV"] = "true"  # the Worker reads the local settings
        env["WRANGLER_SEND_METRICS"] = "false"
        server = ["node_modules/.bin/wrangler", "dev", "--port", str(port), "--log-level", "warn"]
    else:
        server = ["node", "--import", "tsx", "src/node.ts"]
    process = subprocess.Popen(server, cwd=proxy, env=env, start_new_session=True)
    try:
        deadline = time.monotonic() + 90
        while True:
            if process.poll() is not None:
                print("the dashboard server exited before it was ready")
                return 1
            try:
                urllib.request.urlopen(f"{url}/api/health", timeout=2).close()
                break
            except OSError:
                if time.monotonic() > deadline:
                    print("the dashboard server did not become ready in 90 s")
                    return 1
                time.sleep(0.5)
        return subprocess.run(command, env=env, check=False).returncode
    finally:
        if process.poll() is None:
            os.killpg(process.pid, signal.SIGTERM)
            process.wait(timeout=30)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="action", required=True)
    sub.add_parser("permissions")
    sub.add_parser("timing")
    run = sub.add_parser("serve")
    run.add_argument("--worker", action="store_true", help="run on Cloudflare's local runtime")
    run.add_argument("command", nargs=argparse.REMAINDER)
    args = ap.parse_args(argv)
    if args.action == "permissions":
        return permissions()
    if args.action == "timing":
        return timing()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        ap.error("serve needs a command after --")
    return serve(command, args.worker)


if __name__ == "__main__":
    sys.exit(main())

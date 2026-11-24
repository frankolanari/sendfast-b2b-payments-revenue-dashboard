"""Rebuild Metabase from the repo (PLAN.md Stage 6, D8). Idempotent: a rerun changes nothing.

    uv run python scripts/metabase_bootstrap.py [--max-seconds 180] [--expect-no-changes]

1. First-run setup with the setup token (or log in), report time zone UTC (D15)
2. The data DB connection as bi_reader, the analytics schema only; wait for the sync
3. Collections; a view-only group and its API key for the proxy (written to .env.metabase)
4. Every card in metabase/cards/*.sql, plus one golden card per metric, upserted by name
5. Models on the key marts and simple measures (metabase/models.yml)
6. Native dashboards from metabase/dashboards/*.yml, with cross-filters and drill links
7. Proof the proxy key is view-only: it runs a saved card, and ad-hoc SQL is refused
Everything comes from env (cloud-ready rule 7). Cards in our collections that are no longer in
the repo are archived. Prints counts only, never row values (rule 8) or secrets.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

import metabase_content as mc

ROOT = Path(__file__).resolve().parent.parent
DB_NAME = "SendFast analytics"
PROXY_GROUP = "Proxy (view only)"
API_KEY_NAME = "sendfast-proxy"
API_KEY_FILE = ROOT / ".env.metabase"
MARTS_SCHEMA = "analytics"
MART_TABLES = 11


class MetabaseError(RuntimeError):
    pass


class Client:
    def __init__(self, base: str, session: str | None = None, api_key: str | None = None):
        self.base = base.rstrip("/")
        self.headers = {"Content-Type": "application/json"}
        if session:
            self.headers["X-Metabase-Session"] = session
        if api_key:
            self.headers["x-api-key"] = api_key

    def call(self, method: str, path: str, body: Any = None, ok: tuple[int, ...] = ()) -> Any:
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            self.base + path, data=data, method=method, headers=self.headers
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                text = resp.read().decode()
                if not text:
                    return None
                try:
                    return json.loads(text)
                except json.JSONDecodeError:  # some settings come back as a bare string
                    return text
        except urllib.error.HTTPError as e:
            if e.code in ok:
                return {"_status": e.code}
            detail = e.read().decode(errors="replace")[:500]
            raise MetabaseError(f"{method} {path} -> {e.code}: {detail}") from None

    def get(self, path: str) -> Any:
        return self.call("GET", path)

    def post(self, path: str, body: Any = None, ok: tuple[int, ...] = ()) -> Any:
        return self.call("POST", path, body, ok)

    def put(self, path: str, body: Any) -> Any:
        return self.call("PUT", path, body)


class Tally:
    def __init__(self) -> None:
        self.created: list[str] = []
        self.updated: list[str] = []
        self.unchanged = 0

    def note(self, kind: str, what: str) -> None:
        {"created": self.created, "updated": self.updated}[kind].append(what)

    @property
    def changes(self) -> int:
        return len(self.created) + len(self.updated)


def env(name: str, default: str | None = None) -> str:
    v = os.environ.get(name, default)
    if v is None or v == "":
        raise SystemExit(f"Missing env var {name} (see .env.example)")
    return v


# ── 1. Setup and settings ────────────────────────────────────────────────
def wait_healthy(base: str, deadline: float) -> None:
    while True:
        try:
            if Client(base).get("/api/health").get("status") == "ok":
                return
        except (MetabaseError, OSError):
            pass
        if time.monotonic() > deadline:
            raise SystemExit(f"Metabase at {base} is not healthy")
        time.sleep(2)


def login(base: str, tally: Tally) -> Client:
    email, password = env("MB_BOOTSTRAP_EMAIL"), env("MB_BOOTSTRAP_PASSWORD")
    anon = Client(base)
    props = anon.get("/api/session/properties")
    if not props.get("has-user-setup"):
        token = props.get("setup-token")
        if not token:
            raise SystemExit("Metabase is not set up and offers no setup token")
        anon.post(
            "/api/setup",
            {
                "token": token,
                "user": {
                    "email": email,
                    "password": password,
                    "first_name": "SendFast",
                    "last_name": "Admin",
                },
                "prefs": {"site_name": "SendFast", "site_locale": "en"},
            },
        )
        tally.note("created", "first-run setup")
    session = anon.post("/api/session", {"username": email, "password": password})["id"]
    return Client(base, session=session)


def ensure_settings(mb: Client, tally: Tally) -> None:
    wanted = {"report-timezone": "UTC", "site-name": "SendFast"}  # D15: UTC everywhere
    for key, value in wanted.items():
        current = mb.get(f"/api/setting/{key}")
        if current != value:
            mb.put(f"/api/setting/{key}", {"value": value})
            tally.note("updated", f"setting {key}")
        else:
            tally.unchanged += 1


# ── 2. Data DB ───────────────────────────────────────────────────────────
def ensure_database(mb: Client, tally: Tally, deadline: float) -> dict[str, Any]:
    details = {
        "host": env("MB_DATA_DB_HOST"),
        "port": int(env("MB_DATA_DB_PORT", "5432")),
        "dbname": env("DATA_DB_NAME"),
        "user": env("BI_READER_USER", "bi_reader"),
        "ssl": env("MB_DATA_DB_SSL", "false").lower() == "true",
        "schema-filters-type": "inclusion",
        "schema-filters-patterns": MARTS_SCHEMA,
    }
    existing = [d for d in mb.get("/api/database")["data"] if d["name"] == DB_NAME]
    if existing:
        db = mb.get(f"/api/database/{existing[0]['id']}")
        if any(db["details"].get(k) != v for k, v in details.items()):
            body = {"details": {**details, "password": env("BI_READER_PASSWORD")}}
            db = mb.put(f"/api/database/{db['id']}", body)
            mb.post(f"/api/database/{db['id']}/sync_schema")
            tally.note("updated", f"database {DB_NAME}")
        else:
            tally.unchanged += 1
    else:
        body = {
            "engine": "postgres",
            "name": DB_NAME,
            "details": {**details, "password": env("BI_READER_PASSWORD")},
        }
        db = mb.post("/api/database", body)
        tally.note("created", f"database {DB_NAME}")
    while True:  # the first sync runs in the background
        md = mb.get(f"/api/database/{db['id']}/metadata?include_hidden=true")
        tables = [t for t in md["tables"] if t["schema"] == MARTS_SCHEMA]
        if len(tables) >= MART_TABLES and all(t.get("fields") for t in tables):
            return md
        if time.monotonic() > deadline:
            raise SystemExit(f"Metabase synced {len(tables)}/{MART_TABLES} mart tables in time")
        time.sleep(2)


# ── 3. Collections, permissions, API key ─────────────────────────────────
def ensure_collections(mb: Client, content: mc.Content, tally: Tally) -> dict[str, int]:
    current = {
        c["name"]: c
        for c in mb.get("/api/collection")
        if isinstance(c.get("id"), int)
        and not c.get("archived")
        and c.get("personal_owner_id") is None
        and c.get("location") == "/"
    }
    ids = {}
    for c in content.collections:
        have = current.get(c["name"])
        if have is None:
            have = mb.post("/api/collection", {"name": c["name"], "description": c["description"]})
            tally.note("created", f"collection {c['name']}")
        elif have.get("description") != c["description"]:
            mb.put(f"/api/collection/{have['id']}", {"description": c["description"]})
            tally.note("updated", f"collection {c['name']}")
        else:
            tally.unchanged += 1
        ids[c["name"]] = have["id"]
    return ids


def ensure_permissions(mb: Client, db_id: int, collection_ids: dict[str, int], tally: Tally) -> int:
    groups = {g["name"]: g for g in mb.get("/api/permissions/group")}
    if PROXY_GROUP not in groups:
        groups[PROXY_GROUP] = mb.post("/api/permissions/group", {"name": PROXY_GROUP})
        tally.note("created", f"group {PROXY_GROUP}")
    proxy = groups[PROXY_GROUP]["id"]
    all_users = next(
        g["id"] for g in groups.values() if g.get("magic_group_type") == "all-internal-users"
    )
    targets = [all_users, proxy]

    # Data: see the marts through saved cards; write no new queries (view only).
    wanted = {"view-data": "unrestricted", "create-queries": "no", "download": {"schemas": "full"}}
    graph = mb.get("/api/permissions/graph")
    change = {}
    for g in targets:
        have = graph["groups"].get(str(g), {}).get(str(db_id), {})
        stored = {"create-queries": "no", **have}  # Metabase stores "no" by omitting the key
        if any(stored.get(k) != v for k, v in wanted.items()):
            change[str(g)] = {str(db_id): {**have, **wanted}}
    if change:
        mb.put("/api/permissions/graph", {"revision": graph["revision"], "groups": change})
        tally.note("updated", "data permissions")
    else:
        tally.unchanged += 1

    # Collections: read only, everywhere, for everyone but admins.
    cgraph = mb.get("/api/collection/graph")
    cchange = {}
    for g in targets:
        have = cgraph["groups"].get(str(g), {})
        want = {"root": "read", **{str(cid): "read" for cid in collection_ids.values()}}
        if any(have.get(k) != v for k, v in want.items()):
            cchange[str(g)] = want
    if cchange:
        mb.put("/api/collection/graph", {"revision": cgraph["revision"], "groups": cchange})
        tally.note("updated", "collection permissions")
    else:
        tally.unchanged += 1
    return proxy


def read_key_file() -> str | None:
    if not API_KEY_FILE.exists():
        return None
    for line in API_KEY_FILE.read_text(encoding="utf-8").splitlines():
        if line.startswith("MB_API_KEY="):
            return line.split("=", 1)[1].strip() or None
    return None


def write_key_file(key: str) -> None:
    API_KEY_FILE.write_text(
        "# Written by scripts/metabase_bootstrap.py: the proxy's view-only Metabase API key.\n"
        "# Local synthetic stack only; gitignored. Never commit (D12).\n"
        f"MB_API_KEY={key}\n",
        encoding="utf-8",
    )
    API_KEY_FILE.chmod(0o600)


def ensure_api_key(mb: Client, base: str, proxy_group: int, tally: Tally) -> str:
    keys = [k for k in mb.get("/api/api-key") if k["name"] == API_KEY_NAME]
    if not keys:
        created = mb.post("/api/api-key", {"name": API_KEY_NAME, "group_id": proxy_group})
        write_key_file(created["unmasked_key"])
        tally.note("created", f"API key {API_KEY_NAME}")
        return created["unmasked_key"]
    key = keys[0]
    if (key.get("group") or {}).get("id") != proxy_group:
        mb.put(f"/api/api-key/{key['id']}", {"group_id": proxy_group})
        tally.note("updated", f"API key {API_KEY_NAME} group")
    local = read_key_file()
    if local:
        try:
            Client(base, api_key=local).get("/api/user/current")
            tally.unchanged += 1
            return local
        except MetabaseError:
            pass
    fresh = mb.put(f"/api/api-key/{key['id']}/regenerate", {})["unmasked_key"]
    write_key_file(fresh)
    tally.note("updated", f"API key {API_KEY_NAME} (regenerated: no usable local copy)")
    return fresh


# ── 4/5. Cards, models, measures ─────────────────────────────────────────
def _native_fingerprint(card: dict[str, Any]) -> Any:
    stage = (card.get("dataset_query") or {}).get("stages", [{}])[0]
    tags = sorted(stage.get("template-tags") or [], key=lambda t: t.get("name", ""))
    return stage.get("native"), [
        {
            k: t.get(k)
            for k in ("id", "name", "display-name", "type", "required", "default")
            if k in t
        }
        for t in tags
    ]


def _card_matches(have: dict[str, Any], want: dict[str, Any]) -> bool:
    for k in ("name", "description", "collection_id", "display", "type", "visualization_settings"):
        if (have.get(k) or None) != (want.get(k) or None):
            return False
    if want["type"] == "model":
        h = (have.get("dataset_query") or {}).get("stages", [{}])[0]
        return h.get("source-table") == want["dataset_query"]["stages"][0]["source-table"]
    return _native_fingerprint(have) == _native_fingerprint(want)


def ensure_cards(
    mb: Client,
    db: dict[str, Any],
    content: mc.Content,
    collection_ids: dict[str, int],
    tally: Tally,
) -> dict[str, int]:
    ours = set(collection_ids.values())
    existing: dict[str, dict[str, Any]] = {}
    for c in mb.get("/api/card?f=all"):
        if c.get("collection_id") in ours and not c.get("archived"):
            existing.setdefault(c["name"], c)
    tables = {t["name"]: t for t in db["tables"] if t["schema"] == MARTS_SCHEMA}

    wanted: list[dict[str, Any]] = []
    for card in content.cards + content.golden:
        wanted.append(
            {
                "name": card.name,
                "description": card.description,
                "collection_id": collection_ids[card.collection],
                "display": card.display,
                "type": "question",
                "visualization_settings": card.viz,
                "dataset_query": mc.native_query(db["id"], card, content.params),
            }
        )
    for m in content.models["models"]:
        wanted.append(
            {
                "name": m["name"],
                "description": m.get("description"),
                "collection_id": collection_ids["Models"],
                "display": "table",
                "type": "model",
                "visualization_settings": {},
                "dataset_query": {
                    "lib/type": "mbql/query",
                    "database": db["id"],
                    "stages": [
                        {"lib/type": "mbql.stage/mbql", "source-table": tables[m["table"]]["id"]}
                    ],
                },
            }
        )

    ids = {}
    for want in wanted:
        have = existing.pop(want["name"], None)
        if have is None:
            ids[want["name"]] = mb.post("/api/card", want)["id"]
            tally.note("created", f"card {want['name']}")
            continue
        ids[want["name"]] = have["id"]
        if _card_matches(mb.get(f"/api/card/{have['id']}"), want):
            tally.unchanged += 1
        else:
            mb.put(f"/api/card/{have['id']}", want)
            tally.note("updated", f"card {want['name']}")
    for name, stale in existing.items():  # in our collections, no longer in the repo
        mb.put(f"/api/card/{stale['id']}", {"archived": True})
        tally.note("updated", f"card {name} (archived: not in the repo)")
    return ids


def ensure_measures(mb: Client, db: dict[str, Any], content: mc.Content, tally: Tally) -> None:
    tables = {t["name"]: t for t in db["tables"] if t["schema"] == MARTS_SCHEMA}
    existing = {m["name"]: m for m in mb.get("/api/measure") if not m.get("archived")}
    for m in content.models["measures"]:
        table = tables[m["table"]]
        fields = {f["name"]: f["id"] for f in table["fields"]}
        agg = mc.measure_aggregation(m, fields)
        definition = {
            "database": db["id"],
            "type": "query",
            "query": {"source-table": table["id"], "aggregation": [agg]},
        }
        have = existing.get(m["name"])
        if have is None:
            mb.post("/api/measure", {"name": m["name"], "definition": definition})
            have = next(x for x in mb.get("/api/measure") if x["name"] == m["name"])
            if m.get("description"):
                body = {"description": m["description"], "revision_message": "bootstrap"}
                mb.put(f"/api/measure/{have['id']}", body)
            tally.note("created", f"measure {m['name']}")
            continue
        stage = have["definition"]["stages"][0]
        same = (
            have.get("table_id") == table["id"]
            and mc.canon(stage.get("aggregation")) == mc.canon([agg])
            and (have.get("description") or None) == (m.get("description") or None)
        )
        if same:
            tally.unchanged += 1
        else:
            body = {"definition": definition, "description": m.get("description")}
            mb.put(f"/api/measure/{have['id']}", {**body, "revision_message": "bootstrap"})
            tally.note("updated", f"measure {m['name']}")


# ── 6. Dashboards ────────────────────────────────────────────────────────
def _dashcard_fingerprint(dc: dict[str, Any]) -> Any:
    maps = sorted(
        (m["parameter_id"], m["card_id"], json.dumps(m["target"]))
        for m in dc.get("parameter_mappings") or []
    )
    vs = dc.get("visualization_settings") or {}
    return (
        dc["card_id"],
        dc["row"],
        dc["col"],
        dc["size_x"],
        dc["size_y"],
        maps,
        json.dumps(vs, sort_keys=True),
    )


def _param_fingerprint(params: list[dict[str, Any]]) -> Any:
    keys = (
        "id",
        "name",
        "slug",
        "type",
        "sectionId",
        "default",
        "values_query_type",
        "values_source_type",
        "values_source_config",
    )
    return json.dumps([{k: p.get(k) for k in keys if k in p} for p in params], sort_keys=True)


def ensure_dashboards(
    mb: Client,
    content: mc.Content,
    collection_ids: dict[str, int],
    card_ids: dict[str, int],
    tally: Tally,
) -> dict[str, int]:
    ours = set(collection_ids.values())
    existing = {
        d["name"]: d
        for d in mb.get("/api/dashboard?f=all")
        if d.get("collection_id") in ours and not d.get("archived")
    }
    ids = {}
    for d in content.dashboards:  # shells first: drill links need every dashboard's id
        if d["name"] in existing:
            ids[d["name"]] = existing[d["name"]]["id"]
        else:
            body = {"name": d["name"], "collection_id": collection_ids[d["collection"]]}
            ids[d["name"]] = mb.post("/api/dashboard", body)["id"]
            tally.note("created", f"dashboard {d['name']}")
    cards = {c.name: c for c in content.cards}
    for d in content.dashboards:
        have = mb.get(f"/api/dashboard/{ids[d['name']]}")
        keep = {dc["card_id"]: dc["id"] for dc in have.get("dashcards") or [] if dc.get("card_id")}
        dashcards = mc.desired_dashcards(d, cards, card_ids, ids, keep)
        params = mc.dashboard_parameters(d, content.params, card_ids)
        same = (
            have.get("description") == d.get("description")
            and have.get("collection_id") == collection_ids[d["collection"]]
            and _param_fingerprint(have.get("parameters") or []) == _param_fingerprint(params)
            and sorted(map(_dashcard_fingerprint, have.get("dashcards") or []))
            == sorted(map(_dashcard_fingerprint, dashcards))
        )
        if same:
            tally.unchanged += 1
            continue
        mb.put(
            f"/api/dashboard/{ids[d['name']]}",
            {
                "description": d.get("description"),
                "collection_id": collection_ids[d["collection"]],
                "parameters": params,
                "dashcards": dashcards,
                "width": "full",
            },
        )
        if d["name"] not in [c.split("dashboard ", 1)[-1] for c in tally.created]:
            tally.note("updated", f"dashboard {d['name']}")
    return ids


# ── 7. Every dashboard card runs; the proxy key is view-only ─────────────
def verify_dashboards(mb: Client, dash_ids: dict[str, int]) -> int:
    """Run every dashcard with its dashboard's default filters; any SQL error fails the run."""
    failures, ran = [], 0
    for name, did in dash_ids.items():
        dash = mb.get(f"/api/dashboard/{did}")
        defaults = {p["id"]: p for p in dash["parameters"] if "default" in p}
        for dc in dash["dashcards"]:
            params = [
                {
                    "id": m["parameter_id"],
                    "type": defaults[m["parameter_id"]]["type"],
                    "value": defaults[m["parameter_id"]]["default"],
                    "target": m["target"],
                }
                for m in dc["parameter_mappings"]
                if m["parameter_id"] in defaults
            ]
            path = f"/api/dashboard/{did}/dashcard/{dc['id']}/card/{dc['card_id']}/query"
            result = mb.post(path, {"parameters": params})
            ran += 1
            if result.get("status") != "completed" or result.get("error"):
                failures.append(f"{name} / {dc['card']['name']}: {str(result.get('error'))[:200]}")
    if failures:
        raise SystemExit("Dashboard cards failed:\n  " + "\n  ".join(failures))
    return ran


# ── 7b. The proxy key is view-only ────────────────────────────────────────
def verify_proxy_key(base: str, key: str, db_id: int, probe_card: int) -> None:
    proxy = Client(base, api_key=key)
    result = proxy.post(f"/api/card/{probe_card}/query", {"parameters": []})
    if result.get("status") != "completed":
        raise SystemExit("The proxy key could not run a saved card")
    adhoc = {"database": db_id, "type": "native", "native": {"query": "select 1"}}
    refused = proxy.post("/api/dataset", adhoc, ok=(403,))
    if not (isinstance(refused, dict) and refused.get("_status") == 403):
        raise SystemExit("The proxy key ran ad-hoc SQL: it must be view-only")
    refused = proxy.post(
        "/api/card",
        {"name": "x", "display": "table", "visualization_settings": {}, "dataset_query": adhoc},
        ok=(403,),
    )
    if not (isinstance(refused, dict) and refused.get("_status") == 403):
        raise SystemExit("The proxy key created a card: it must be view-only")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--max-seconds", type=float, default=180, help="fail if slower (gate 6)")
    ap.add_argument("--expect-no-changes", action="store_true", help="fail if anything changes")
    args = ap.parse_args(argv)

    t0 = time.monotonic()
    deadline = t0 + args.max_seconds
    content = mc.load_content()
    problems = mc.validate(content)
    if problems:
        print("metabase/ content is invalid:")
        print("\n".join(f"  - {p}" for p in problems))
        return 1

    base = env("MB_SITE_URL")
    tally = Tally()
    wait_healthy(base, deadline)
    mb = login(base, tally)
    ensure_settings(mb, tally)
    db = ensure_database(mb, tally, deadline)
    collection_ids = ensure_collections(mb, content, tally)
    proxy_group = ensure_permissions(mb, db["id"], collection_ids, tally)
    key = ensure_api_key(mb, base, proxy_group, tally)
    card_ids = ensure_cards(mb, db, content, collection_ids, tally)
    ensure_measures(mb, db, content, tally)
    dash_ids = ensure_dashboards(mb, content, collection_ids, card_ids, tally)
    ran = verify_dashboards(mb, dash_ids)
    verify_proxy_key(base, key, db["id"], card_ids[content.golden[0].name])

    elapsed = time.monotonic() - t0
    print(
        f"Metabase bootstrap: {len(content.cards)} cards, {len(content.golden)} golden cards, "
        f"{len(content.models['models'])} models, {len(content.models['measures'])} measures, "
        f"{len(dash_ids)} dashboards."
    )
    for kind in ("created", "updated"):
        items = getattr(tally, kind)
        if items:
            print(
                f"  {kind} {len(items)}: "
                + "; ".join(items[:12])
                + (" ..." if len(items) > 12 else "")
            )
    print(
        f"  unchanged {tally.unchanged}. {ran} dashboard cards ran clean. Proxy key is view-only."
    )
    print(f"  {elapsed:.1f} s (limit {args.max_seconds:g} s)")
    if elapsed > args.max_seconds:
        print(f"Too slow: {elapsed:.1f} s > {args.max_seconds:g} s")
        return 1
    if args.expect_no_changes and tally.changes:
        print(f"Expected a rerun to change nothing; it made {tally.changes} change(s).")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

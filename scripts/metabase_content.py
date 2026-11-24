"""Metabase content as code (PLAN.md Stage 6, D8): load, validate and shape what's in metabase/.

Pure functions, no network: the bootstrap and golden_check use them, and unit tests cover them.
- metabase/parameters.yml    the shared parameter contract
- metabase/collections.yml   collections
- metabase/cards/*.sql       native SQL cards with `-- key: value` front matter
- metabase/models.yml        models on key marts, and simple additive measures (D7)
- metabase/dashboards/*.yml  native dashboards: layout, filters, cross-filters, drill links
Golden cards (one per metric) are generated from metrics/metrics.yml, never hand-copied.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
MB_DIR = ROOT / "metabase"
METRICS_PATH = ROOT / "metrics" / "metrics.yml"
GOLDEN_COLLECTION = "Golden numbers"
GOLDEN_PREFIX = "Golden: "
GRID_COLUMNS = 24
DISPLAYS = {"scalar", "bar", "row", "line", "pie", "table", "object"}
FRONT_MATTER_KEYS = {"name", "collection", "display", "params", "required", "description", "viz"}
YAML_KEYS = {"params", "required", "viz"}
TAG_RE = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")
FRONT_RE = re.compile(r"^--\s*([a-z_]+):\s?(.*)$")
# Cards read the marts only (rule 4, and bi_reader can't see anything else anyway).
FORBIDDEN_SCHEMA_RE = re.compile(
    r"\b(staging|intermediate|crm_hubspot|billing|ledger|rates|public)\.", re.IGNORECASE
)
CLOCK_RE = re.compile(r"\b(now\s*\(|current_date|current_timestamp|localtimestamp)", re.I)
PARAM_TYPES = {
    "date": {"tag": "date", "dashboard": "date/single", "section": "date"},
    "text": {"tag": "text", "dashboard": "string/=", "section": "string"},
}


def load_yaml(path: Path) -> Any:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


# ── Parameter contract ───────────────────────────────────────────────────
def load_parameters(path: Path = MB_DIR / "parameters.yml") -> dict[str, dict[str, Any]]:
    return load_yaml(path)["parameters"]


def validate_parameters(params: dict[str, dict[str, Any]]) -> list[str]:
    problems = []
    for name, p in params.items():
        if p.get("type") not in PARAM_TYPES:
            problems.append(f"parameter {name}: type must be one of {sorted(PARAM_TYPES)}")
        if not p.get("label"):
            problems.append(f"parameter {name}: label is missing")
        values = p.get("values")
        if values is not None and not (
            isinstance(values.get("static"), list) or {"card", "value"} <= set(values)
        ):
            problems.append(f"parameter {name}: values needs `static: [...]` or `card` + `value`")
    return problems


# ── Cards ────────────────────────────────────────────────────────────────
@dataclass
class Card:
    name: str
    collection: str
    display: str
    sql: str
    params: list[str] = field(default_factory=list)
    required: list[str] = field(default_factory=list)
    description: str | None = None
    viz: dict[str, Any] = field(default_factory=dict)
    source: str = ""


def parse_card(text: str, source: str = "") -> Card:
    meta: dict[str, Any] = {}
    lines = text.splitlines()
    i = 0
    while i < len(lines) and (m := FRONT_RE.match(lines[i])):
        key, raw = m.group(1), m.group(2).strip()
        if key not in FRONT_MATTER_KEYS:
            raise ValueError(f"{source}: unknown front-matter key {key!r}")
        meta[key] = yaml.safe_load(raw) if key in YAML_KEYS else raw
        i += 1
    for key in ("name", "collection", "display"):
        if not meta.get(key):
            raise ValueError(f"{source}: front matter needs `-- {key}:`")
    return Card(
        name=meta["name"],
        collection=meta["collection"],
        display=meta["display"],
        sql="\n".join(lines[i:]).strip() + "\n",
        params=list(meta.get("params") or []),
        required=list(meta.get("required") or []),
        description=meta.get("description") or None,
        viz=meta.get("viz") or {},
        source=source,
    )


def load_cards(cards_dir: Path = MB_DIR / "cards") -> list[Card]:
    return [
        parse_card(p.read_text(encoding="utf-8"), str(p.relative_to(ROOT)))
        for p in sorted(cards_dir.glob("*.sql"))
    ]


def validate_card(card: Card, params: dict[str, dict], collections: set[str]) -> list[str]:
    where = card.source or card.name
    problems = []
    if card.display not in DISPLAYS:
        problems.append(f"{where}: display {card.display!r} is not one of {sorted(DISPLAYS)}")
    if card.collection not in collections:
        problems.append(f"{where}: collection {card.collection!r} is not in collections.yml")
    unknown = [p for p in card.params if p not in params]
    if unknown:
        problems.append(f"{where}: params {unknown} are not in the parameter contract")
    used = set(TAG_RE.findall(card.sql))
    if used - set(card.params):
        problems.append(f"{where}: SQL uses {sorted(used - set(card.params))} not listed in params")
    if set(card.params) - used:
        problems.append(f"{where}: params {sorted(set(card.params) - used)} never used in the SQL")
    for r in card.required:
        if r not in card.params:
            problems.append(f"{where}: required {r!r} is not in params")
        elif params.get(r, {}).get("default") is None:
            problems.append(f"{where}: required {r!r} has no default in the parameter contract")
    if FORBIDDEN_SCHEMA_RE.search(card.sql):
        problems.append(f"{where}: reads a schema other than analytics (marts only)")
    if "analytics." not in card.sql:
        problems.append(f"{where}: reads no analytics mart")
    if CLOCK_RE.search(card.sql):
        problems.append(f"{where}: uses the clock (D11: fixed as-of date, never now())")
    return problems


def template_tags(card: Card, params: dict[str, dict]) -> list[dict[str, Any]]:
    """Native template tags in the shape Metabase v0.64 stores (MBQL 5: a list)."""
    tags = []
    for name in card.params:
        p = params[name]
        tag: dict[str, Any] = {
            "id": name,
            "name": name,
            "display-name": p["label"],
            "type": PARAM_TYPES[p["type"]]["tag"],
        }
        if name in card.required:
            tag["required"] = True
            tag["default"] = p["default"]
        tags.append(tag)
    return tags


def native_query(database_id: int, card: Card, params: dict[str, dict]) -> dict[str, Any]:
    return {
        "lib/type": "mbql/query",
        "database": database_id,
        "stages": [
            {
                "lib/type": "mbql.stage/native",
                "native": card.sql,
                "template-tags": template_tags(card, params),
            }
        ],
    }


def golden_cards(spec: dict[str, Any]) -> list[Card]:
    """One card per golden metric: its golden query with the periods written in as literals."""
    periods = {k: str(v) for k, v in spec["periods"].items()}
    cards = []
    for m in spec["metrics"]:
        sql = m["golden"]["query"]
        for k, v in periods.items():
            sql = sql.replace(f"%({k})s", "'" + v.replace("'", "''") + "'")
        if "%(" in sql:
            raise ValueError(f"{m['name']}: golden query uses a parameter not in periods")
        cards.append(
            Card(
                name=GOLDEN_PREFIX + m["name"],
                collection=GOLDEN_COLLECTION,
                display="table",
                sql=sql.strip() + "\n",
                description=f"Generated from metrics/metrics.yml ({m['label']}). Do not edit.",
                source=f"metrics/metrics.yml#{m['name']}",
            )
        )
    return cards


# ── Models and measures ──────────────────────────────────────────────────
def load_models(path: Path = MB_DIR / "models.yml") -> dict[str, list[dict[str, Any]]]:
    data = load_yaml(path)
    return {"models": data.get("models") or [], "measures": data.get("measures") or []}


def validate_models(content: dict[str, list[dict[str, Any]]]) -> list[str]:
    problems = []
    for m in content["models"]:
        if not m.get("name") or not m.get("table"):
            problems.append(f"model {m}: needs name and table")
    for m in content["measures"]:
        agg = m.get("aggregation") or {}
        if len(agg) != 1 or next(iter(agg)) not in {"sum", "count_where"}:
            problems.append(
                f"measure {m.get('name')}: aggregation must be one of sum / count_where (D7: "
                "anything more belongs in a mart)"
            )
    return problems


def measure_aggregation(m: dict[str, Any], field_ids: dict[str, int]) -> list[Any]:
    ((op, column),) = m["aggregation"].items()
    fid = field_ids[column]
    if op == "sum":
        return ["sum", ["field", fid, None]]
    return ["count-where", ["=", ["field", fid, None], True]]


def canon(clause: Any) -> Any:
    """An MBQL clause without options maps or nils, so legacy and MBQL 5 forms compare equal."""
    if isinstance(clause, list):
        return [canon(x) for x in clause if not isinstance(x, dict) and x is not None]
    return clause


# ── Dashboards ───────────────────────────────────────────────────────────
def load_dashboards(dash_dir: Path = MB_DIR / "dashboards") -> list[dict[str, Any]]:
    out = []
    for p in sorted(dash_dir.glob("*.yml")):
        d = load_yaml(p)
        d["source"] = str(p.relative_to(ROOT))
        out.append(d)
    return out


def validate_dashboards(
    dashboards: list[dict[str, Any]],
    cards: list[Card],
    params: dict[str, dict],
    collections: set[str],
) -> list[str]:
    problems = []
    by_name = {c.name: c for c in cards}
    dash_params = {d["name"]: set(d.get("parameters") or []) for d in dashboards}
    if len(dash_params) != len(dashboards):
        problems.append("two dashboards share a name")
    for d in dashboards:
        where = d["source"]
        if d.get("collection") not in collections:
            problems.append(
                f"{where}: collection {d.get('collection')!r} is not in collections.yml"
            )
        unknown = [p for p in d.get("parameters") or [] if p not in params]
        if unknown:
            problems.append(f"{where}: parameters {unknown} are not in the parameter contract")
        seen: set[str] = set()
        cells: dict[tuple[int, int], str] = {}
        for dc in d.get("cards") or []:
            name = dc.get("card")
            card = by_name.get(name)
            if card is None:
                problems.append(f"{where}: card {name!r} is not in metabase/cards")
                continue
            if name in seen:
                problems.append(f"{where}: card {name!r} appears twice")
            seen.add(name)
            row, col, sx, sy = (dc.get(k) for k in ("row", "col", "size_x", "size_y"))
            if not all(isinstance(v, int) and v >= 0 for v in (row, col, sx, sy)) or not sx * sy:
                problems.append(f"{where}: {name!r} needs row, col, size_x, size_y (>= 0)")
                continue
            if col + sx > GRID_COLUMNS:
                problems.append(f"{where}: {name!r} runs past the {GRID_COLUMNS}-column grid")
            for r in range(row, row + sy):
                for c in range(col, col + sx):
                    if (r, c) in cells:
                        problems.append(f"{where}: {name!r} overlaps {cells[(r, c)]!r}")
                        break
                    cells[(r, c)] = name
                else:
                    continue
                break
            missing_req = [r for r in card.required if r not in dash_params[d["name"]]]
            if missing_req:
                problems.append(f"{where}: {name!r} requires {missing_req}, not a dashboard filter")
            for target, column in (dc.get("crossfilter") or {}).items():
                if target not in dash_params[d["name"]]:
                    problems.append(
                        f"{where}: {name!r} cross-filters {target!r}, not a filter here"
                    )
                if not re.search(rf"\b{re.escape(column)}\b", card.sql):
                    problems.append(
                        f"{where}: {name!r} has no column {column!r} to cross-filter on"
                    )
            link = dc.get("link")
            if link:
                target = link.get("dashboard")
                if target not in dash_params:
                    problems.append(f"{where}: {name!r} links to unknown dashboard {target!r}")
                    continue
                for tp, column in (link.get("parameters") or {}).items():
                    if tp not in dash_params[target]:
                        problems.append(
                            f"{where}: {name!r} sets {tp!r}, not a filter on {target!r}"
                        )
                    if not re.search(rf"\b{re.escape(column)}\b", card.sql):
                        problems.append(f"{where}: {name!r} has no column {column!r} to link with")
    return problems


def dashboard_parameters(
    d: dict[str, Any], params: dict[str, dict], card_ids: dict[str, int]
) -> list[dict[str, Any]]:
    out = []
    for name in d.get("parameters") or []:
        p = params[name]
        kind = PARAM_TYPES[p["type"]]
        dp: dict[str, Any] = {
            "id": name,
            "name": p["label"],
            "slug": name,
            "type": kind["dashboard"],
            "sectionId": kind["section"],
        }
        if p.get("default") is not None:
            dp["default"] = p["default"] if p["type"] == "date" else [p["default"]]
        values = p.get("values")
        if values and "static" in values:
            dp["values_query_type"] = "list"
            dp["values_source_type"] = "static-list"
            dp["values_source_config"] = {"values": list(values["static"])}
        elif values:
            cfg: dict[str, Any] = {
                "card_id": card_ids[values["card"]],
                "value_field": ["field", values["value"], {"base-type": "type/Text"}],
            }
            if values.get("label"):
                cfg["label_field"] = ["field", values["label"], {"base-type": "type/Text"}]
            dp["values_query_type"] = "list"
            dp["values_source_type"] = "card"
            dp["values_source_config"] = cfg
        out.append(dp)
    return out


def _mapping(target_param: str, column: str) -> dict[str, Any]:
    return {
        "id": target_param,
        "source": {"type": "column", "id": column, "name": column},
        "target": {"type": "parameter", "id": target_param},
    }


def click_settings(dc: dict[str, Any], dashboard_ids: dict[str, int]) -> dict[str, Any]:
    """visualization_settings for a dashcard: cross-filter or a drill link to another dashboard."""
    if dc.get("crossfilter"):
        return {
            "click_behavior": {
                "type": "crossfilter",
                "parameterMapping": {t: _mapping(t, c) for t, c in dc["crossfilter"].items()},
            }
        }
    link = dc.get("link")
    if not link:
        return {}
    behavior = {
        "type": "link",
        "linkType": "dashboard",
        "targetId": dashboard_ids[link["dashboard"]],
        "parameterMapping": {t: _mapping(t, c) for t, c in link["parameters"].items()},
    }
    if link.get("column"):  # a table: the link sits on one column
        return {"column_settings": {f'["name","{link["column"]}"]': {"click_behavior": behavior}}}
    return {"click_behavior": behavior}


def desired_dashcards(
    d: dict[str, Any],
    cards: dict[str, Card],
    card_ids: dict[str, int],
    dashboard_ids: dict[str, int],
    existing: dict[int, int],
) -> list[dict[str, Any]]:
    """Dashcards for PUT /api/dashboard/:id. `existing` maps card_id -> dashcard id to keep ids."""
    out = []
    next_new = -1
    dash_params = set(d.get("parameters") or [])
    for dc in d["cards"]:
        card = cards[dc["card"]]
        cid = card_ids[card.name]
        if cid in existing:
            dcid = existing[cid]
        else:
            dcid, next_new = next_new, next_new - 1
        out.append(
            {
                "id": dcid,
                "card_id": cid,
                "row": dc["row"],
                "col": dc["col"],
                "size_x": dc["size_x"],
                "size_y": dc["size_y"],
                "parameter_mappings": [
                    {
                        "parameter_id": p,
                        "card_id": cid,
                        "target": ["variable", ["template-tag", p]],
                    }
                    for p in card.params
                    if p in dash_params
                ],
                "visualization_settings": click_settings(dc, dashboard_ids),
            }
        )
    return out


# ── Everything at once ───────────────────────────────────────────────────
@dataclass
class Content:
    params: dict[str, dict]
    collections: list[dict[str, Any]]
    cards: list[Card]
    golden: list[Card]
    models: dict[str, list[dict[str, Any]]]
    dashboards: list[dict[str, Any]]


def load_content() -> Content:
    return Content(
        params=load_parameters(),
        collections=load_yaml(MB_DIR / "collections.yml")["collections"],
        cards=load_cards(),
        golden=golden_cards(load_yaml(METRICS_PATH)),
        models=load_models(),
        dashboards=load_dashboards(),
    )


def validate(content: Content) -> list[str]:
    collections = {c["name"] for c in content.collections}
    problems = validate_parameters(content.params)
    names = [c.name for c in content.cards + content.golden] + [
        m["name"] for m in content.models["models"]
    ]
    dupes = sorted({n for n in names if names.count(n) > 1})
    if dupes:
        problems.append(f"card/model names must be unique: {dupes}")
    for c in content.cards + content.golden:
        problems += validate_card(c, content.params, collections)
    for name, p in content.params.items():
        src = (p.get("values") or {}).get("card")
        if src and src not in {c.name for c in content.cards}:
            problems.append(f"parameter {name}: values card {src!r} is not in metabase/cards")
    problems += validate_models(content.models)
    problems += validate_dashboards(content.dashboards, content.cards, content.params, collections)
    return problems

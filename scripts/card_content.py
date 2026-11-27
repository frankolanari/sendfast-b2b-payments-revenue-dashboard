"""Dashboard queries as code (PLAN.md Stages 6 and 7): load and check what's in queries/.

Pure functions: the card registry, the golden check, the snapshot export and tests use them.
- queries/parameters.yml    the shared parameter contract
- queries/collections.yml   the page areas a card belongs to
- queries/cards/*.sql       SQL cards with `-- key: value` front matter
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parent.parent
QUERY_DIR = ROOT / "queries"
METRICS_PATH = ROOT / "metrics" / "metrics.yml"
GOLDEN_COLLECTION = "Golden numbers"
GOLDEN_PREFIX = "Golden: "
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
PARAM_TYPES = {"date", "text"}


def load_yaml(path: Path) -> Any:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def load_parameters(path: Path = QUERY_DIR / "parameters.yml") -> dict[str, dict[str, Any]]:
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


def load_cards(cards_dir: Path = QUERY_DIR / "cards") -> list[Card]:
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


# ── The whole repo ───────────────────────────────────────────────────────
@dataclass
class Content:
    params: dict[str, dict]
    collections: list[dict[str, Any]]
    cards: list[Card]
    golden: list[Card]


def load_content() -> Content:
    return Content(
        params=load_parameters(),
        collections=load_yaml(QUERY_DIR / "collections.yml")["collections"],
        cards=load_cards(),
        golden=golden_cards(load_yaml(METRICS_PATH)),
    )


def validate(content: Content) -> list[str]:
    collections = {c["name"] for c in content.collections}
    problems = validate_parameters(content.params)
    names = [c.name for c in content.cards + content.golden]
    dupes = sorted({n for n in names if names.count(n) > 1})
    if dupes:
        problems.append(f"card names must be unique: {dupes}")
    for c in content.cards + content.golden:
        problems += validate_card(c, content.params, collections)
    for name, p in content.params.items():
        src = (p.get("values") or {}).get("card")
        if src and src not in {c.name for c in content.cards}:
            problems.append(f"parameter {name}: values card {src!r} is not in queries/cards")
    return problems

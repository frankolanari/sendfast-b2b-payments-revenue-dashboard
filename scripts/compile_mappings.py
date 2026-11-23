"""Compile a CRM map (mappings/crm/<crm>.yml) into dbt staging models (PLAN.md Stage 2).

    uv run python scripts/compile_mappings.py compile --crm hubspot   # write the models
    uv run python scripts/compile_mappings.py check --crm hubspot     # fail if output is stale
    uv run python scripts/compile_mappings.py validate path/to/map.yml

The map is checked against contract/schema_contract.yml first. Every file the compiler writes
lives in dbt/models/staging/crm/ and starts with a DO NOT EDIT header.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import yaml
from contract_check import CONTRACT_PATH, load_yaml, parse_version

ROOT = Path(__file__).resolve().parent.parent
MAPPINGS_DIR = ROOT / "mappings" / "crm"
OUTPUT_DIR = ROOT / "dbt" / "models" / "staging" / "crm"

MAP_KEYS = {"crm", "contract_version", "source_schema", "timezone"}
ENTITY_KEYS = {"source", "supported", "filter", "columns", "values", "derived"}
TRANSFORMS = {"lower", "upper", "trim", "domain"}
IDENT = re.compile(r"^[a-z_][a-z0-9_]*$")
RAW_COLUMN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
# Postgres reserved words: the only identifiers that must be quoted. Non-reserved keywords such as
# `timestamp`, `value` or `date` work unquoted as column names (checked against Postgres 17).
NEEDS_QUOTES = {
    "all", "and", "any", "array", "as", "asc", "case", "cast", "check", "collate", "column",
    "constraint", "create", "default", "desc", "distinct", "do", "else", "end", "except", "false",
    "for", "foreign", "from", "grant", "group", "having", "in", "into", "is", "join", "limit",
    "not", "null", "offset", "on", "only", "or", "order", "primary", "references", "select",
    "table", "then", "to", "true", "union", "unique", "user", "using", "when", "where", "with",
}  # fmt: skip
INDENT = "    "


# ── Contract view ────────────────────────────────────────────────────────
def crm_tables(contract: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Entity name (table suffix) -> contract table, in contract order."""
    return {
        t["name"].removeprefix("stg_crm__"): t for t in contract["tables"] if t["source"] == "crm"
    }


# ── Validation ───────────────────────────────────────────────────────────
def _value_ok(col: dict[str, Any], value: Any) -> bool:
    if not isinstance(value, str):
        return False
    if "allowed_values" in col:
        return value in col["allowed_values"]
    return re.fullmatch(col["pattern"], value) is not None


def _column_spec_errors(where: str, spec: Any, col: dict[str, Any]) -> list[str]:
    if isinstance(spec, str):
        ok = RAW_COLUMN.match(spec)
        return [] if ok else [f"{where}: {spec!r} is not a valid source column name"]
    if not isinstance(spec, dict):
        return [f"{where}: must be a source column name or a mapping"]
    errors = []
    unknown = set(spec) - {"column", "expr", "transform", "timezone"}
    if unknown:
        errors.append(f"{where}: unknown keys {sorted(unknown)}")
    if ("column" in spec) == ("expr" in spec):
        errors.append(f"{where}: give exactly one of 'column' or 'expr'")
    if "column" in spec and not RAW_COLUMN.match(str(spec["column"])):
        errors.append(f"{where}: {spec['column']!r} is not a valid source column name")
    if "transform" in spec:
        if "column" not in spec:
            errors.append(f"{where}: 'transform' only applies to 'column'")
        if spec["transform"] not in TRANSFORMS:
            errors.append(
                f"{where}: unknown transform {spec['transform']!r}; use {sorted(TRANSFORMS)}"
            )
    if "timezone" in spec:
        if col["type"] != "timestamptz":
            errors.append(f"{where}: 'timezone' only applies to timestamptz columns")
        errors += _timezone_errors(where, spec["timezone"])
    return errors


def _timezone_errors(where: str, tz: Any) -> list[str]:
    try:
        ZoneInfo(str(tz))
    except (ZoneInfoNotFoundError, ValueError):
        return [f"{where}: unknown timezone {tz!r}"]
    return []


def validate_map(m: Any, contract: dict[str, Any]) -> list[str]:
    if not isinstance(m, dict):
        return ["map must be a YAML mapping"]
    errors: list[str] = []
    entities = crm_tables(contract)

    for key in sorted(set(m) - MAP_KEYS - set(entities)):
        errors.append(f"unknown top-level key {key!r}")
    for key in sorted(MAP_KEYS - set(m)):
        errors.append(f"missing top-level key {key!r}")
    if errors:
        return errors

    if not IDENT.match(str(m["crm"])):
        errors.append(f"crm: {m['crm']!r} must be a lower-case identifier")
    if not IDENT.match(str(m["source_schema"])) or m["source_schema"] == "public":
        errors.append("source_schema: must be a lower-case identifier other than 'public'")
    errors += _timezone_errors("timezone", m["timezone"])
    try:
        map_v, contract_v = (
            parse_version(str(m["contract_version"])),
            parse_version(contract["contract_version"]),
        )
        if map_v[0] != contract_v[0] or map_v > contract_v:
            errors.append(
                f"contract_version: map targets {m['contract_version']}, contract is "
                f"{contract['contract_version']} (same major, not newer, required)"
            )
    except ValueError:
        errors.append(f"contract_version: {m['contract_version']!r} is not a version")

    for entity, table in entities.items():
        where = entity
        block = m.get(entity)
        if not isinstance(block, dict):
            errors.append(f"{where}: missing (every canonical CRM table needs a block)")
            continue
        for key in sorted(set(block) - ENTITY_KEYS):
            errors.append(f"{where}: unknown key {key!r}")
        if block.get("supported", True) is False:
            if not table.get("optional"):
                errors.append(f"{where}: the contract requires this table; it can't be unsupported")
            continue
        if not RAW_COLUMN.match(str(block.get("source", ""))):
            errors.append(f"{where}: 'source' (the raw table) is required")
        if "filter" in block and not isinstance(block["filter"], str):
            errors.append(f"{where}: 'filter' must be a SQL condition string")

        contract_cols = {c["name"]: c for c in table["columns"]}
        columns = block.get("columns") or {}
        derived = block.get("derived") or {}
        values = block.get("values") or {}
        for name in columns:
            if name not in contract_cols:
                errors.append(
                    f"{where}.columns: {name!r} is not a contract column of {table['name']}"
                )
            else:
                errors += _column_spec_errors(
                    f"{where}.columns.{name}", columns[name], contract_cols[name]
                )
        for name, expr in derived.items():
            if name not in contract_cols:
                errors.append(
                    f"{where}.derived: {name!r} is not a contract column of {table['name']}"
                )
            elif name in columns:
                errors.append(f"{where}.derived: {name!r} is also in columns")
            elif not isinstance(expr, str):
                errors.append(f"{where}.derived.{name}: must be a SQL expression string")
        for name in contract_cols:
            if name not in columns and name not in derived:
                errors.append(f"{where}: missing required contract column {name!r}")
        for name, mapping in values.items():
            col = contract_cols.get(name)
            if col is None or name not in columns:
                errors.append(f"{where}.values: {name!r} is not a mapped column")
                continue
            if "allowed_values" not in col and "pattern" not in col:
                errors.append(
                    f"{where}.values: {name!r} has no allowed values or pattern to map to"
                )
                continue
            if not isinstance(mapping, dict) or not mapping:
                errors.append(f"{where}.values.{name}: must map source values to canonical values")
                continue
            for src, canonical in mapping.items():
                if not _value_ok(col, canonical):
                    allowed = col.get("allowed_values") or f"pattern {col['pattern']}"
                    errors.append(
                        f"{where}.values.{name}: {src!r} maps to unknown canonical value "
                        f"{canonical!r} (allowed: {allowed})"
                    )
    return errors


# ── SQL generation ───────────────────────────────────────────────────────
def quote(name: str) -> str:
    return name if IDENT.match(name) and name not in NEEDS_QUOTES else f'"{name}"'


def literal(value: Any) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def header(m: dict[str, Any], contract: dict[str, Any], comment: str = "--") -> str:
    return (
        f"{comment} GENERATED by scripts/compile_mappings.py from mappings/crm/{m['crm']}.yml "
        f"(contract {contract['contract_version']}). DO NOT EDIT.\n"
        f"{comment} Regenerate: make compile-maps CRM={m['crm']}\n"
    )


def _source_expr(spec: Any) -> str:
    """The raw value, after any transform, before value mapping and casting."""
    if isinstance(spec, str):
        return quote(spec)
    if "expr" in spec:
        return f"({spec['expr']})"
    raw = quote(spec["column"])
    match spec.get("transform"):
        case "lower":
            return f"lower({raw})"
        case "upper":
            return f"upper({raw})"
        case "trim":
            return f"trim({raw})"
        case "domain":
            pattern = r"^(https?://)?(www\.)?|/.*$"
            return f"nullif(regexp_replace(lower(trim({raw})), {literal(pattern)}, '', 'g'), '')"
    return raw


def _cast(expr: str, col_type: str, tz: str) -> str:
    if col_type == "timestamptz":
        return f"(cast({expr} as timestamp) at time zone {literal(tz)})"
    return f"cast({expr} as {col_type})"


def _value_case(expr: str, mapping: dict[Any, Any], depth: int) -> str:
    pad = INDENT * depth
    lines = [f"case cast({expr} as text)"]
    lines += [
        f"{pad}{INDENT}when {literal(src)} then {literal(dst)}" for src, dst in mapping.items()
    ]
    lines += [f"{pad}{INDENT}else cast({expr} as text)", f"{pad}end"]
    return "\n".join(lines)


def _source_cte(m: dict[str, Any], block: dict[str, Any]) -> str:
    sql = f"{INDENT}select * from {{{{ source({literal(m['crm'])}, {literal(block['source'])}) }}}}"
    if block.get("filter"):
        sql += f"\n{INDENT}where {block['filter']}"
    return sql


def compile_entity(
    m: dict[str, Any], contract: dict[str, Any], table: dict[str, Any], entity: str
) -> str:
    block = m[entity]
    top = header(m, contract)
    if block.get("supported", True) is False:
        cols = ",\n".join(
            f"{INDENT}cast(null as {c['type']}) as {quote(c['name'])}" for c in table["columns"]
        )
        note = f"-- {m['crm']} can't provide this table: typed and empty by design.\n"
        return f"{top}{note}\nselect\n{cols}\nwhere false\n"

    columns, derived, values = (
        block["columns"],
        block.get("derived") or {},
        block.get("values") or {},
    )
    renamed = []
    for col in table["columns"]:
        name = col["name"]
        if name not in columns:
            continue
        spec = columns[name]
        expr = _source_expr(spec)
        tz = spec.get("timezone", m["timezone"]) if isinstance(spec, dict) else m["timezone"]
        if name in values:  # value maps only apply to text columns, and `case` already yields text
            sql = _value_case(expr, values[name], depth=2)
        else:
            sql = _cast(expr, col["type"], tz)
        renamed.append(f"{INDENT * 2}{sql} as {quote(name)}")
    final = []
    for col in table["columns"]:
        name = col["name"]
        if name in derived:
            final.append(f"{INDENT}cast(({derived[name]}) as {col['type']}) as {quote(name)}")
        else:
            final.append(f"{INDENT}{quote(name)}")
    return (
        f"{top}\n"
        f"with source as (\n\n{_source_cte(m, block)}\n\n),\n\n"
        f"renamed as (\n\n{INDENT}select\n"
        + ",\n".join(renamed)
        + f"\n{INDENT}from source\n\n)\n\n"
        "select\n" + ",\n".join(final) + "\nfrom renamed\n"
    )


def compile_unmapped(m: dict[str, Any], contract: dict[str, Any]) -> str:
    """One row per (entity, column, source value) that the map has no canonical value for."""
    parts = []
    for entity in crm_tables(contract):
        block = m[entity]
        if block.get("supported", True) is False:
            continue
        for name, mapping in (block.get("values") or {}).items():
            expr = _source_expr(block["columns"][name])
            known = f",\n{INDENT * 2}".join(literal(k) for k in mapping)
            not_in = f"cast({expr} as text) not in (\n{INDENT * 2}{known}\n{INDENT})"
            where = [f"{expr} is not null", not_in]
            if block.get("filter"):
                where.insert(0, f"({block['filter']})")
            parts.append(
                f"select\n{INDENT}{literal(entity)} as entity,\n"
                f"{INDENT}{literal(name)} as canonical_column,\n"
                f"{INDENT}cast({expr} as text) as source_value,\n{INDENT}count(*) as row_count\n"
                f"from {{{{ source({literal(m['crm'])}, {literal(block['source'])}) }}}}\n"
                f"where\n{INDENT}"
                + f"\n{INDENT}and ".join(where)
                + f"\ngroup by cast({expr} as text)"
            )
    body = "\n\nunion all\n\n".join(parts) or (
        "select\n"
        f"{INDENT}cast(null as text) as entity,\n{INDENT}cast(null as text) as canonical_column,\n"
        f"{INDENT}cast(null as text) as source_value,\n{INDENT}cast(null as bigint) as row_count\n"
        "where false"
    )
    return f"{header(m, contract)}{{{{ config(schema='intermediate') }}}}\n\n{body}\n"


def compile_sources(m: dict[str, Any], contract: dict[str, Any]) -> str:
    tables = [
        {"name": m[e]["source"]}
        for e in crm_tables(contract)
        if m[e].get("supported", True) is not False
    ]
    unique = list({t["name"]: t for t in tables}.values())
    doc = {
        "version": 2,
        "sources": [{"name": m["crm"], "schema": m["source_schema"], "tables": unique}],
    }
    return header(m, contract, "#") + "\n" + yaml.safe_dump(doc, sort_keys=False)


def compile_tests(m: dict[str, Any], contract: dict[str, Any]) -> str:
    """dbt tests derived from the contract: not_null, unique, accepted_values, relationships."""
    models = []
    for table in crm_tables(contract).values():
        fk_by_col = {
            fk["columns"][0]: fk["references"]
            for fk in table.get("foreign_keys", [])
            if len(fk["columns"]) == 1
        }
        cols = []
        for col in table["columns"]:
            tests: list[Any] = []
            if not col["nullable"]:
                tests.append("not_null")
            if table["primary_key"] == [col["name"]]:
                tests.append("unique")
            if "allowed_values" in col:
                tests.append({"accepted_values": {"arguments": {"values": col["allowed_values"]}}})
            if col["name"] in fk_by_col:
                ref = fk_by_col[col["name"]]
                to = f"ref('{ref['table']}')"
                tests.append(
                    {"relationships": {"arguments": {"to": to, "field": ref["columns"][0]}}}
                )
            entry: dict[str, Any] = {"name": col["name"], "description": col["description"]}
            if tests:
                entry["data_tests"] = tests
            cols.append(entry)
        models.append({"name": table["name"], "description": table["description"], "columns": cols})
    doc = {"version": 2, "models": models}
    return header(m, contract, "#") + "\n" + yaml.safe_dump(doc, sort_keys=False, width=100)


def compile_map(m: dict[str, Any], contract: dict[str, Any]) -> dict[str, str]:
    """File name (under OUTPUT_DIR) -> content. Deterministic for a given map and contract."""
    out = {
        f"stg_crm__{e}.sql": compile_entity(m, contract, t, e)
        for e, t in crm_tables(contract).items()
    }
    out["int_crm__unmapped_values.sql"] = compile_unmapped(m, contract)
    out["_crm__sources.yml"] = compile_sources(m, contract)
    out["_stg_crm__models.yml"] = compile_tests(m, contract)
    return dict(sorted(out.items()))


# ── Files ────────────────────────────────────────────────────────────────
def load_map(path: Path) -> Any:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def compile_or_errors(path: Path) -> tuple[dict[str, str], list[str]]:
    contract = load_yaml(CONTRACT_PATH.read_text(encoding="utf-8"))
    m = load_map(path)
    errors = validate_map(m, contract)
    return ({}, errors) if errors else (compile_map(m, contract), [])


def stale_files(outputs: dict[str, str], out_dir: Path) -> list[str]:
    problems = []
    existing = {p.name for p in out_dir.glob("*") if p.is_file() and p.name != ".gitkeep"}
    for name, content in outputs.items():
        path = out_dir / name
        if not path.exists():
            problems.append(f"missing: {name}")
        elif path.read_text(encoding="utf-8") != content:
            problems.append(f"differs: {name}")
    problems += [f"not generated by this map: {n}" for n in sorted(existing - set(outputs))]
    return problems


def write_outputs(outputs: dict[str, str], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for path in out_dir.glob("*"):
        if path.is_file() and path.name not in outputs and path.name != ".gitkeep":
            path.unlink()  # this directory is compiler-owned
    for name, content in outputs.items():
        (out_dir / name).write_text(content, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("compile", "check"):
        p = sub.add_parser(name)
        p.add_argument("--crm", required=True, help="map name in mappings/crm/ (e.g. hubspot)")
    v = sub.add_parser("validate")
    v.add_argument("path", type=Path)
    args = parser.parse_args(argv)

    path = args.path if args.command == "validate" else MAPPINGS_DIR / f"{args.crm}.yml"
    if not path.exists():
        print(f"error: no map at {path}", file=sys.stderr)
        return 1
    outputs, errors = compile_or_errors(path)
    if errors:
        print(f"map rejected: {path.name} ({len(errors)} problem(s))", file=sys.stderr)
        print("\n".join(f"  - {e}" for e in errors), file=sys.stderr)
        return 1
    if args.command == "validate":
        print(f"{path.name}: valid")
    elif args.command == "compile":
        write_outputs(outputs, OUTPUT_DIR)
        print(f"compiled {path.name} -> {OUTPUT_DIR.relative_to(ROOT)} ({len(outputs)} files)")
    else:
        problems = stale_files(outputs, OUTPUT_DIR)
        if problems:
            print(f"compiled models are not up to date with {path.name}:", file=sys.stderr)
            print("\n".join(f"  - {p}" for p in problems), file=sys.stderr)
            print(f"  run: make compile-maps CRM={args.crm}", file=sys.stderr)
            return 1
        print(f"compiled models are up to date with {path.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

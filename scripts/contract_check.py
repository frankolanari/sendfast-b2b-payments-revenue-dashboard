"""Schema contract checks and data dictionary generation (PLAN.md Stage 1).

    uv run python scripts/contract_check.py check [--base-ref origin/main]
    uv run python scripts/contract_check.py render

`check` fails (exit 1) when:
  - the contract breaks its JSON Schema or its own cross-references
  - contract/data_dictionary.md is stale (not what `render` would write)
  - CHANGELOG.md has no entry for the current contract_version
  - with --base-ref: the contract's meaning changed since that ref without a version bump
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent.parent
CONTRACT_DIR = ROOT / "contract"
CONTRACT_PATH = CONTRACT_DIR / "schema_contract.yml"
SCHEMA_PATH = CONTRACT_DIR / "schema_contract.schema.json"
DICTIONARY_PATH = CONTRACT_DIR / "data_dictionary.md"
CHANGELOG_PATH = CONTRACT_DIR / "CHANGELOG.md"
CONTRACT_GIT_PATH = "contract/schema_contract.yml"

SOURCE_TITLES = {
    "crm": "CRM",
    "billing": "Billing (Stripe-shaped)",
    "ledger": "Ledger",
    "rates": "Rates",
}


# ── Loading ──────────────────────────────────────────────────────────────
def load_yaml(text: str) -> dict[str, Any]:
    data = yaml.safe_load(text)
    if not isinstance(data, dict):
        raise ValueError("contract must be a YAML mapping")
    return data


def load_schema() -> dict[str, Any]:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


# ── Validation ───────────────────────────────────────────────────────────
def schema_errors(contract: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(validator.iter_errors(contract), key=lambda e: list(e.absolute_path))
    return [
        f"schema: {'/'.join(map(str, e.absolute_path)) or '<root>'}: {e.message}" for e in errors
    ]


def semantic_errors(contract: dict[str, Any]) -> list[str]:
    """Cross-reference rules JSON Schema can't express. Assumes the schema already passed."""
    errors: list[str] = []
    tables: dict[str, dict[str, Any]] = {}

    for table in contract["tables"]:
        name = table["name"]
        if name in tables:
            errors.append(f"{name}: duplicate table name")
        tables[name] = table

        expected_prefix = f"stg_{table['source']}__"
        if not name.startswith(expected_prefix):
            errors.append(
                f"{name}: name must start with {expected_prefix!r} for source {table['source']!r}"
            )

        cols: dict[str, dict[str, Any]] = {}
        for col in table["columns"]:
            if col["name"] in cols:
                errors.append(f"{name}.{col['name']}: duplicate column")
            cols[col["name"]] = col
            if ("allowed_values" in col or "pattern" in col) and col["type"] != "text":
                errors.append(
                    f"{name}.{col['name']}: allowed_values/pattern only apply to text columns"
                )

        for key in table["primary_key"]:
            if key not in cols:
                errors.append(f"{name}: primary key column {key!r} is not a column")
            elif cols[key]["nullable"]:
                errors.append(f"{name}: primary key column {key!r} must not be nullable")

    for table in contract["tables"]:
        name = table["name"]
        cols = {c["name"]: c for c in table["columns"]}
        for fk in table.get("foreign_keys", []):
            ref = fk["references"]
            label = f"{name}({', '.join(fk['columns'])}) -> {ref['table']}"
            target = tables.get(ref["table"])
            if target is None:
                errors.append(f"{label}: referenced table does not exist")
                continue
            if len(fk["columns"]) != len(ref["columns"]):
                errors.append(f"{label}: column count differs from referenced columns")
                continue
            if list(ref["columns"]) != list(target["primary_key"]):
                errors.append(
                    f"{label}: must reference the target's primary key {target['primary_key']}"
                )
            target_cols = {c["name"]: c for c in target["columns"]}
            for src, dst in zip(fk["columns"], ref["columns"], strict=True):
                if src not in cols:
                    errors.append(f"{label}: column {src!r} is not a column of {name}")
                elif dst in target_cols and cols[src]["type"] != target_cols[dst]["type"]:
                    src_type, dst_type = cols[src]["type"], target_cols[dst]["type"]
                    errors.append(f"{label}: type mismatch {src} {src_type} vs {dst} {dst_type}")
    return errors


def validate(contract: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    errors = schema_errors(contract, schema)
    return errors or semantic_errors(contract)


# ── Versioning ───────────────────────────────────────────────────────────
def parse_version(version: str) -> tuple[int, int, int]:
    major, minor, patch = (int(part) for part in version.split("."))
    return major, minor, patch


def semantic_content(contract: dict[str, Any]) -> dict[str, Any]:
    """The contract minus its version. YAML comments are already gone after parsing."""
    return {k: v for k, v in contract.items() if k != "contract_version"}


def version_bump_errors(current: dict[str, Any], base: dict[str, Any] | None) -> list[str]:
    if base is None:
        return []
    cur_v, base_v = current["contract_version"], base["contract_version"]
    if parse_version(cur_v) < parse_version(base_v):
        return [f"version: contract_version went backwards ({base_v} -> {cur_v})"]
    changed = semantic_content(current) != semantic_content(base)
    if changed and parse_version(cur_v) == parse_version(base_v):
        return [
            f"version: contract changed since base but contract_version is still {cur_v}; bump it"
        ]
    return []


def changelog_errors(version: str, changelog: str) -> list[str]:
    if re.search(rf"^## \[?{re.escape(version)}\]?(\s|$)", changelog, flags=re.MULTILINE):
        return []
    return [f"changelog: contract/CHANGELOG.md has no '## {version}' entry"]


def contract_at_ref(ref: str) -> dict[str, Any] | None:
    """The contract as committed at `ref`, or None if it didn't exist there."""
    verify = subprocess.run(
        ["git", "rev-parse", "--verify", "--quiet", f"{ref}^{{commit}}"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if verify.returncode != 0:
        raise SystemExit(
            f"error: base ref {ref!r} not found (in CI, check out with fetch-depth: 0)"
        )
    shown = subprocess.run(
        ["git", "show", f"{ref}:{CONTRACT_GIT_PATH}"], cwd=ROOT, capture_output=True, text=True
    )
    return load_yaml(shown.stdout) if shown.returncode == 0 else None


# ── Data dictionary ──────────────────────────────────────────────────────
def _cell(text: str) -> str:
    return " ".join(str(text).split()).replace("|", "\\|")


def _constraint(col: dict[str, Any]) -> str:
    if "allowed_values" in col:
        return ", ".join(f"`{v}`" for v in col["allowed_values"])
    if "pattern" in col:
        return f"pattern `{col['pattern']}`"
    return ""


def render_dictionary(contract: dict[str, Any]) -> str:
    out: list[str] = [
        "<!-- GENERATED by scripts/contract_check.py from contract/schema_contract.yml."
        " DO NOT EDIT. -->",
        "<!-- Regenerate: make contract-dictionary -->",
        "",
        "# Data dictionary",
        "",
        f"Schema contract version **{contract['contract_version']}**. "
        f"{len(contract['tables'])} canonical staging tables.",
        "",
        "## Conventions",
        "",
        *[f"- {c}" for c in contract["conventions"]],
        "",
        "## Tables",
        "",
    ]
    by_source: dict[str, list[dict[str, Any]]] = {}
    for table in contract["tables"]:
        by_source.setdefault(table["source"], []).append(table)
    for source, tables in by_source.items():
        out.append(
            f"- **{SOURCE_TITLES.get(source, source)}:** "
            + ", ".join(f"[`{t['name']}`](#{t['name']})" for t in tables)
        )
    out.append("")

    for source, tables in by_source.items():
        out += [f"## {SOURCE_TITLES.get(source, source)}", ""]
        for table in tables:
            out += [f"### {table['name']}", "", _cell(table["description"]), ""]
            out.append(f"- **Grain:** {_cell(table['grain'])}")
            out.append("- **Primary key:** " + ", ".join(f"`{k}`" for k in table["primary_key"]))
            if table.get("optional"):
                out.append(
                    "- **Optional:** a source that can't provide this table"
                    " emits it typed and empty."
                )
            out += [
                "",
                "| Column | Type | Nullable | Allowed values | Description |",
                "| --- | --- | --- | --- | --- |",
            ]
            for col in table["columns"]:
                out.append(
                    f"| `{col['name']}` | {col['type']} | {'yes' if col['nullable'] else 'no'} "
                    f"| {_cell(_constraint(col))} | {_cell(col['description'])} |"
                )
            fks = table.get("foreign_keys", [])
            if fks:
                out += ["", "**Foreign keys**", ""]
                for fk in fks:
                    ref = fk["references"]
                    out.append(
                        f"- `{', '.join(fk['columns'])}` → [`{ref['table']}`](#{ref['table']})"
                        f".`{', '.join(ref['columns'])}`"
                    )
            out.append("")
    return "\n".join(out).rstrip() + "\n"


# ── CLI ──────────────────────────────────────────────────────────────────
def run_check(base_ref: str | None) -> list[str]:
    contract = load_yaml(CONTRACT_PATH.read_text(encoding="utf-8"))
    errors = validate(contract, load_schema())
    if errors:
        return errors  # later checks assume a valid contract
    if not DICTIONARY_PATH.exists() or DICTIONARY_PATH.read_text(
        encoding="utf-8"
    ) != render_dictionary(contract):
        errors.append(
            "dictionary: contract/data_dictionary.md is stale; run `make contract-dictionary`"
        )
    changelog = CHANGELOG_PATH.read_text(encoding="utf-8") if CHANGELOG_PATH.exists() else ""
    errors += changelog_errors(contract["contract_version"], changelog)
    if base_ref:
        errors += version_bump_errors(contract, contract_at_ref(base_ref))
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="command", required=True)
    check = sub.add_parser("check", help="validate the contract, dictionary, changelog and version")
    check.add_argument("--base-ref", help="git ref to compare against for the version-bump rule")
    sub.add_parser("render", help="regenerate contract/data_dictionary.md")
    args = parser.parse_args(argv)

    if args.command == "render":
        contract = load_yaml(CONTRACT_PATH.read_text(encoding="utf-8"))
        errors = validate(contract, load_schema())
        if errors:
            print("\n".join(errors), file=sys.stderr)
            return 1
        DICTIONARY_PATH.write_text(render_dictionary(contract), encoding="utf-8")
        print(f"wrote {DICTIONARY_PATH.relative_to(ROOT)}")
        return 0

    errors = run_check(args.base_ref)
    if errors:
        print(f"contract-check FAILED ({len(errors)}):", file=sys.stderr)
        print("\n".join(f"  - {e}" for e in errors), file=sys.stderr)
        return 1
    print("contract-check passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())

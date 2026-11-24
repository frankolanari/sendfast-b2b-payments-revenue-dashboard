"""Load raw tables into the local synthetic data Postgres (the "upstream pipelines")."""

from __future__ import annotations

import io
import os

import psycopg2

from .raw import RawTable

RAW_SCHEMAS = ("crm_hubspot", "billing", "ledger", "rates")


def connect():
    """Connection from env only (cloud-ready rule 1). Never anything but the synthetic DB (D12)."""
    return psycopg2.connect(
        host=os.environ.get("DATA_DB_HOST", "localhost"),
        port=int(os.environ.get("DATA_DB_HOST_PORT", "55432")),
        dbname=os.environ.get("DATA_DB_NAME", "sendfast"),
        user=os.environ["DATA_DB_ADMIN_USER"],
        password=os.environ["DATA_DB_ADMIN_PASSWORD"],
        sslmode=os.environ.get("DATA_DB_SSLMODE", "disable"),
    )


def load(tables: list[RawTable]) -> dict[str, int]:
    """Replace the raw schemas in one transaction. Returns row counts per table."""
    counts: dict[str, int] = {}
    with connect() as conn, conn.cursor() as cur:
        for schema in sorted({t.schema for t in tables}):
            if schema not in RAW_SCHEMAS:
                raise ValueError(f"refusing to write schema {schema!r}")
            cur.execute(f'drop schema if exists "{schema}" cascade')
            cur.execute(f'create schema "{schema}"')
        for t in tables:
            cols = ", ".join(f'"{c}" {typ}' for c, typ in t.columns)
            cur.execute(f'create table "{t.schema}"."{t.name}" ({cols})')
            cur.copy_expert(
                f'copy "{t.schema}"."{t.name}" from stdin with (format csv, null \'\')',
                io.StringIO(t.csv()),
            )
            cur.execute(f'select count(*) from "{t.schema}"."{t.name}"')
            counts[t.qualified] = cur.fetchone()[0]
            if counts[t.qualified] != len(t.frame):
                raise RuntimeError(
                    f"{t.qualified}: loaded {counts[t.qualified]} of {len(t.frame)} rows"
                )
    return counts

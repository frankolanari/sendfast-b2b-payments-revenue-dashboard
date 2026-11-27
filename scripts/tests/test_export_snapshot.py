"""The snapshot's presets must match what the front end offers."""

from __future__ import annotations

import re

import card_content as mc
import export_snapshot as snap


def test_periods_match_the_front_end():
    ts = (mc.ROOT / "web" / "src" / "state" / "filters.ts").read_text(encoding="utf-8")
    block = ts[ts.index("export const PERIODS") : ts.index("as const;")]
    pairs = re.findall(
        r"(\w+): \{\s*label: \"[^\"]+\",\s*from: (\"[\d-]+\"|null),\s*to: (\"[\d-]+\"|null)", block
    )
    web = {
        k: (None if a == "null" else a.strip('"'), None if b == "null" else b.strip('"'))
        for k, a, b in pairs
    }
    assert web == snap.PERIODS


def test_presets_are_period_by_at_most_one_filter():
    values = {"segment": ["smb", "enterprise"], "lead_source": [], "owner_id": [], "corridor": []}
    out = snap.presets(["date_from", "date_to", "segment"], values)
    assert len(out) == 4 * 3
    assert {"date_from": "2025-11-01", "date_to": "2026-10-31", "segment": "smb"} in out
    assert {} in out  # "All time" sends no dates
    assert all(len([k for k in p if k == "segment"]) <= 1 for p in out)


def test_cards_without_dates_are_not_repeated_per_period():
    values = {"segment": ["smb"], "lead_source": [], "owner_id": [], "corridor": []}
    assert len(snap.presets(["segment"], values)) == 2


def test_key_is_order_independent():
    assert snap.key({"b": "2", "a": "1"}) == snap.key({"a": "1", "b": "2"}) == '{"a":"1","b":"2"}'

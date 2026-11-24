"""CLI: uv run python -m sendfast_gen {generate,hash,answer-key,stories,charts} [--scale S]"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[3]
CONFIG = ROOT / "generator" / "config.yml"
ANSWER_KEYS = ROOT / "generator" / "answer_keys"


def load_config(scale: float | None = None) -> dict[str, Any]:
    cfg = yaml.safe_load(CONFIG.read_text(encoding="utf-8"))
    if scale is not None:
        cfg["scale"] = scale
    return cfg


def answer_key_path(scale: float) -> Path:
    return ANSWER_KEYS / f"scale_{scale:g}.json"


def main(argv: list[str] | None = None) -> int:
    from .raw import build_raw, digest
    from .world import build_world

    parser = argparse.ArgumentParser(prog="sendfast_gen")
    parser.add_argument(
        "command",
        choices=["generate", "hash", "answer-key", "check-answer-key", "stories", "charts"],
    )
    parser.add_argument("--scale", type=float, default=None)
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument(
        "--max-seconds", type=float, default=None, help="fail if generate+load takes longer"
    )
    args = parser.parse_args(argv)

    cfg = load_config(args.scale)
    scale = float(cfg["scale"])
    t0 = time.perf_counter()
    world = build_world(cfg)

    if args.command in ("answer-key", "check-answer-key"):
        from .answer_key import compute, dumps

        text = dumps(compute(world))
        path = answer_key_path(scale)
        if args.command == "answer-key":
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
            print(f"wrote {path.relative_to(ROOT)}")
            return 0
        if not path.exists() or path.read_text(encoding="utf-8") != text:
            print(
                f"answer key {path.relative_to(ROOT)} is stale; run: make answer-keys",
                file=sys.stderr,
            )
            return 1
        print(f"answer key {path.relative_to(ROOT)} is up to date")
        return 0

    tables = build_raw(world)
    if args.command == "hash":
        print(digest(tables))
        return 0
    if args.command == "stories":
        from .stories import detect_all

        results = detect_all(tables, cfg)
        print(json.dumps(results, indent=2, default=str))
        return 0 if all(r["detected"] for r in results.values()) else 1
    if args.command == "charts":
        from .charts import render

        out = args.out or ROOT / "docs" / "evidence" / "gate-3"
        for p in render(tables, world, out):
            print(f"wrote {p.relative_to(ROOT)}")
        return 0

    from .db import load

    built = time.perf_counter() - t0
    counts = load(tables)
    total = time.perf_counter() - t0
    for name, n in counts.items():
        print(f"  {name:<36} {n:>9,}")
    print(
        f"generated scale {scale:g} in {built:.1f}s, loaded in {total - built:.1f}s (total "
        f"{total:.1f}s)"
    )
    print(f"sha256 {digest(tables)}")
    if args.max_seconds is not None and total > args.max_seconds:
        print(f"too slow: {total:.1f}s > {args.max_seconds:g}s", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

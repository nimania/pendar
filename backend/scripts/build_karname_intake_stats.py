#!/usr/bin/env python3
"""Publish only aggregate, auditable Karname intake counts to the public UI.

This does not publish candidate excerpts, personal attributions, or evaluations.
The canonical public predictions ledger is unaffected.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
QUEUE = ROOT / "backend/data/karname-candidates.json"
OUTPUT = ROOT / "web-static/karname/intake-stats.json"


def aggregate(queue: dict) -> dict:
    if not isinstance(queue, dict) or not isinstance(queue.get("candidates"), list):
        raise ValueError("Malformed candidate queue; no public stats will be generated")
    candidates = queue["candidates"]
    if any(not isinstance(c, dict) or not c.get("id") for c in candidates):
        raise ValueError("Malformed candidate id")
    if len({c["id"] for c in candidates}) != len(candidates):
        raise ValueError("Duplicate candidate ids")
    pending = sum(c.get("status") == "pending_editorial_review" for c in candidates)
    screened = sum(c.get("status") == "screened_out_by_current_filter" for c in candidates)
    reviewed = len(candidates) - pending - screened
    manual = sum(c.get("status") == "pending_editorial_review"
                 and c.get("manual_review_required") is True for c in candidates)
    reported = queue.get("stats") or {}
    if not isinstance(reported, dict):
        raise ValueError("Invalid queue statistics")
    for key, expected in (("total", len(candidates)), ("pending", pending),
                          ("screened", screened), ("reviewed", reviewed)):
        if reported.get(key) != expected:
            raise ValueError(f"Queue stats mismatch ({key}); refusing to publish")
    def count(key: str) -> int:
        value = reported.get(key, 0)
        if not isinstance(value, int) or isinstance(value, bool) or value < 0:
            raise ValueError("Noninteger/nonpositive source coverage: " + key)
        return value
    return {
        "schema_version": 1,
        "scope": "public_aggregate_only",
        "is_editorially_approved": False,
        "counts": {
            "extracted_candidates": len(candidates),
            "pending_review": pending,
            "screened_out": screened,
            "previously_reviewed": reviewed,
            "manual_review_requested": manual,
        },
        "coverage": {
            "figure_profiles_scanned": count("figure_profiles_scanned"),
            "figure_posts_scanned": count("figure_posts_scanned"),
            "source_spans_scanned": count("source_spans_scanned"),
            "figure_feed_available": queue.get("figure_snapshot_available") is True,
        },
        "review_queue_url": "https://github.com/nimania/pendar/blob/main/backend/data/karname-candidates.json",
        "workflow_url": "https://github.com/nimania/pendar/actions/workflows/karname-intake.yml",
        "explanation_fa": "نامزدهای استخراج‌شده تا تأیید منبع و انتساب به کارنامهٔ عمومی افزوده نمی‌شوند.",
    }


def build(source: Path = QUEUE, output: Path = OUTPUT, *, check=False) -> dict:
    queue = json.loads(Path(source).read_text(encoding="utf-8"))
    report = aggregate(queue)
    body = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if check:
        if not output.is_file() or output.read_text(encoding="utf-8") != body:
            raise ValueError("Public aggregate is stale")
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        temp = output.with_suffix(".json.tmp")
        temp.write_text(body, encoding="utf-8")
        temp.replace(output)
    print(f"Karname public intake aggregate: {report['counts']['extracted_candidates']} found, "
          f"{report['counts']['pending_review']} pending, "
          f"{report['counts']['screened_out']} screened")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=QUEUE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        build(args.source, args.output, check=args.check)
    except (ValueError, OSError) as exc:
        print("Refusing invalid Karname intake aggregate:", exc, file=sys.stderr)
        sys.exit(1)

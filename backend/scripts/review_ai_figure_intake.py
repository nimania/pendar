#!/usr/bin/env python3
"""Safely prepare reviewed AI figure posts. No automatic publication."""
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
FIGURES = ROOT / "web-static/data/pendar-editorial-views.json"

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--intake", required=True, type=Path)
    p.add_argument("--decisions", required=True, type=Path)
    p.add_argument("--output", type=Path, default=Path("ai-figure-approved-preview.json"))
    p.add_argument("--apply", action="store_true", help="Write curated file, only after explicit editorial approvals")
    args = p.parse_args()
    intake = json.loads(args.intake.read_text(encoding="utf-8"))
    decisions = json.loads(args.decisions.read_text(encoding="utf-8"))
    entries = json.loads(FIGURES.read_text(encoding="utf-8"))
    candidates = {str(x["id"]): x for x in intake.get("pending", [])}
    people = {x["profile"]["handle"]: x for x in entries}
    prepared, skipped = [], []
    existing = {(e["profile"]["handle"], p.get("url")) for e in entries for p in e.get("posts", [])}
    ids = {p.get("id") for e in entries for p in e.get("posts", [])}
    for decision in decisions.get("decisions", []):
        if decision.get("status") != "approved":
            continue
        key = str(decision.get("id", ""))
        source = candidates.get(key)
        if not source or source.get("figure") not in people:
            skipped.append({"id": key, "reason": "missing intake or identity"})
            continue
        summary = str(decision.get("summary_fa", "")).strip()
        topic = str(decision.get("topic_fa", "")).strip()
        reviewer = str(decision.get("reviewer", "")).strip()
        source_verified = decision.get("source_verified") is True
        date_verified = decision.get("date_verified") is True
        url = str(source.get("url", ""))
        parts = urlsplit(url)
        if not (reviewer and source_verified and len(summary) >= 80 and topic and parts.scheme == "https"
                and parts.netloc == "t.me"
                and re.fullmatch(r"/[A-Za-z0-9_]+/[0-9]+", parts.path)):
            skipped.append({"id": key, "reason": "insufficient review, summary, or direct permalink"})
            continue
        handle = source["figure"]
        pid = "reviewed-ai-" + key
        if (handle, url) in existing or pid in ids:
            skipped.append({"id": key, "reason": "already curated"})
            continue
        post = {
            "id": pid, "handle": handle, "name_fa": people[handle]["profile"]["name_fa"],
            "kind": "analysis", "platform": "telegram",
            "topic_fa": topic, "summary_fa": summary,
            "source_name": source.get("source", "تلگرام"),
            "source_note_fa": "خلاصهٔ تحریریه پس از بررسی منبع؛ نقل‌قول مستقیم نیست.",
            "published_at": source.get("published_at") if date_verified else None,
            "url": url, "editorial": False,
            "source_review_status": "verified_exact_source",
            "date_review_status": "verified" if date_verified and source.get("published_at") else "date_not_verified",
            "content_type": "sourced_summary", "reviewed_by": reviewer,
            "ai_relevance": source.get("ai_relevance", "unclassified"),
        }
        prepared.append(post)
        existing.add((handle, url))
        ids.add(pid)
    args.output.write_text(json.dumps({"ready": prepared, "skipped": skipped}, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    if args.apply and prepared:
        for post in prepared:
            people[post["handle"]].setdefault("posts", []).append(post)
        FIGURES.write_text(json.dumps(entries, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(f"Ready: {len(prepared)}; skipped: {len(skipped)}; apply: {args.apply}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

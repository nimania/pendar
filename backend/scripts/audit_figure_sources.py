#!/usr/bin/env python3
"""Audit manually curated figure sources without inventing publication dates."""
import json
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "web-static/data/pendar-editorial-views.json"
REPORT = ROOT / "web-static/data/figure-source-audit.json"

def main():
    entries = json.loads(DATA.read_text(encoding="utf-8"))
    rows = []
    for entry in entries:
        profile = entry.get("profile", {})
        for post in entry.get("posts", []):
            url = str(post.get("url") or "").strip()
            parsed = urlsplit(url)
            valid = parsed.scheme in ("https", "http") and bool(parsed.netloc)
            status = post.get("source_review_status", "not_reviewed")
            date_status = post.get("date_review_status", "not_reviewed")
            rows.append({
                "figure": profile.get("handle"),
                "id": post.get("id"),
                "valid_link_format": valid,
                "source_review_status": status,
                "date_review_status": date_status,
                "needs_review": not valid or status != "verified_exact_source"
                                  or date_status != "verified",
            })
    report = {
        "total": len(rows),
        "needs_review": sum(r["needs_review"] for r in rows),
        "source_status_counts": dict(Counter(r["source_review_status"] for r in rows)),
        "records": rows,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Figure sources: {report['total']} records; {report['needs_review']} require review.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

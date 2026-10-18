#!/usr/bin/env python3
"""Audit built Pendar editorial data without changing publication state.

Usage: python backend/scripts/audit_editorial_archive.py --site site
Exit 1 for broken archive data/contracts; exit 2 for missing target coverage.
"""
import argparse
import json
import re
from collections import Counter
from pathlib import Path

UUID = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$", re.I)


def audit(site: Path, minimum: int) -> dict:
    errors, warnings = [], []
    def read(name):
        path = site / "data" / name
        if not path.is_file():
            errors.append(f"Missing required data/{name}")
            return None
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            errors.append(f"Invalid data/{name}: {exc}")
            return None

    directory = read("pendar-editorial-authors.json")
    archive = read("editorial-archive.json")
    authors = directory.get("authors") if isinstance(directory, dict) else None
    reports = archive.get("reports") if isinstance(archive, dict) else None
    if not isinstance(authors, list) or len(authors) != 7:
        errors.append("Author directory must contain exactly seven authors")
        authors = []
    if not isinstance(reports, list):
        errors.append("Editorial archive must have reports array (no silent fallback)")
        reports = []
    ids = [str(a.get("id", "")) for a in authors if isinstance(a, dict)]
    if len(set(ids)) != len(ids) or not all(ids):
        errors.append("Invalid or duplicate author IDs")
    counts = Counter({k: 0 for k in ids})
    seen = set()
    for i, report in enumerate(reports):
        if not isinstance(report, dict):
            errors.append(f"reports[{i}] is not an object")
            continue
        uid = str(report.get("id") or "")
        author = report.get("author_id")
        if not UUID.fullmatch(uid):
            errors.append(f"reports[{i}] has invalid story UUID")
        if uid in seen:
            errors.append(f"Duplicate story UUID: {uid}")
        seen.add(uid)
        if author not in counts:
            errors.append(f"reports[{i}] has unknown author: {author}")
            continue
        if report.get("status") != "ai_draft":
            errors.append(f"reports[{i}] has unexpected status: {report.get('status')}")
            continue
        if not str(report.get("title_fa") or report.get("headline_fa") or "").strip():
            errors.append(f"reports[{i}] lacks a title")
        counts[author] += 1
    short = {author: max(0, minimum - n) for author, n in counts.items() if n < minimum}
    if short:
        warnings.append(f"Below target {minimum} per author: {short}")
    return {
        "ok": not errors and not short,
        "structural_ok": not errors,
        "total_reports": len(reports),
        "author_counts": dict(counts),
        "target_per_author": minimum,
        "shortfalls": short,
        "errors": errors,
        "warnings": warnings,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--minimum", type=int, default=10)
    args = parser.parse_args()
    result = audit(args.site, args.minimum)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if not result["structural_ok"] else (2 if result["shortfalls"] else 0)


if __name__ == "__main__":
    raise SystemExit(main())

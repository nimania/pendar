#!/usr/bin/env python3
"""Recover a verified press directory from the already-published Pendar site.

Only runs when the new build has no healthy directory and no retained verified
artifact could restore one. Never invents publishers or changes integrity limits.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen

LIVE_URL = "https://pendar.io/data/press-directory.json"
MIN_SOURCES = 20
MAX_BYTES = 3_000_000


def validate(rows):
    if not isinstance(rows, list) or len(rows) < MIN_SOURCES:
        return False
    names = set()
    for row in rows:
        if not isinstance(row, dict):
            return False
        name = row.get("source_name")
        count = row.get("count")
        if not isinstance(name, str) or not name.strip() or name in names:
            return False
        if type(count) is not int or count < 0:
            return False
        stamp = row.get("latest_at")
        if stamp is not None and not isinstance(stamp, str):
            return False
        names.add(name)
    return True


def restore(site: Path, *, fetch=None):
    target = site / "data" / "press-directory.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        current = json.loads(target.read_text(encoding="utf-8"))
        if validate(current):
            print(f"Current press directory is valid ({len(current)} real publisher rows); no recovery needed.")
            return len(current)
    except (OSError, ValueError):
        pass

    # Download the public data readers are actually using, not a synthetic
    # replacement based on registered publishers.
    if fetch is None:
        def fetch():
            request = Request(LIVE_URL, headers={"User-Agent": "Pendar-Integrity-Recovery/1.0"})
            with urlopen(request, timeout=20) as response:
                return response.read(MAX_BYTES + 1)
    try:
        raw = fetch()
        if not isinstance(raw, bytes) or len(raw) > MAX_BYTES:
            raise ValueError("invalid download size")
        rows = json.loads(raw.decode("utf-8"))
        if not validate(rows):
            raise ValueError("live directory lacks 20 unique publisher rows with valid counts")
    except (OSError, ValueError, UnicodeError) as exc:
        print(f"::warning::Could not restore a verified live press directory: {exc}")
        return 0

    # Write only after complete validation; never replace the output with
    # partial or invented records.
    target.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    js = site / "data" / "press-directory.js"
    js.write_text("window.__PRESS_DIRECTORY__=" + json.dumps(rows, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c") + ";\n", encoding="utf-8")
    print(f"Recovered {len(rows)} published publisher records from {LIVE_URL}")
    return len(rows)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    args = parser.parse_args()
    restore(args.site)

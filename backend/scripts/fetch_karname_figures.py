#!/usr/bin/env python3
"""Fetch Pendar's already-published figure & news-statement index for editorial intake.

No crawler: exactly one request to the user's own canonical public data endpoint.
Never writes the site's data or the approved prediction ledger.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from urllib.request import Request, urlopen

SOURCE = "https://pendar.io/data/figures.json"
MAX_BYTES = 26_000_000


def fetch_figures(destination: Path, *, opener=urlopen) -> dict:
    request = Request(SOURCE, headers={
        "User-Agent": "Pendar-Karname-Source-Index/1.0",
        "Accept": "application/json",
        "Cache-Control": "no-cache",
    })
    with opener(request, timeout=35) as response:
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("Pendar figures feed unexpectedly exceeds size limit")
    data = json.loads(raw.decode("utf-8"))
    figures = data.get("figures") if isinstance(data, dict) else None
    if not isinstance(figures, list) or len(figures) < 100:
        raise ValueError("Pendar figure index missing or incomplete (<100 figures)")
    handles = [p.get("handle") for p in figures if isinstance(p, dict)]
    if len(handles) != len(figures) or len(set(handles)) != len(handles) or any(not h for h in handles):
        raise ValueError("Pendar figure index has missing or duplicated identities")
    posts = sum(len(x.get("posts") or []) for x in figures)
    destination.parent.mkdir(parents=True, exist_ok=True)
    tmp = destination.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":"))+"\n", encoding="utf-8")
    tmp.replace(destination)
    return {"figure_profiles": len(figures), "recent_posts": posts, "source": SOURCE}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    try:
        print("Pendar figure index:", json.dumps(fetch_figures(args.output), ensure_ascii=False))
    except (ValueError, OSError, UnicodeError, TimeoutError) as exc:
        print("Source unavailable; other feeds remain eligible:", exc, file=sys.stderr)
        sys.exit(2)

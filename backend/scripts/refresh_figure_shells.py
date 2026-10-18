#!/usr/bin/env python3
"""Refresh cached figure-route HTML without discarding prerendered identity SEO."""
from __future__ import annotations

import json
from pathlib import Path
import re
import argparse

from refresh_story_shells import refresh_shell

HANDLE = re.compile(r"^[a-zA-Z0-9_.-]{2,100}$")


def run(site: Path) -> tuple[int, int]:
    shell = (site / "index.html").read_text(encoding="utf-8")
    if "heritage-figures.css?v=" not in shell:
        raise RuntimeError("The new figure magazine stylesheet is missing")
    paths = [site / "figures" / "index.html", site / "figures" / "directory" / "index.html"]
    for folder in ("figure", "statement"):
        paths.extend((site / folder).glob("*/index.html"))
    figures_path = site / "data" / "figures.json"
    if not figures_path.exists():
        figures_path = site / "figures.json"
    figures = json.loads(figures_path.read_text(encoding="utf-8"))
    handles = {
        str(person.get("handle") or "").lower()
        for person in figures.get("figures", [])
        if HANDLE.fullmatch(str(person.get("handle") or ""))
    }
    # Do not touch @press, @tv or @movie identities. Existing person handles
    # keep their canonical paths and prerendered structured metadata.
    paths += [
        path for path in site.glob("@*/index.html")
        if path.parent.name[1:].lower() in handles
    ]
    changed = protected = 0
    for page in paths:
        if not page.exists() and page.parent.name not in {"figures", "directory"}:
            continue
        old = page.read_text(encoding="utf-8") if page.is_file() else shell
        refreshed = refresh_shell(shell, old)
        if "heritage-figures.css?v=" not in refreshed:
            raise RuntimeError("Figure stylesheet missing after refresh: " + str(page))
        if 'id="seo-static"' in old and 'id="seo-static"' not in refreshed:
            raise RuntimeError("Prerendered SEO body was lost: " + str(page))
        if 'id="seo-schema"' in old and 'id="seo-schema"' not in refreshed:
            raise RuntimeError("Figure schema lost: " + str(page))
        if 'id="seo-static"' in old:
            protected += 1
        if refreshed != old:
            page.parent.mkdir(parents=True, exist_ok=True)
            page.write_text(refreshed, encoding="utf-8")
            changed += 1
    return changed, protected


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, default=Path("site"))
    args = parser.parse_args()
    count, kept = run(args.site)
    print(f"Updated {count} figure directory/profile entries; kept {kept} prerendered identity pages.")

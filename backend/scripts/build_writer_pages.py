#!/usr/bin/env python3
"""Build memorable, direct-loadable writer pages without breaking older URLs."""
from __future__ import annotations
import argparse
import html
import json
from pathlib import Path
import re

from refresh_story_shells import compact_story_shell

SAFE_SLUG = re.compile(r"^[a-z][a-z0-9-]{2,75}$")

def generate(site: Path) -> int:
    roster = json.loads((site / "data" / "pendar-editorial-authors.json").read_text(encoding="utf-8"))
    template = compact_story_shell((site / "index.html").read_text(encoding="utf-8"))
    count = 0
    for author in roster["authors"]:
        writer_id = str(author["id"])
        slug = str(author.get("writer_slug") or "")
        if not SAFE_SLUG.fullmatch(slug):
            raise RuntimeError("Unsafe writer slug: " + repr(slug))
        title = html.escape(str(author["display_name_fa"]), quote=True) + " | تحریریه پندار"
        description = html.escape(str(author.get("bio_fa", "")).strip()[:160], quote=True)
        canonical = "https://pendar.io/writers/" + slug + "/"
        result = re.sub(r"<title[^>]*>[\s\S]*?</title>",
                        lambda _: "<title>" + title + "</title>", template, count=1)
        result = re.sub(r'<meta name="description"[^>]*>',
                        lambda _: '<meta name="description" content="' + description + '">', result, count=1)
        result = re.sub(r'<link rel="canonical"[^>]*>', "", result, count=1)
        result = result.replace("</head>", '<link rel="canonical" href="' + canonical + '"></head>', 1)
        target = site / "writers" / slug / "index.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(result, encoding="utf-8")
        count += 1
    return count

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, default=Path("site"))
    args = parser.parse_args()
    print("Writer pages generated:", generate(args.site))

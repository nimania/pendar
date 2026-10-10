"""Temporary news-and-figures-only GitHub Pages publishing profile.

Operates solely on generated deployment directory. Never touches source archives.
Run AFTER SEO generation/validation and BEFORE Pages upload.
"""
from __future__ import annotations
import shutil
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
assert (root / "index.html").is_file(), "Refusing to trim a non-site folder"
# Keep the SPA shell and all root-level JS/CSS; pages for news and people only.
keep_dirs = {
    "assets", "data", "story", "stories", "figure", "figures",
    "person", "people", "news", "search", "topic", "topics",
}
# Root-level data consumed by news feeds, archive, entity/figure views and search.
keep_data_names = {
    "stories.json", "stats.json", "meta.json", "figures.json",
    "news-people.json", "people-index.json",
    "entity-registry.json", "entity-qa.json",
    "search-index.json", "search.json", "news-health.json",
    "trends.json", "clusters.json", "sources.json",
    "news-index.json", "latest.json", "topics.json",
}
keep_data_prefixes = (
    "figure", "news-", "curated-", "source-", "story-", "search-",
    "quote-", "person-", "people-", "headline-", "topic-",
)
# Keep the data files required by the core UI without giant per-person shards.
data = root / "data"
removed = 0
for item in list(root.iterdir()):
    if item.is_dir() and item.name not in keep_dirs:
        shutil.rmtree(item)
        removed += 1
if data.is_dir():
    for item in list(data.iterdir()):
        if item.is_dir():
            # Hefty generated data/people/* pages are redundant with people-index.
            # UI retrieves entity/figure information from preserved root-level datasets.
            shutil.rmtree(item)
            removed += 1
        elif item.is_file():
            if item.name not in keep_data_names and not item.name.startswith(keep_data_prefixes):
                item.unlink()
                removed += 1
print(f"News + figures public profile: excluded {removed} optional items.")
for required in ("data/stories.json", "data/figures.json", "data/people-index.json"):
    if not (root / required).is_file():
        raise SystemExit(f"::error::Missing required news/figure dataset {required}")

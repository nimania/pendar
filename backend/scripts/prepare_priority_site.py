"""Lightweight GitHub Pages profile preserving the core UI data contracts.

Operates solely on generated deployment directory. Never touches source archives.
Run AFTER SEO generation/validation and BEFORE Pages upload.
"""
from __future__ import annotations
import shutil
import sys
import gzip
from pathlib import Path

# Keep the SPA shell and all root-level JS/CSS; pages for news and people only.
keep_dirs = {
    "assets", "data", "story", "stories", "figure", "figures",
    "person", "people", "news", "search", "topic", "topics", "event", "books", "movies", "tv", "press", "future",
    "market", "weather", "system", "diner", "icons",
    "entity", "movie", "book", "publisher", "book-person", "cinema-person",
    "studio", "recaps", "videos", "radar", "reports", "iransignal", "badbadak", "naval",
    "trends", "editorial-author",
}
# Root-level data consumed by news feeds, archive, entity/figure views and search.
keep_data_names = {
    "stories.json", "stats.json", "meta.json", "figures.json",
    "news-people.json", "people-index.json",
    "entity-registry.json", "entity-qa.json",
    "search-index.json", "search.json", "news-health.json",
    "trends.json", "clusters.json", "sources.json",
    "news-index.json", "latest.json", "topics.json",
    "system-health.json", "weather.json", "market-nabzesh.json", "market.json",
    "periodicals.json", "press-directory.json", "press-stats.json",
    # Restore already-cached book, cinema and TV datasets; no collection or rebuild.
    "books.json", "movies.json", "streaming.json", "movie-ratings.json",
    "movie-master-summary.json", "movie-master-top.json", "tv-guide.json",
    "pendar-watch-schedule.json", "entities.json", "factchecks.json", "geo.json",
    "books.js", "movies.js", "press-directory.js", "studio-recaps.json",
    "youtube-videos.json", "prices.json", "crypto.json", "candidate-feeds.json",
    "project-finance.json",
    "editorial-archive.json", "google-trends-iran.json",
    # Immutable five-hour news/opinion report archive must survive light deploys.
    "voice-recaps.json",
}
keep_data_prefixes = (
    "figure", "news-", "curated-", "source-", "story-", "search-",
    "quote-", "person-", "people-", "headline-", "topic-",
    "pendar-", "future-", "press-", "book-", "us-radar",
    "iran-scenario-",
)
# Partitioned person records are used by canonicalEntityById and name lookup.
# The index alone cannot render their profiles. Movie details are also fetched.
keep_data_dirs = {"story", "people", "person-aliases", "movie-details", "us-radar-history"}
required_data = ("stories.json", "figures.json", "people-index.json",
                 "books.json", "movies.json", "tv-guide.json",
                 "press-directory.json", "entity-registry.json", "entity-qa.json")


def keep_data_file(name):
    return name in keep_data_names or name.startswith(keep_data_prefixes)


def prepare(root):
    root = Path(root).resolve()
    assert (root / "index.html").is_file(), "Refusing to trim a non-site folder"
    data = root / "data"
    # Fail before modifying the payload. system-health is produced by the
    # integrity gate AFTER trimming; an old report is not a prerequisite.
    for name in required_data:
        if not (data / name).is_file():
            raise SystemExit(f"::error::Missing required core dataset data/{name}")
    removed = 0
    for item in list(root.iterdir()):
        if item.is_dir() and item.name not in keep_dirs and not item.name.startswith("@"):
            shutil.rmtree(item)
            removed += 1
    for item in list(data.iterdir()):
        if item.is_dir() and item.name not in keep_data_dirs:
            shutil.rmtree(item)
            removed += 1
        elif item.is_file() and not keep_data_file(item.name):
            item.unlink()
            removed += 1
    before = after = 0
    for folder in ("people", "person-aliases"):
        for source in (data / folder).glob("*.json"):
            destination = source.with_suffix(".json.gz")
            temporary = destination.with_suffix(".gz.tmp")
            before += source.stat().st_size
            with source.open("rb") as src, temporary.open("wb") as out:
                with gzip.GzipFile(filename="", fileobj=out, mode="wb", mtime=0) as dst:
                    shutil.copyfileobj(src, dst)
            temporary.replace(destination)
            after += destination.stat().st_size
            source.unlink()
    print(f"Lossless person partitions: {before:,} -> {after:,} bytes.")
    # Never delete a required catalog merely because it exceeds 5 MB. The
    # separate overall size gate blocks oversized uploads without data loss.
    print(f"Core public profile: excluded {removed} optional items.")
    try:
        from .publish_pishkhan_redirects import migrate
    except ImportError:
        from publish_pishkhan_redirects import migrate
    migrate(root)


if __name__ == "__main__":
    prepare(sys.argv[1])

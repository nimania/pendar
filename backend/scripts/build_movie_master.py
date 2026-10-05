#!/usr/bin/env python3
"""Build Pendar Movie Master Catalog from TMDB official daily ID exports.

This is the bootstrap layer, not full TMDB metadata hydration.
It stores every valid non-adult Movie/TV ID in SQLite and preserves enrichment
columns across daily refreshes. The public site receives only a compact summary
and a popularity-sorted lightweight index.

Official source:
https://files.tmdb.org/p/exports/movie_ids_MM_DD_YYYY.json.gz
https://files.tmdb.org/p/exports/tv_series_ids_MM_DD_YYYY.json.gz
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import json
import os
import re
import sqlite3
import tempfile
import urllib.error
import urllib.request
from pathlib import Path
from typing import Iterable

BASE = "https://files.tmdb.org/p/exports"
UA = "Pendar-MovieMaster/1.0 (+https://nimania.github.io/pendar/)"
TMDB_URL_RE = re.compile(r"themoviedb\.org/(movie|tv)/(\d+)", re.I)

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS titles (
    pendar_id TEXT PRIMARY KEY,
    media_type TEXT NOT NULL CHECK(media_type IN ('movie','series')),
    tmdb_id INTEGER NOT NULL,
    original_title TEXT,
    popularity REAL NOT NULL DEFAULT 0,
    adult INTEGER NOT NULL DEFAULT 0,
    video INTEGER NOT NULL DEFAULT 0,
    source_date TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,

    curated INTEGER NOT NULL DEFAULT 0,
    hydrated INTEGER NOT NULL DEFAULT 0,
    hydrated_at TEXT,

    title_fa TEXT,
    title_en TEXT,
    release_date TEXT,
    year INTEGER,
    overview_fa TEXT,
    overview_en TEXT,
    poster_path TEXT,
    backdrop_path TEXT,
    runtime_min INTEGER,
    status TEXT,
    original_language TEXT,
    origin_country_json TEXT,
    genres_json TEXT,
    credits_json TEXT,
    translations_json TEXT,

    imdb_id TEXT,
    wikidata_qid TEXT,
    tmdb_payload_json TEXT,

    UNIQUE(media_type, tmdb_id)
);

CREATE INDEX IF NOT EXISTS idx_titles_type ON titles(media_type);
CREATE INDEX IF NOT EXISTS idx_titles_popularity ON titles(popularity DESC);
CREATE INDEX IF NOT EXISTS idx_titles_active ON titles(active);
CREATE INDEX IF NOT EXISTS idx_titles_hydrated ON titles(hydrated);
CREATE INDEX IF NOT EXISTS idx_titles_imdb ON titles(imdb_id);
CREATE INDEX IF NOT EXISTS idx_titles_wikidata ON titles(wikidata_qid);

CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

def utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def base36(value: int) -> str:
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    n = int(value)
    if n == 0:
        return "0"
    out = []
    while n:
        n, r = divmod(n, 36)
        out.append(chars[r])
    return "".join(reversed(out))

def pendar_id(media_type: str, tmdb_id: int) -> str:
    prefix = "pm" if media_type == "movie" else "pt"
    return f"{prefix}_{base36(tmdb_id)}"

def export_name(media_type: str, date: dt.date) -> str:
    stem = "movie_ids" if media_type == "movie" else "tv_series_ids"
    return f"{stem}_{date:%m_%d_%Y}.json.gz"

def download_export(media_type: str, requested: dt.date, fallback_days: int = 4) -> tuple[Path, dt.date]:
    last_error = None
    for offset in range(fallback_days + 1):
        day = requested - dt.timedelta(days=offset)
        name = export_name(media_type, day)
        url = f"{BASE}/{name}"
        path = Path(tempfile.gettempdir()) / name
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/gzip,*/*"})
        try:
            print("Downloading", url)
            with urllib.request.urlopen(req, timeout=90) as response, path.open("wb") as out:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
            if path.stat().st_size < 128:
                raise RuntimeError("downloaded export is unexpectedly small")
            return path, day
        except Exception as exc:
            last_error = exc
            try:
                path.unlink()
            except OSError:
                pass
            print("Export unavailable:", url, type(exc).__name__, str(exc)[:120])
    raise RuntimeError(f"TMDB export unavailable for {media_type}: {last_error}")

def rows_from_export(path: Path, media_type: str) -> Iterable[dict]:
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except ValueError:
                print("Skipping malformed export line", path.name, line_no)
                continue
            tmdb_id = row.get("id")
            try:
                tmdb_id = int(tmdb_id)
            except Exception:
                continue
            if tmdb_id <= 0:
                continue
            # Adult exports are separate, but keep this defensive filter.
            if bool(row.get("adult")):
                continue
            yield {
                "pendar_id": pendar_id(media_type, tmdb_id),
                "media_type": media_type,
                "tmdb_id": tmdb_id,
                "original_title": (
                    row.get("original_title")
                    if media_type == "movie"
                    else row.get("original_name") or row.get("original_title")
                ),
                "popularity": float(row.get("popularity") or 0),
                "adult": 1 if row.get("adult") else 0,
                "video": 1 if row.get("video") else 0,
            }

def load_curated_tmdb_ids(path: Path | None) -> set[tuple[str, int]]:
    if not path or not path.exists():
        return set()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return set()
    movies = payload.get("movies") if isinstance(payload, dict) else []
    out: set[tuple[str, int]] = set()
    for movie in movies or []:
        typ = "series" if movie.get("type") == "series" else "movie"
        ext = movie.get("external") or {}
        candidates = [ext.get("tmdb")]
        for ref in (movie.get("provider_refs") or {}).values():
            if isinstance(ref, dict):
                candidates.append(ref.get("tmdb_url"))
        for value in candidates:
            m = TMDB_URL_RE.search(str(value or ""))
            if not m:
                continue
            url_type = "series" if m.group(1).lower() == "tv" else "movie"
            try:
                out.add((url_type, int(m.group(2))))
            except Exception:
                pass
    return out

def connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db_path)
    con.executescript(SCHEMA)
    return con

def refresh_type(
    con: sqlite3.Connection,
    media_type: str,
    path: Path,
    source_date: dt.date,
    curated: set[tuple[str, int]],
) -> dict:
    now = utcnow()
    source = source_date.isoformat()
    con.execute("UPDATE titles SET active=0 WHERE media_type=?", (media_type,))
    sql = """
    INSERT INTO titles(
        pendar_id,media_type,tmdb_id,original_title,popularity,adult,video,
        source_date,first_seen_at,last_seen_at,active,curated
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,1,?)
    ON CONFLICT(media_type,tmdb_id) DO UPDATE SET
        original_title=COALESCE(excluded.original_title,titles.original_title),
        popularity=excluded.popularity,
        adult=excluded.adult,
        video=excluded.video,
        source_date=excluded.source_date,
        last_seen_at=excluded.last_seen_at,
        active=1,
        curated=CASE WHEN excluded.curated=1 THEN 1 ELSE titles.curated END
    """
    batch = []
    total = 0
    curated_count = 0
    max_pop = 0.0
    for row in rows_from_export(path, media_type):
        is_curated = 1 if (media_type, row["tmdb_id"]) in curated else 0
        curated_count += is_curated
        max_pop = max(max_pop, row["popularity"])
        batch.append((
            row["pendar_id"], row["media_type"], row["tmdb_id"], row["original_title"],
            row["popularity"], row["adult"], row["video"], source, now, now, is_curated,
        ))
        total += 1
        if len(batch) >= 5000:
            con.executemany(sql, batch)
            batch.clear()
    if batch:
        con.executemany(sql, batch)

    inactive = con.execute(
        "SELECT COUNT(*) FROM titles WHERE media_type=? AND active=0", (media_type,)
    ).fetchone()[0]
    con.commit()
    return {
        "source_date": source,
        "active": total,
        "curated_in_export": curated_count,
        "inactive_after_refresh": inactive,
        "max_popularity": round(max_pop, 3),
    }

def db_stats(con: sqlite3.Connection) -> dict:
    def scalar(sql: str, args=()):
        return con.execute(sql, args).fetchone()[0]

    return {
        "total_active": scalar("SELECT COUNT(*) FROM titles WHERE active=1"),
        "movies": scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND media_type='movie'"),
        "series": scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND media_type='series'"),
        "curated": scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND curated=1"),
        "hydrated": scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND hydrated=1"),
        "with_imdb": scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND imdb_id IS NOT NULL AND imdb_id<>''"),
        "with_wikidata": scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND wikidata_qid IS NOT NULL AND wikidata_qid<>''"),
    }

def write_public_outputs(
    con: sqlite3.Connection,
    summary_path: Path,
    top_path: Path,
    per_type: dict,
    top_limit: int,
) -> None:
    stats = db_stats(con)
    summary = {
        "schema_version": 1,
        "generated_at": utcnow(),
        "source": "TMDB official daily ID exports",
        "scope": "valid non-adult Movie and TV IDs; metadata hydration is a separate layer",
        "stats": stats,
        "sources": per_type,
    }
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )

    rows = con.execute(
        """
        SELECT pendar_id,media_type,tmdb_id,original_title,popularity,curated,hydrated,
               title_fa,title_en,year,imdb_id,wikidata_qid,poster_path
        FROM titles
        WHERE active=1
        ORDER BY popularity DESC, tmdb_id ASC
        LIMIT ?
        """,
        (top_limit,),
    ).fetchall()
    keys = [
        "pendar_id","media_type","tmdb_id","original_title","popularity","curated","hydrated",
        "title_fa","title_en","year","imdb_id","wikidata_qid","poster_path",
    ]
    payload = {
        "schema_version": 1,
        "generated_at": summary["generated_at"],
        "limit": top_limit,
        "items": [dict(zip(keys, row)) for row in rows],
    }
    top_path.parent.mkdir(parents=True, exist_ok=True)
    top_path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )

def set_meta(con: sqlite3.Connection, key: str, value: str) -> None:
    con.execute(
        "INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--summary", required=True)
    ap.add_argument("--top", required=True)
    ap.add_argument("--curated-movies")
    ap.add_argument("--date", help="UTC date YYYY-MM-DD; defaults to today")
    ap.add_argument("--top-limit", type=int, default=5000)
    args = ap.parse_args()

    requested = dt.date.fromisoformat(args.date) if args.date else dt.datetime.now(dt.timezone.utc).date()
    curated = load_curated_tmdb_ids(Path(args.curated_movies) if args.curated_movies else None)
    con = connect(Path(args.db))

    source_stats = {}
    for media_type in ("movie", "series"):
        path, actual_date = download_export(media_type, requested)
        source_stats[media_type] = refresh_type(con, media_type, path, actual_date, curated)
        try:
            path.unlink()
        except OSError:
            pass

    set_meta(con, "schema_version", "1")
    set_meta(con, "last_refresh_at", utcnow())
    set_meta(con, "movie_source_date", source_stats["movie"]["source_date"])
    set_meta(con, "series_source_date", source_stats["series"]["source_date"])
    con.commit()

    write_public_outputs(
        con,
        Path(args.summary),
        Path(args.top),
        source_stats,
        max(100, min(args.top_limit, 20000)),
    )
    stats = db_stats(con)
    con.close()
    print("Movie Master:", json.dumps({**stats, "sources": source_stats}, ensure_ascii=False))

if __name__ == "__main__":
    main()

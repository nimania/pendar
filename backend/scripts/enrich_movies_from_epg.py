#!/usr/bin/env python3
"""Enrich Pendar's canonical movie catalog from trustworthy EPG candidates.

An EPG title is promoted only when at least one connected streaming provider
returns an exact title/alias match through its own search API. No fuzzy match.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
from pathlib import Path

from build_streaming_availability import query_filimo, query_filmnet, query_namava

FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")
NON_WORD = re.compile(r"[^0-9a-zA-Z\u0600-\u06FF]+")
PREFIX = re.compile(
    r"^\s*(?:فیلم\s+سینمایی|سینمایی|فیلم\s+کوتاه|فیلم|سریال|مجموعه\s+تلویزیونی|مجموعه|انیمیشن|پویانمایی)\s*[:\-–—|،]?\s*",
    re.I,
)
EPISODE_SUFFIX = re.compile(
    r"\s*(?:[-–—|،:]\s*)?(?:(?:فصل)\s*[۰-۹0-9]+\s*)?(?:قسمت|اپیزود|ق)\s*[۰-۹0-9]+\s*$",
    re.I,
)
PAREN_EPISODE = re.compile(r"\s*\(\s*[۰-۹0-9]{1,4}\s*\)\s*$")
TRAILING_SEASON = re.compile(r"\s*(?:[-–—|،:]\s*)?(?:فصل|سری)\s*[۰-۹0-9]+\s*$", re.I)

MAX_CANDIDATES = 90
QUERIERS = {
    "filimo": query_filimo,
    "filmnet": query_filmnet,
    "namava": query_namava,
}

GENERIC = {
    "فیلم", "سریال", "انیمیشن", "پویانمایی", "مستند", "سینمایی",
    "برنامه", "شبکه", "نماهنگ", "قرآن", "اذان", "نماز",
}

def load(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default

def norm(value: str) -> str:
    s = str(value or "").translate(FA_DIGITS)
    s = s.replace("ي", "ی").replace("ى", "ی").replace("ك", "ک").replace("‌", " ").replace("ـ", " ")
    s = NON_WORD.sub(" ", s).lower()
    return " ".join(s.split()).strip()

def clean_title(raw: str) -> str:
    t = str(raw or "").strip()
    t = PREFIX.sub("", t).strip()
    for rx in (EPISODE_SUFFIX, PAREN_EPISODE, TRAILING_SEASON):
        t2 = rx.sub("", t).strip(" -–—|،:")
        if t2:
            t = t2
    return " ".join(t.split()).strip()

def infer_type(raw: str, group: str) -> str | None:
    n = norm(raw)
    if group == "series" or n.startswith(("سریال ", "مجموعه تلویزیونی ")):
        return "series"
    if group == "movies" or n.startswith(("فیلم ", "فیلم سینمایی ", "سینمایی ", "فیلم کوتاه ")):
        return "movie"
    if group == "kids" and n.startswith(("انیمیشن ", "پویانمایی ")):
        return "series"
    return None

def existing_aliases(movies: list[dict]) -> set[str]:
    out = set()
    for m in movies:
        for a in [m.get("title_fa"), m.get("original_title"), *(m.get("aliases") or [])]:
            k = norm(a)
            if k:
                out.add(k)
    return out

def candidates(tv: dict, movies: list[dict]) -> list[dict]:
    cmap = {str(c.get("id")): c for c in tv.get("channels") or []}
    existing = existing_aliases(movies)
    rows = {}

    for p in tv.get("programmes") or []:
        c = cmap.get(str(p.get("channel_id")), {})
        group = str(c.get("group") or "")
        raw = str(p.get("title_fa") or p.get("title_en") or "").strip()
        typ = infer_type(raw, group)
        if not typ:
            continue
        title = clean_title(raw)
        key = norm(title)
        if len(key) < 3 or len(key) > 90 or key in GENERIC or key in existing:
            continue
        row = rows.setdefault(key, {
            "title_fa": title,
            "aliases": [title],
            "type": typ,
            "year": p.get("year"),
            "count": 0,
            "channels": set(),
            "examples": [],
        })
        row["count"] += 1
        row["channels"].add(str(c.get("name_fa") or c.get("name") or ""))
        if raw not in row["examples"] and len(row["examples"]) < 3:
            row["examples"].append(raw)

    out = list(rows.values())
    for r in out:
        r["channels"] = sorted(x for x in r["channels"] if x)
    out.sort(key=lambda x: (-x["count"], 0 if x["type"] == "movie" else 1, x["title_fa"]))
    return out[:MAX_CANDIDATES]

def provider_ref(service: str, row: dict) -> dict:
    ref = {
        "id": str(row.get("provider_id") or ""),
        "url": row.get("url"),
        "direct": bool(row.get("direct")),
    }
    return {k: v for k, v in ref.items() if v not in ("", None)}

def verify_candidate(candidate: dict) -> tuple[dict, list[dict], list[str]]:
    matches = []
    errors = []
    for key, querier in QUERIERS.items():
        try:
            rows, responded = querier(candidate)
            if responded:
                for row in rows:
                    if row.get("match") == "exact":
                        row = dict(row)
                        row["service"] = key
                        matches.append(row)
        except Exception as exc:
            errors.append(f"{key}:{type(exc).__name__}")
    return candidate, matches, errors

def stable_slug(candidate: dict, matches: list[dict]) -> str:
    identity = norm(candidate["title_fa"]) + "|" + candidate["type"] + "|" + str(candidate.get("year") or "")
    digest = hashlib.sha1(identity.encode("utf-8")).hexdigest()[:12]
    return "epg-" + digest

def to_movie(candidate: dict, matches: list[dict]) -> dict:
    title_en = next((str(x.get("title_en") or "").strip() for x in matches if x.get("title_en")), "")
    poster = next((x.get("poster_url") for x in matches if x.get("poster_url")), None)
    aliases = [candidate["title_fa"]]
    if title_en and norm(title_en) != norm(candidate["title_fa"]):
        aliases.append(title_en)

    refs = {}
    for x in matches:
        service = str(x.get("service") or "")
        if service:
            refs[service] = provider_ref(service, x)

    return {
        "slug": stable_slug(candidate, matches),
        "type": candidate["type"],
        "title_fa": candidate["title_fa"],
        "original_title": title_en or None,
        "aliases": aliases,
        "year": candidate.get("year"),
        "country_fa": None,
        "genres_fa": [],
        "runtime_min": None,
        "poster_url": poster,
        "overview_fa": "",
        "director": None,
        "cast": [],
        "ratings": {},
        "external": {},
        "provider_refs": refs,
        "mentions": [],
        "mention_count": 0,
        "verification": {
            "level": "epg_provider_exact",
            "source": "EPG + provider exact search",
            "providers": sorted(refs),
        },
        "epg_discovery": {
            "count": candidate["count"],
            "channels": candidate["channels"],
            "examples": candidate["examples"],
        },
    }

def write_movies(path: Path, payload: dict, js_path: Path | None = None):
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    path.write_text(compact, encoding="utf-8")
    if js_path:
        js_path.write_text("window.__MOVIES_DATA__=" + compact + ";\n", encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tv", required=True)
    ap.add_argument("--movies", required=True)
    ap.add_argument("--movies-js")
    args = ap.parse_args()

    tv_path = Path(args.tv)
    movie_path = Path(args.movies)
    js_path = Path(args.movies_js) if args.movies_js else None

    tv = load(tv_path, {})
    payload = load(movie_path, {})
    movies = payload.get("movies") if isinstance(payload, dict) else []
    movies = movies if isinstance(movies, list) else []

    cands = candidates(tv, movies)
    verified = []
    provider_counts = {k: 0 for k in QUERIERS}

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(verify_candidate, c) for c in cands]
        for future in concurrent.futures.as_completed(futures):
            candidate, matches, _errors = future.result()
            if not matches:
                continue
            movie = to_movie(candidate, matches)
            verified.append(movie)
            for svc in movie.get("provider_refs") or {}:
                provider_counts[svc] = provider_counts.get(svc, 0) + 1

    # Deterministic ordering and duplicate guard.
    existing = existing_aliases(movies)
    added = []
    for movie in sorted(verified, key=lambda x: x["title_fa"]):
        if norm(movie["title_fa"]) in existing:
            continue
        movies.append(movie)
        added.append(movie)
        existing.update(norm(a) for a in movie.get("aliases") or [] if norm(a))

    payload["movies"] = movies
    stats = payload.setdefault("catalog_stats", {})
    stats["epg_candidates_checked"] = len(cands)
    stats["epg_provider_verified_added"] = len(added)
    stats["epg_provider_counts"] = provider_counts

    write_movies(movie_path, payload, js_path)
    print("EPG movie enrichment:", json.dumps({
        "candidates_checked": len(cands),
        "added": len(added),
        "providers": provider_counts,
        "catalog_total": len(movies),
        "sample_added": [m["title_fa"] for m in added[:15]],
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()

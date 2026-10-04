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
import urllib.parse
from pathlib import Path

from build_streaming_availability import query_filimo, query_filmnet, query_namava
from build_movies import (
    FILM_CLASSES,
    SERIES_CLASSES,
    _wikidata_search,
    _wikidata_get_entity,
    _claim_ids,
    _claim_string,
    _claim_year,
    _label,
    _aliases as wikidata_aliases,
)

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

def _year_compatible(a, b) -> bool:
    def values(v):
        try:
            y=int(str(v).translate(FA_DIGITS))
        except Exception:
            return set()
        out={y}
        if 1300 <= y <= 1500:
            out.update({y+621,y+622})
        elif 1900 <= y <= 2200:
            out.update({y-621,y-622})
        return out
    aa,bb=values(a),values(b)
    return not aa or not bb or bool(aa & bb)

def verify_wikidata_candidate(candidate: dict) -> dict | None:
    """Accept only one exact-label/alias Wikidata film/series identity."""
    title=str(candidate.get("title_fa") or "").strip()
    if not title:
        return None
    lang="fa" if re.search(r"[\u0600-\u06ff]",title) else "en"
    ids=[]
    try:
        ids=_wikidata_search(title,lang)
        if lang!="en":
            ids += [x for x in _wikidata_search(title,"en") if x not in ids]
    except Exception:
        return None

    wanted=norm(title)
    valid=[]
    for qid in ids[:12]:
        try:
            entity=_wikidata_get_entity(qid)
        except Exception:
            continue
        if not entity:
            continue
        classes=set(_claim_ids(entity,"P31"))
        typ="series" if classes & SERIES_CLASSES else "movie" if classes & FILM_CLASSES else None
        if not typ or typ != candidate.get("type"):
            continue

        names=[
            _label(entity,"fa"),
            _label(entity,"en"),
            *wikidata_aliases(entity,"fa"),
            *wikidata_aliases(entity,"en"),
        ]
        if wanted not in {norm(x) for x in names if x}:
            continue

        year=_claim_year(entity)
        if not _year_compatible(candidate.get("year"),year):
            continue

        valid.append((qid,entity,year,names))

    if len(valid)!=1:
        return None

    qid,entity,year,names=valid[0]
    fa=_label(entity,"fa") or title
    en=_label(entity,"en") or None
    aliases=[]
    for x in [fa,en,*names]:
        if x and norm(x) not in {norm(y) for y in aliases}:
            aliases.append(x)

    imdb=_claim_string(entity,"P345")
    tmdb_movie=_claim_string(entity,"P4947")
    tmdb_tv=_claim_string(entity,"P4983")
    image=_claim_string(entity,"P18")
    poster=("https://commons.wikimedia.org/wiki/Special:FilePath/"+urllib.parse.quote(image)+"?width=500") if image else None

    external={"wikidata":"https://www.wikidata.org/wiki/"+qid}
    if imdb:
        external["imdb"]="https://www.imdb.com/title/"+imdb+"/"
    if tmdb_movie:
        external["tmdb"]="https://www.themoviedb.org/movie/"+tmdb_movie
    elif tmdb_tv:
        external["tmdb"]="https://www.themoviedb.org/tv/"+tmdb_tv

    return {
        "qid":qid,
        "type":candidate.get("type"),
        "title_fa":fa,
        "original_title":en,
        "aliases":aliases[:30],
        "year":year or candidate.get("year"),
        "poster_url":poster,
        "external":external,
        "tmdb_id":tmdb_movie or tmdb_tv,
        "tmdb_type":"movie" if tmdb_movie else "tv" if tmdb_tv else None,
    }

def provider_ref(service: str, row: dict) -> dict:
    ref = {
        "id": str(row.get("provider_id") or ""),
        "url": row.get("url"),
        "direct": bool(row.get("direct")),
    }
    return {k: v for k, v in ref.items() if v not in ("", None)}

def verify_candidate(candidate: dict) -> tuple[dict, list[dict], dict | None, list[str]]:
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

    wikidata = None
    if not matches:
        wikidata = verify_wikidata_candidate(candidate)
    return candidate, matches, wikidata, errors

def stable_slug(candidate: dict, matches: list[dict], wikidata: dict | None = None) -> str:
    if wikidata and wikidata.get("qid"):
        return "wikidata-" + str(wikidata["qid"]).lower()
    identity = norm(candidate["title_fa"]) + "|" + candidate["type"] + "|" + str(candidate.get("year") or "")
    digest = hashlib.sha1(identity.encode("utf-8")).hexdigest()[:12]
    return "epg-" + digest

def to_movie(candidate: dict, matches: list[dict], wikidata: dict | None = None) -> dict:
    title_en = next((str(x.get("title_en") or "").strip() for x in matches if x.get("title_en")), "")
    if not title_en and wikidata:
        title_en = str(wikidata.get("original_title") or "").strip()
    poster = next((x.get("poster_url") for x in matches if x.get("poster_url")), None)
    if not poster and wikidata:
        poster = wikidata.get("poster_url")

    aliases = [candidate["title_fa"]]
    if wikidata:
        aliases = list(wikidata.get("aliases") or aliases)
        if norm(candidate["title_fa"]) not in {norm(x) for x in aliases}:
            aliases.insert(0,candidate["title_fa"])
    elif title_en and norm(title_en) != norm(candidate["title_fa"]):
        aliases.append(title_en)

    refs = {}
    for x in matches:
        service = str(x.get("service") or "")
        if service:
            refs[service] = provider_ref(service, x)

    verification = {
        "level": "epg_provider_exact" if refs else "epg_wikidata_exact",
        "source": "EPG + provider exact search" if refs else "EPG + unique exact Wikidata identity",
        "providers": sorted(refs),
    }
    if wikidata and wikidata.get("qid"):
        verification["qid"]=wikidata["qid"]

    return {
        "slug": stable_slug(candidate, matches, wikidata),
        "type": candidate["type"],
        "title_fa": (wikidata or {}).get("title_fa") or candidate["title_fa"],
        "original_title": title_en or None,
        "aliases": aliases,
        "year": (wikidata or {}).get("year") or candidate.get("year"),
        "country_fa": None,
        "genres_fa": [],
        "runtime_min": None,
        "poster_url": poster,
        "overview_fa": "",
        "director": None,
        "cast": [],
        "ratings": {},
        "external": (wikidata or {}).get("external") or {},
        "provider_refs": refs,
        "mentions": [],
        "mention_count": 0,
        "verification": verification,
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
    wikidata_verified = 0
    tmdb_linked = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        futures = [pool.submit(verify_candidate, c) for c in cands]
        for future in concurrent.futures.as_completed(futures):
            candidate, matches, wikidata, _errors = future.result()
            if not matches and not wikidata:
                continue
            movie = to_movie(candidate, matches, wikidata)
            verified.append(movie)
            if wikidata:
                wikidata_verified += 1
                if (wikidata.get("external") or {}).get("tmdb"):
                    tmdb_linked += 1
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
    stats["epg_wikidata_verified"] = wikidata_verified
    stats["epg_tmdb_linked"] = tmdb_linked

    write_movies(movie_path, payload, js_path)
    print("EPG movie enrichment:", json.dumps({
        "candidates_checked": len(cands),
        "added": len(added),
        "providers": provider_counts,
        "wikidata_verified": wikidata_verified,
        "tmdb_linked": tmdb_linked,
        "catalog_total": len(movies),
        "sample_added": [m["title_fa"] for m in added[:15]],
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()

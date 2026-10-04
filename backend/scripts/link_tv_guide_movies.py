#!/usr/bin/env python3
"""Link trustworthy EPG programme titles to Pendar canonical movie/series entities.

Matching is deliberately conservative:
- aliases must be exact after Persian/Latin normalization;
- an alias must resolve to exactly one canonical entity;
- only structural wrappers such as "فیلم سینمایی" or "قسمت ۵" may be removed;
- year conflicts reject a match;
- no fuzzy similarity, embeddings, or guessed titles are used.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")
NON_WORD = re.compile(r"[^0-9a-zA-Z\u0600-\u06FF]+")
PREFIX = re.compile(
    r"^\s*(?:فیلم\s+سینمایی|فیلم|سریال|مجموعه\s+تلویزیونی|مجموعه|مستند|انیمیشن)\s*[:\-–—|،]?\s*",
    re.I,
)
EPISODE_SUFFIX = re.compile(
    r"\s*(?:[-–—|،:]\s*)?(?:(?:فصل)\s*[۰-۹0-9]+\s*)?(?:قسمت|اپیزود)\s*[۰-۹0-9]+\s*$",
    re.I,
)
SEASON_EPISODE_SUFFIX = re.compile(
    r"\s*(?:[-–—|،:]\s*)?(?:فصل)\s*[۰-۹0-9]+\s*(?:قسمت|اپیزود)?\s*[۰-۹0-9]*\s*$",
    re.I,
)

def load(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default

def norm(value: str) -> str:
    s = str(value or "")
    s = s.translate(FA_DIGITS)
    s = s.replace("ي", "ی").replace("ى", "ی").replace("ك", "ک").replace("‌", " ").replace("ـ", " ")
    s = NON_WORD.sub(" ", s).lower()
    return " ".join(s.split()).strip()

def candidate_titles(raw: str) -> list[tuple[str, str]]:
    text = str(raw or "").strip()
    out: list[tuple[str, str]] = []

    def add(value: str, level: str):
        key = norm(value)
        if len(key) >= 3 and key not in {x[0] for x in out}:
            out.append((key, level))

    add(text, "exact")

    without_prefix = PREFIX.sub("", text).strip()
    if without_prefix != text:
        add(without_prefix, "wrapped_exact")

    for base in (text, without_prefix):
        stripped = EPISODE_SUFFIX.sub("", base).strip(" -–—|،:")
        if stripped and stripped != base:
            add(stripped, "episode_wrapped_exact")
        stripped2 = SEASON_EPISODE_SUFFIX.sub("", base).strip(" -–—|،:")
        if stripped2 and stripped2 != base:
            add(stripped2, "episode_wrapped_exact")

    return out

def year_set(value) -> set[int]:
    try:
        y = int(str(value).strip().translate(FA_DIGITS))
    except Exception:
        return set()
    out = {y}
    if 1300 <= y <= 1500:
        out.update({y + 621, y + 622})
    elif 1900 <= y <= 2200:
        out.update({y - 621, y - 622})
    return out

def year_compatible(programme: dict, movie: dict) -> bool:
    py = year_set(programme.get("year"))
    my = year_set(movie.get("year"))
    return not py or not my or bool(py & my)

def build_alias_index(movies: list[dict]) -> dict[str, dict | None]:
    index: dict[str, dict | None] = {}
    owners: dict[str, str] = {}
    for movie in movies:
        slug = str(movie.get("slug") or "").strip()
        if not slug:
            continue
        aliases = [
            movie.get("title_fa"),
            movie.get("original_title"),
            *(movie.get("aliases") or []),
        ]
        for alias in aliases:
            key = norm(alias)
            if len(key) < 3:
                continue
            if key not in index:
                index[key] = movie
                owners[key] = slug
            elif owners.get(key) != slug:
                # Ambiguous aliases are intentionally disabled.
                index[key] = None
    return index

def service_map(streaming: dict) -> dict[str, dict]:
    return {str(s.get("key")): s for s in streaming.get("services") or [] if s.get("key")}

def availability_payload(streaming: dict, slug: str) -> list[dict]:
    services = service_map(streaming)
    rows = streaming.get("availability", {}).get(slug) or []
    out = []
    seen = set()
    for row in rows if isinstance(rows, list) else []:
        key = str(row.get("service") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        svc = services.get(key, {})
        out.append({
            "key": key,
            "name_fa": svc.get("name_fa") or svc.get("name_en") or key,
            "logo": svc.get("logo"),
            "url": row.get("url") or svc.get("homepage"),
            "direct": bool(row.get("direct")),
        })
    return out

def link(tv: dict, movies_data: dict, streaming: dict) -> dict:
    movies = movies_data.get("movies") if isinstance(movies_data, dict) else []
    movies = movies if isinstance(movies, list) else []
    index = build_alias_index(movies)

    linked = 0
    wrapped = 0
    with_streaming = 0
    unique = set()
    match_levels: dict[str, int] = {}

    programmes = tv.get("programmes") if isinstance(tv, dict) else []
    programmes = programmes if isinstance(programmes, list) else []

    for p in programmes:
        # Clear stale enrichment before each rebuild.
        for key in (
            "canonical_slug", "canonical_title", "canonical_original_title",
            "canonical_type", "canonical_match", "streaming_services",
            "streaming_count",
        ):
            p.pop(key, None)

        matched = None
        match_level = None
        for key, level in candidate_titles(p.get("title_fa") or p.get("title_en") or ""):
            movie = index.get(key)
            if movie and year_compatible(p, movie):
                matched = movie
                match_level = level
                break

        if not matched:
            continue

        slug = str(matched.get("slug"))
        services = availability_payload(streaming, slug)
        p["canonical_slug"] = slug
        p["canonical_title"] = matched.get("title_fa") or matched.get("original_title")
        p["canonical_original_title"] = matched.get("original_title")
        p["canonical_type"] = matched.get("type")
        p["canonical_match"] = match_level
        p["streaming_services"] = services
        p["streaming_count"] = len(services)

        linked += 1
        unique.add(slug)
        match_levels[match_level] = match_levels.get(match_level, 0) + 1
        if match_level != "exact":
            wrapped += 1
        if services:
            with_streaming += 1

    tv["canonical_link_stats"] = {
        "linked_programmes": linked,
        "unique_titles": len(unique),
        "wrapped_exact_matches": wrapped,
        "programmes_with_streaming": with_streaming,
        "match_levels": match_levels,
        "policy": "unique exact alias; structural wrapper removal only; year conflict rejects",
    }
    return tv

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tv", required=True)
    ap.add_argument("--movies", required=True)
    ap.add_argument("--streaming", required=True)
    ap.add_argument("--output")
    args = ap.parse_args()

    tv_path = Path(args.tv)
    movies_path = Path(args.movies)
    streaming_path = Path(args.streaming)
    out = Path(args.output) if args.output else tv_path

    tv = load(tv_path, {})
    movies = load(movies_path, {})
    streaming = load(streaming_path, {})

    if not isinstance(tv, dict) or not isinstance(tv.get("programmes"), list):
        raise SystemExit("invalid TV guide JSON")
    if not isinstance(movies, dict) or not isinstance(movies.get("movies"), list):
        raise SystemExit("invalid movies JSON")
    if not isinstance(streaming, dict):
        streaming = {}

    result = link(tv, movies, streaming)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("TV canonical links:", json.dumps(result["canonical_link_stats"], ensure_ascii=False))

if __name__ == "__main__":
    main()

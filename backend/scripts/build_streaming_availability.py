#!/usr/bin/env python3
"""Build conservative streaming availability for Pendar canonical film/series entities.

Rules:
- Query public service search/catalog endpoints.
- Publish only high-confidence title/alias matches.
- Never guess a watch URL.
- A provider failure is isolated and does not create availability claims.
"""
from __future__ import annotations

import argparse
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "Pendar-Streaming/1.0 (+https://nimania.github.io/pendar/)"

SERVICES = [
    {"key":"filimo","name_fa":"فیلیمو","name_en":"Filimo","status":"active","homepage":"https://www.filimo.com/"},
    {"key":"filmnet","name_fa":"فیلم‌نت","name_en":"FilmNet","status":"active","homepage":"https://filmnet.ir/"},
    {"key":"namava","name_fa":"نماوا","name_en":"Namava","status":"active","homepage":"https://www.namava.ir/main"},
    {"key":"tamashakhoneh","name_fa":"تماشاخونه","name_en":"Tamashakhoneh","status":"planned","homepage":None},
    {"key":"starnet","name_fa":"استارنت","name_en":"StarNet","status":"planned","homepage":None},
    {"key":"telewebion","name_fa":"تلوبیون","name_en":"Telewebion","status":"planned","homepage":"https://telewebion.com/"},
    {"key":"lenz","name_fa":"لنز","name_en":"Lenz","status":"planned","homepage":"https://lenz.ir/"},
    {"key":"gapfilm","name_fa":"گپ‌فیلم","name_en":"GapFilm","status":"planned","homepage":"https://gapfilm.ir/"},
    {"key":"digitoon","name_fa":"دیجی‌تون","name_en":"Digitoon","status":"planned","homepage":"https://digitoon.ir/"},
]

GENERIC_PREFIX_RE = re.compile(r"^(?:سریال|فیلم|مستند|انیمیشن|مجموعه|movie|film|series|documentary)\s+", re.I)
NON_WORD_RE = re.compile(r"[^0-9a-zA-Z\u0600-\u06FF]+")

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00","Z")

def norm(value: str) -> str:
    s = str(value or "").replace("ي","ی").replace("ى","ی").replace("ك","ک").replace("‌"," ").replace("ـ"," ")
    s = GENERIC_PREFIX_RE.sub("", s.strip())
    s = NON_WORD_RE.sub(" ", s).lower()
    return " ".join(s.split())

def aliases(movie: dict) -> list[str]:
    raw = [movie.get("title_fa"), movie.get("original_title"), *(movie.get("aliases") or [])]
    out=[]
    seen=set()
    for x in raw:
        n=norm(x)
        if n and n not in seen:
            seen.add(n); out.append(str(x))
    return out

def year_equivalents(value) -> set[int]:
    try:
        y=int(value)
    except Exception:
        return set()
    out={y}
    if 1300 <= y <= 1500:
        out.update({y+621,y+622})
    elif 1900 <= y <= 2200:
        out.update({y-621,y-622})
    return out

def exact_match(movie: dict, candidate_titles: list[str], candidate_year=None) -> bool:
    wanted={norm(x) for x in aliases(movie) if norm(x)}
    got={norm(x) for x in candidate_titles if norm(x)}
    if not wanted.intersection(got):
        return False
    my_years=year_equivalents(movie.get("year"))
    cand_years=year_equivalents(candidate_year)
    if my_years and cand_years and not my_years.intersection(cand_years):
        return False
    return True

def fetch_json(url: str, headers: dict | None=None, timeout: int=20):
    h={"User-Agent":USER_AGENT,"Accept":"application/json,text/plain,*/*"}
    h.update(headers or {})
    req=urllib.request.Request(url,headers=h)
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8-sig"))

def query_filimo(movie: dict) -> tuple[list[dict], bool]:
    candidates=[]
    ok=False
    for q in aliases(movie)[:2]:
        url="https://www.filimo.com/api/en/v1/movie/movie/list/tagid/1000300/text/"+urllib.parse.quote(q,safe="")+"/sug/on"
        try:
            payload=fetch_json(url,headers={"jsonType":"simple"})
            ok=True
        except Exception:
            continue
        rows=payload.get("data") if isinstance(payload,dict) else []
        if isinstance(rows,dict):
            rows=list(rows.values())
        for x in rows or []:
            if not isinstance(x,dict): continue
            titles=[x.get("movie_title"),x.get("movie_title_en"),x.get("title"),x.get("title_en")]
            if not exact_match(movie,titles,x.get("year") or x.get("movie_year")):
                continue
            key=x.get("link_key")
            url=("https://www.filimo.com/m/"+str(key)) if key else None
            candidates.append({
                "service":"filimo","title":x.get("movie_title") or x.get("title") or movie.get("title_fa"),
                "title_en":x.get("movie_title_en") or x.get("title_en"),
                "url":url,"direct":bool(url),"provider_id":str(x.get("movie_id") or x.get("id") or ""),
                "match":"exact","verified_by":"provider_search",
                "poster_url":x.get("cover"),
            })
    return dedupe(candidates),ok

def query_filmnet(movie: dict) -> tuple[list[dict], bool]:
    candidates=[]
    ok=False
    for q in aliases(movie)[:2]:
        params=urllib.parse.urlencode([
            ("offset","0"),("count","24"),("order","latest"),("query",q),
            ("types","single_video"),("types","series"),("types","video_content_list"),
        ])
        try:
            payload=fetch_json("https://filmnet.ir/api-v2/video-contents?"+params)
            ok=True
        except Exception:
            continue
        rows=payload.get("data") if isinstance(payload,dict) else []
        for x in rows or []:
            if not isinstance(x,dict): continue
            titles=[x.get("title"),x.get("original_name"),x.get("original_title")]
            if not exact_match(movie,titles,x.get("year")):
                continue
            short_id=x.get("short_id"); slug=x.get("slug")
            url=f"https://filmnet.ir/contents/{short_id}/{slug}" if short_id and slug else None
            cover=x.get("cover_image")
            if isinstance(cover,dict): cover=cover.get("path")
            candidates.append({
                "service":"filmnet","title":x.get("title") or movie.get("title_fa"),
                "title_en":x.get("original_name") or x.get("original_title"),
                "url":url,"direct":bool(url),"provider_id":str(x.get("id") or ""),
                "match":"exact","verified_by":"provider_search",
                "poster_url":cover,
            })
    return dedupe(candidates),ok

def _namava_media(payload) -> list[dict]:
    try:
        rows=payload["result"]["result_items"][0]["groups"]["Media"]
    except Exception:
        return []
    if isinstance(rows,dict):
        rows=rows.get("items") or []
    return rows if isinstance(rows,list) else []

def query_namava(movie: dict) -> tuple[list[dict], bool]:
    candidates=[]
    ok=False
    for q in aliases(movie)[:2]:
        params=urllib.parse.urlencode({"type":"all","count":20,"page":1,"query":q})
        try:
            payload=fetch_json("https://www.namava.ir/api/v3.0/search/advance?"+params)
            ok=True
        except Exception:
            continue
        for x in _namava_media(payload):
            if not isinstance(x,dict): continue
            titles=[x.get("name"),x.get("title"),x.get("name_en"),x.get("original_name")]
            if not exact_match(movie,titles,x.get("year")):
                continue
            # Search confirms availability; do not invent a content-page route.
            candidates.append({
                "service":"namava","title":x.get("name") or x.get("title") or movie.get("title_fa"),
                "title_en":x.get("name_en") or x.get("original_name"),
                "url":"https://www.namava.ir/main","direct":False,"provider_id":str(x.get("id") or ""),
                "match":"exact","verified_by":"provider_search",
                "poster_url":x.get("image_url"),
            })
    return dedupe(candidates),ok

def dedupe(rows: list[dict]) -> list[dict]:
    out=[]; seen=set()
    for x in rows:
        key=(x.get("service"),x.get("provider_id"),x.get("url"),norm(x.get("title")))
        if key in seen: continue
        seen.add(key); out.append(x)
    return out

QUERIERS={"filimo":query_filimo,"filmnet":query_filmnet,"namava":query_namava}

def build(movies_path: Path) -> dict:
    raw=json.loads(movies_path.read_text(encoding="utf-8"))
    movies=raw.get("movies") if isinstance(raw,dict) else []
    movies=movies if isinstance(movies,list) else []

    availability={}
    health={}
    for service in SERVICES:
        key=service["key"]
        health[key]={
            "status":"planned" if service.get("status")=="planned" else "unknown",
            "checked_at":None,"matched_titles":0,"queried_titles":0,
        }

    active=[s for s in SERVICES if s["key"] in QUERIERS]
    # Keep builds bounded as the canonical catalog grows.
    for movie in movies[:250]:
        slug=str(movie.get("slug") or "").strip()
        if not slug: continue
        matches=[]
        for service in active:
            key=service["key"]
            health[key]["queried_titles"]+=1
            try:
                rows,responded=QUERIERS[key](movie)
                health[key]["checked_at"]=now_iso()
                if responded and health[key]["status"]!="ok":
                    health[key]["status"]="ok"
                if rows:
                    health[key]["matched_titles"]+=1
                    matches.extend(rows)
            except Exception as exc:
                health[key]["checked_at"]=now_iso()
                if health[key]["status"]!="ok":
                    health[key]["status"]="error"
                health[key]["error"]=f"{type(exc).__name__}: {exc}"
        if matches:
            availability[slug]=dedupe(matches)

    for s in active:
        key=s["key"]
        if health[key]["status"]=="unknown":
            health[key]["status"]="error"

    services=[]
    for s in SERVICES:
        row=dict(s)
        row["health"]=health.get(s["key"],{})
        services.append(row)

    return {
        "schema_version":1,
        "generated_at":now_iso(),
        "matching_policy":"exact-title-or-alias; year-consistent-when-present",
        "services":services,
        "availability":availability,
        "stats":{
            "canonical_titles":len(movies),
            "titles_with_availability":len(availability),
            "availability_records":sum(len(v) for v in availability.values()),
        },
    }

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--movies",required=True)
    ap.add_argument("--output",required=True)
    args=ap.parse_args()
    movies_path=Path(args.movies)
    out=Path(args.output)
    if not movies_path.exists():
        raise SystemExit(f"movies file not found: {movies_path}")
    data=build(movies_path)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print("Streaming availability:",json.dumps(data["stats"],ensure_ascii=False))
    for s in data["services"]:
        h=s.get("health") or {}
        print(" -",s["key"],h.get("status"),"queried",h.get("queried_titles"),"matched",h.get("matched_titles"))

if __name__=="__main__":
    main()

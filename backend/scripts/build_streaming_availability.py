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
import concurrent.futures
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

USER_AGENT = "Pendar-Streaming/1.0 (+https://nimania.github.io/pendar/)"

SERVICES = [
    {"key":"filimo","name_fa":"فیلیمو","name_en":"Filimo","status":"active","homepage":"https://www.filimo.com/","logo":"https://upload.wikimedia.org/wikipedia/commons/5/5d/Filimo_logo.svg"},
    {"key":"filmnet","name_fa":"فیلم‌نت","name_en":"FilmNet","status":"active","homepage":"https://filmnet.ir/","logo":"https://upload.wikimedia.org/wikipedia/commons/5/53/FilmNet_Logo.png"},
    {"key":"namava","name_fa":"نماوا","name_en":"Namava","status":"active","homepage":"https://www.namava.ir/main","logo":"https://upload.wikimedia.org/wikipedia/commons/5/50/Namava_logo.svg"},
    {"key":"30nama","name_fa":"۳۰نما","name_en":"30nama","status":"active","homepage":"https://30nama.com/","logo":"https://30nama.com/favicon.ico"},
    {"key":"tamashakhoneh","name_fa":"تماشاخونه","name_en":"Tamashakhoneh","status":"planned","homepage":"https://tmk.ir/","logo":"https://www.google.com/s2/favicons?sz=128&domain=tmk.ir"},
    {"key":"starnet","name_fa":"استارنت","name_en":"StarNet","status":"planned","homepage":"https://starnet.ir/","logo":"https://www.google.com/s2/favicons?sz=128&domain=starnet.ir"},
    {"key":"telewebion","name_fa":"تلوبیون","name_en":"Telewebion","status":"planned","homepage":"https://telewebion.com/","logo":"https://upload.wikimedia.org/wikipedia/commons/c/c2/Telewebion.svg"},
    {"key":"lenz","name_fa":"لنز","name_en":"Lenz","status":"planned","homepage":"https://lenz.ir/","logo":"https://www.google.com/s2/favicons?sz=128&domain=lenz.ir"},
    {"key":"gapfilm","name_fa":"گپ‌فیلم","name_en":"GapFilm","status":"planned","homepage":"https://gapfilm.ir/","logo":"https://www.google.com/s2/favicons?sz=128&domain=gapfilm.ir"},
    {"key":"digitoon","name_fa":"دیجی‌تون","name_en":"Digitoon","status":"planned","homepage":"https://digitoon.ir/","logo":"https://www.google.com/s2/favicons?sz=128&domain=digitoon.ir"},
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

def _extract_filmnet_rows(value, depth: int = 0) -> list[dict]:
    if depth > 5:
        return []
    if isinstance(value, list):
        objects=[x for x in value if isinstance(x,dict)]
        if objects and any(x.get("title") and (x.get("id") or x.get("short_id") or x.get("type")) for x in objects):
            return objects
        for item in value:
            found=_extract_filmnet_rows(item,depth+1)
            if found:
                return found
    elif isinstance(value,dict):
        for key in ("items","results","video_contents","videoContents","contents","data"):
            if key in value:
                found=_extract_filmnet_rows(value.get(key),depth+1)
                if found:
                    return found
        for item in value.values():
            found=_extract_filmnet_rows(item,depth+1)
            if found:
                return found
    return []


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
        rows=_extract_filmnet_rows(payload.get("data") if isinstance(payload,dict) else payload)
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

    active=[svc for svc in SERVICES if svc["key"] in QUERIERS]

    # Provider refs are already exact, first-party availability evidence.
    # Seed them for the entire catalog without making a second network request.
    for movie in movies:
        slug=str(movie.get("slug") or "").strip()
        if not slug:
            continue
        seeded=[]
        refs=movie.get("provider_refs") or {}
        if isinstance(refs,dict):
            service_keys={x["key"] for x in SERVICES}
            for service_key,ref in refs.items():
                if service_key not in service_keys or not isinstance(ref,dict):
                    continue
                svc=next((x for x in SERVICES if x["key"]==service_key),{})
                url=ref.get("url") or svc.get("homepage")
                if not url:
                    continue
                seeded.append({
                    "service":service_key,
                    "title":movie.get("title_fa") or movie.get("original_title") or "",
                    "title_en":movie.get("original_title"),
                    "url":url,
                    "direct":bool(ref.get("direct",service_key in {"filimo","filmnet"})),
                    "provider_id":str(ref.get("id") or ref.get("short_id") or ""),
                    "match":"provider_identity",
                    "verified_by":"provider_catalog",
                    "poster_url":movie.get("poster_url"),
                })
                h=health[service_key]
                h["status"]="ok"
                h["checked_at"]=now_iso()
                h["matched_titles"]+=1
        if seeded:
            availability[slug]=dedupe(seeded)

    # Remote cross-provider search is intentionally bounded. Prefer editorially
    # relevant/verified titles, then newer catalog entries.
    remote_movies=sorted(
        movies,
        key=lambda m: (
            int(m.get("mention_count") or 0),
            1 if (m.get("verification") or {}).get("level") in {"hand_verified","wikidata_exact"} else 0,
            int(m.get("year") or 0),
        ),
        reverse=True,
    )[:120]

    tasks=[]
    for movie in remote_movies:
        slug=str(movie.get("slug") or "").strip()
        if not slug:
            continue
        refs=movie.get("provider_refs") or {}
        for service in active:
            key=service["key"]
            if isinstance(refs,dict) and refs.get(key):
                continue
            health[key]["queried_titles"]+=1
            tasks.append((slug,movie,service))

    def run_remote(slug,movie,service):
        key=service["key"]
        try:
            rows,responded=QUERIERS[key](movie)
            return slug,key,rows,responded,None
        except Exception as exc:
            return slug,key,[],False,f"{type(exc).__name__}: {exc}"

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        future_map=[pool.submit(run_remote,*task) for task in tasks]
        for future in concurrent.futures.as_completed(future_map):
            slug,key,rows,responded,error=future.result()
            health[key]["checked_at"]=now_iso()
            if error:
                if health[key]["status"]!="ok":
                    health[key]["status"]="error"
                health[key]["error"]=error
                continue
            if responded and health[key]["status"]!="ok":
                health[key]["status"]="ok"
            if rows:
                health[key]["matched_titles"]+=1
                availability[slug]=dedupe(list(availability.get(slug) or [])+rows)

    for svc in active:
        key=svc["key"]
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

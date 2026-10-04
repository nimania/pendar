#!/usr/bin/env python3
"""Conservatively enrich Pendar canonical movies/series with IMDb IDs via Wikidata.

Acceptance policy:
- preserve every existing IMDb ID;
- prefer an already-known Wikidata QID;
- otherwise require exact label/alias overlap, compatible type, compatible year
  when both sides have a year, and exactly one Wikidata entity with an IMDb ID;
- never use fuzzy title similarity.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
from pathlib import Path

from build_movies import (
    FILM_CLASSES,
    SERIES_CLASSES,
    _aliases as wd_aliases,
    _claim_ids,
    _claim_string,
    _claim_year,
    _label,
    _norm,
    _wikidata_get_entity,
    _wikidata_search,
)

IMDB_RE = re.compile(r"^tt\d{5,12}$", re.I)
QID_RE = re.compile(r"\b(Q\d+)\b", re.I)
CACHE_VERSION = 1

def load(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default

def save(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def imdb_from_url(value) -> str | None:
    m=re.search(r"/title/(tt\d+)",str(value or ""),re.I)
    return m.group(1).lower() if m else None

def qid_from_movie(movie: dict) -> str | None:
    verification=movie.get("verification") or {}
    qid=str(verification.get("qid") or "").upper()
    if QID_RE.fullmatch(qid):
        return qid
    ext=movie.get("external") or {}
    m=QID_RE.search(str(ext.get("wikidata") or ""))
    if m:
        return m.group(1).upper()
    slug=str(movie.get("slug") or "")
    m=re.match(r"wikidata-(q\d+)$",slug,re.I)
    return m.group(1).upper() if m else None

def aliases(movie: dict) -> list[str]:
    raw=[
        movie.get("original_title"),
        movie.get("title_fa"),
        *(movie.get("aliases") or []),
    ]
    out=[]
    seen=set()
    for value in raw:
        value=str(value or "").strip()
        key=_norm(value)
        if len(key)<2 or key in seen:
            continue
        seen.add(key)
        out.append(value)
    return out

def year_compatible(a,b) -> bool:
    try:
        aa=int(a); bb=int(b)
    except Exception:
        return True
    return abs(aa-bb) <= 1

def entity_type(entity: dict) -> str | None:
    classes=set(_claim_ids(entity,"P31"))
    if classes & SERIES_CLASSES:
        return "series"
    if classes & FILM_CLASSES:
        return "movie"
    return None

def entity_names(entity: dict) -> set[str]:
    values=[
        _label(entity,"fa"), _label(entity,"en"),
        *wd_aliases(entity,"fa"), *wd_aliases(entity,"en"),
    ]
    return {_norm(x) for x in values if _norm(x)}

def extract_ids(qid: str, entity: dict) -> dict | None:
    imdb=str(_claim_string(entity,"P345") or "").lower()
    if not IMDB_RE.fullmatch(imdb):
        return None
    tmdb_movie=_claim_string(entity,"P4947")
    tmdb_tv=_claim_string(entity,"P4983")
    return {
        "status":"verified",
        "qid":qid,
        "imdb":imdb,
        "year":_claim_year(entity),
        "tmdb_movie":tmdb_movie,
        "tmdb_tv":tmdb_tv,
    }

def fingerprint(movie: dict) -> str:
    body=json.dumps({
        "slug":movie.get("slug"),
        "type":movie.get("type"),
        "year":movie.get("year"),
        "aliases":aliases(movie)[:8],
    },ensure_ascii=False,sort_keys=True)
    return hashlib.sha1(body.encode("utf-8")).hexdigest()

def verify_known_qid(movie: dict, qid: str) -> dict:
    try:
        entity=_wikidata_get_entity(qid)
    except Exception as exc:
        return {"status":"error","error":f"{type(exc).__name__}: {exc}"}
    if not entity:
        return {"status":"not_found"}
    typ=entity_type(entity)
    if typ and movie.get("type") and typ != movie.get("type"):
        return {"status":"type_conflict","qid":qid}
    if not year_compatible(movie.get("year"),_claim_year(entity)):
        return {"status":"year_conflict","qid":qid}
    ids=extract_ids(qid,entity)
    return ids or {"status":"no_imdb","qid":qid}

def search_movie(movie: dict) -> dict:
    wanted={_norm(x) for x in aliases(movie) if _norm(x)}
    if not wanted:
        return {"status":"not_found"}

    qids=[]
    for title in aliases(movie)[:4]:
        lang="fa" if re.search(r"[\u0600-\u06ff]",title) else "en"
        try:
            for qid in _wikidata_search(title,lang):
                if qid not in qids:
                    qids.append(qid)
            if lang!="en":
                for qid in _wikidata_search(title,"en"):
                    if qid not in qids:
                        qids.append(qid)
        except Exception:
            continue

    valid=[]
    for qid in qids[:24]:
        try:
            entity=_wikidata_get_entity(qid)
        except Exception:
            continue
        if not entity:
            continue
        typ=entity_type(entity)
        if not typ or (movie.get("type") and typ != movie.get("type")):
            continue
        if not wanted.intersection(entity_names(entity)):
            continue
        if not year_compatible(movie.get("year"),_claim_year(entity)):
            continue
        ids=extract_ids(qid,entity)
        if ids:
            valid.append(ids)

    # Multiple search aliases can return the same QID.
    unique={x["qid"]:x for x in valid}
    if len(unique)==1:
        return next(iter(unique.values()))
    if len(unique)>1:
        return {"status":"ambiguous","qids":sorted(unique)}
    return {"status":"not_found"}

def apply_identity(movie: dict, result: dict) -> bool:
    imdb=result.get("imdb")
    if not imdb:
        return False
    ext=movie.setdefault("external",{})
    ext["imdb"]="https://www.imdb.com/title/"+imdb+"/"
    qid=result.get("qid")
    if qid:
        ext.setdefault("wikidata","https://www.wikidata.org/wiki/"+qid)
    if result.get("tmdb_movie"):
        ext.setdefault("tmdb","https://www.themoviedb.org/movie/"+str(result["tmdb_movie"]))
    elif result.get("tmdb_tv"):
        ext.setdefault("tmdb","https://www.themoviedb.org/tv/"+str(result["tmdb_tv"]))
    refs=movie.setdefault("identity_refs",{})
    refs["imdb"]={"id":imdb,"source":"Wikidata","qid":qid}
    return True

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--movies",required=True)
    ap.add_argument("--movies-js")
    ap.add_argument("--cache",required=True)
    ap.add_argument("--workers",type=int,default=6)
    args=ap.parse_args()

    movies_path=Path(args.movies)
    payload=load(movies_path,{"movies":[]})
    movies=payload.get("movies") if isinstance(payload,dict) else []
    movies=movies if isinstance(movies,list) else []

    cache_path=Path(args.cache)
    cache=load(cache_path,{})
    if not isinstance(cache,dict) or cache.get("version")!=CACHE_VERSION:
        cache={"version":CACHE_VERSION,"entries":{}}
    entries=cache.setdefault("entries",{})

    before=sum(1 for m in movies if imdb_from_url((m.get("external") or {}).get("imdb")))
    pending=[m for m in movies if not imdb_from_url((m.get("external") or {}).get("imdb"))]
    stats={
        "catalog":len(movies),"before":before,"pending":len(pending),
        "added":0,"known_qid":0,"searched":0,"ambiguous":0,
        "not_found":0,"no_imdb":0,"conflict":0,"errors":0,"cache_hits":0,
    }

    def task(movie):
        key=fingerprint(movie)
        cached=entries.get(key)
        if isinstance(cached,dict) and cached.get("status") in {
            "verified","ambiguous","not_found","no_imdb","type_conflict","year_conflict"
        }:
            return movie,key,cached,True
        qid=qid_from_movie(movie)
        if qid:
            result=verify_known_qid(movie,qid)
            result["method"]="known_qid"
        else:
            result=search_movie(movie)
            result["method"]="exact_search"
        return movie,key,result,False

    results=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,args.workers)) as pool:
        futures=[pool.submit(task,m) for m in pending]
        for future in concurrent.futures.as_completed(futures):
            try:
                results.append(future.result())
            except Exception:
                stats["errors"]+=1

    for movie,key,result,cached in results:
        if cached:
            stats["cache_hits"]+=1
        else:
            entries[key]=result
        method=result.get("method")
        if method=="known_qid":
            stats["known_qid"]+=1
        elif method=="exact_search":
            stats["searched"]+=1

        status=result.get("status")
        if status=="verified" and apply_identity(movie,result):
            stats["added"]+=1
        elif status=="ambiguous":
            stats["ambiguous"]+=1
        elif status=="no_imdb":
            stats["no_imdb"]+=1
        elif status in {"type_conflict","year_conflict"}:
            stats["conflict"]+=1
        elif status=="error":
            stats["errors"]+=1
        else:
            stats["not_found"]+=1

    after=sum(1 for m in movies if imdb_from_url((m.get("external") or {}).get("imdb")))
    stats["after"]=after
    stats["coverage_pct"]=round((after/len(movies))*100,1) if movies else 0

    catalog_stats=payload.setdefault("catalog_stats",{})
    catalog_stats["imdb_ids"]=after
    catalog_stats["imdb_coverage_pct"]=stats["coverage_pct"]
    catalog_stats["imdb_enriched_last_run"]=stats["added"]

    compact=json.dumps(payload,ensure_ascii=False,separators=(",",":"))
    movies_path.write_text(compact,encoding="utf-8")
    if args.movies_js:
        Path(args.movies_js).write_text("window.__MOVIES_DATA__="+compact+";\n",encoding="utf-8")
    save(cache_path,cache)
    print("IMDb enrichment:",json.dumps(stats,ensure_ascii=False))

if __name__=="__main__":
    main()

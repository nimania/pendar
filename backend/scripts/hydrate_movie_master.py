#!/usr/bin/env python3
"""Hydrate high-priority Pendar Movie Master titles using the official TMDB API.

Priority:
1) titles already present in Pendar's curated Jan Film catalog;
2) then highest TMDB popularity.

One TMDB request per title uses append_to_response for external IDs, credits and
translations. No fuzzy identity matching is performed: TMDB ID is already the
canonical lookup key from the official daily export.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import json
import os
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://api.themoviedb.org/3"
UA = "Pendar-MovieMaster/1.0 (+https://nimania.github.io/pendar/)"
_lock = threading.Lock()
_last_request = 0.0

def utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00","Z")

def ensure_columns(con: sqlite3.Connection) -> None:
    cols={row[1] for row in con.execute("PRAGMA table_info(titles)")}
    wanted={
        "hydrate_attempts":"INTEGER NOT NULL DEFAULT 0",
        "hydrate_attempted_at":"TEXT",
        "hydrate_error":"TEXT",
    }
    for name,decl in wanted.items():
        if name not in cols:
            con.execute(f"ALTER TABLE titles ADD COLUMN {name} {decl}")
    con.commit()

def request_json(url: str, token: str, min_interval: float) -> dict:
    global _last_request
    with _lock:
        wait=min_interval-(time.monotonic()-_last_request)
        if wait>0:
            time.sleep(wait)
        _last_request=time.monotonic()
    req=urllib.request.Request(url,headers={
        "Authorization":"Bearer "+token,
        "Accept":"application/json",
        "User-Agent":UA,
    })
    with urllib.request.urlopen(req,timeout=35) as response:
        return json.loads(response.read().decode("utf-8"))

def localized_translation(translations: dict, lang: str) -> dict:
    rows=(translations or {}).get("translations") or []
    for row in rows:
        if str(row.get("iso_639_1") or "").lower()!=lang:
            continue
        data=row.get("data") or {}
        if isinstance(data,dict):
            return data
    return {}

def compact_credits(media_type: str, payload: dict) -> list[dict]:
    key="credits" if media_type=="movie" else "aggregate_credits"
    credits=payload.get(key) or {}
    out=[]
    if media_type=="movie":
        crew=credits.get("crew") or []
        for person in crew:
            if person.get("job") in {"Director","Writer","Screenplay","Creator"}:
                out.append({
                    "id":person.get("id"),"name":person.get("name"),
                    "role":person.get("job"),"kind":"crew",
                })
                if len(out)>=12:
                    break
        for person in (credits.get("cast") or [])[:12]:
            out.append({
                "id":person.get("id"),"name":person.get("name"),
                "role":person.get("character"),"kind":"cast",
            })
    else:
        for person in (credits.get("crew") or [])[:10]:
            jobs=person.get("jobs") or []
            out.append({
                "id":person.get("id"),"name":person.get("name"),
                "role":", ".join(str(x.get("job") or "") for x in jobs[:3] if x.get("job")),
                "kind":"crew",
            })
        for person in (credits.get("cast") or [])[:12]:
            roles=person.get("roles") or []
            out.append({
                "id":person.get("id"),"name":person.get("name"),
                "role":", ".join(str(x.get("character") or "") for x in roles[:2] if x.get("character")),
                "kind":"cast",
            })
    return out[:24]

def parse_title(row: sqlite3.Row, payload: dict) -> dict:
    media_type=row["media_type"]
    fa=localized_translation(payload.get("translations") or {}, "fa")
    en=localized_translation(payload.get("translations") or {}, "en")
    title_key="title" if media_type=="movie" else "name"
    original_key="original_title" if media_type=="movie" else "original_name"
    date_key="release_date" if media_type=="movie" else "first_air_date"

    title_fa=str(fa.get(title_key) or "").strip() or None
    title_en=str(en.get(title_key) or "").strip() or None
    localized_title=str(payload.get(title_key) or "").strip() or None
    original_title=str(payload.get(original_key) or row["original_title"] or "").strip() or None

    if not title_fa and str(payload.get("original_language") or "")=="fa":
        title_fa=original_title or localized_title
    if not title_en and str(payload.get("original_language") or "")=="en":
        title_en=original_title or localized_title

    overview_fa=str(fa.get("overview") or "").strip() or None
    overview_en=str(en.get("overview") or "").strip() or None
    if not overview_fa and str(payload.get("original_language") or "")=="fa":
        overview_fa=str(payload.get("overview") or "").strip() or None
    if not overview_en:
        overview_en=str(payload.get("overview") or "").strip() or None

    release_date=str(payload.get(date_key) or "").strip() or None
    year=None
    if release_date and len(release_date)>=4:
        try: year=int(release_date[:4])
        except Exception: pass

    genres=[{"id":x.get("id"),"name":x.get("name")} for x in (payload.get("genres") or []) if x.get("id")]
    external=payload.get("external_ids") or {}
    imdb=str(external.get("imdb_id") or "").strip() or None
    wikidata=str(external.get("wikidata_id") or "").strip() or None

    runtime=None
    if media_type=="movie":
        runtime=payload.get("runtime")
    else:
        runtimes=payload.get("episode_run_time") or []
        runtime=runtimes[0] if runtimes else None

    origin=payload.get("origin_country") or []
    if media_type=="movie" and not origin:
        origin=[x.get("iso_3166_1") for x in (payload.get("production_countries") or []) if x.get("iso_3166_1")]

    return {
        "original_title":original_title,
        "title_fa":title_fa,
        "title_en":title_en,
        "release_date":release_date,
        "year":year,
        "overview_fa":overview_fa,
        "overview_en":overview_en,
        "poster_path":payload.get("poster_path"),
        "backdrop_path":payload.get("backdrop_path"),
        "runtime_min":runtime,
        "status":payload.get("status"),
        "original_language":payload.get("original_language"),
        "origin_country_json":json.dumps(origin,ensure_ascii=False,separators=(",",":")),
        "genres_json":json.dumps(genres,ensure_ascii=False,separators=(",",":")),
        "credits_json":json.dumps(compact_credits(media_type,payload),ensure_ascii=False,separators=(",",":")),
        "translations_json":json.dumps({
            "fa":fa,
            "en":en,
        },ensure_ascii=False,separators=(",",":")),
        "tmdb_payload_json":json.dumps({key:payload.get(key) for key in ("vote_average","vote_count","number_of_seasons","number_of_episodes","networks")},ensure_ascii=False,separators=(",",":")),
        "imdb_id":imdb,
        "wikidata_qid":wikidata,
    }

def hydrate_one(row: sqlite3.Row, token: str, min_interval: float) -> tuple[str, dict|None, str|None]:
    media_path="movie" if row["media_type"]=="movie" else "tv"
    append="external_ids,credits,translations" if row["media_type"]=="movie" else "external_ids,aggregate_credits,translations"
    params=urllib.parse.urlencode({"language":"en-US","append_to_response":append})
    url=f"{API}/{media_path}/{row['tmdb_id']}?{params}"
    try:
        payload=request_json(url,token,min_interval)
        return row["pendar_id"],parse_title(row,payload),None
    except urllib.error.HTTPError as exc:
        if exc.code==404:
            return row["pendar_id"],None,"404"
        return row["pendar_id"],None,f"HTTP {exc.code}"
    except Exception as exc:
        return row["pendar_id"],None,f"{type(exc).__name__}: {str(exc)[:160]}"

def select_rows(con: sqlite3.Connection, limit: int, max_attempts: int) -> list[sqlite3.Row]:
    con.row_factory=sqlite3.Row
    con.execute('CREATE TABLE IF NOT EXISTS creator_priority(pendar_id TEXT PRIMARY KEY,score INTEGER NOT NULL)')
    # Reserve at most one fifth of each batch for older rows missing richer
    # metadata, while most requests keep expanding archive coverage.
    backfill=con.execute(
        """SELECT t.* FROM titles t LEFT JOIN creator_priority p USING(pendar_id) WHERE active=1 AND hydrated=1
           AND tmdb_payload_json IS NULL AND COALESCE(hydrate_attempts,0) < ?
           ORDER BY COALESCE(p.score,0) DESC,curated DESC,popularity DESC,tmdb_id ASC LIMIT ?""",
        (max_attempts,max(1,limit//5)),
    ).fetchall()
    new_rows=con.execute(
        """SELECT t.* FROM titles t LEFT JOIN creator_priority p USING(pendar_id) WHERE active=1 AND hydrated=0
           AND COALESCE(hydrate_attempts,0) < ?
           ORDER BY COALESCE(p.score,0) DESC,curated DESC,popularity DESC,tmdb_id ASC LIMIT ?""",
        (max_attempts,max(0,limit-len(backfill))),
    ).fetchall()
    return backfill+new_rows


def write_public(con: sqlite3.Connection, summary_path: Path|None, top_path: Path|None, top_limit: int) -> None:
    def scalar(sql,args=()):
        return con.execute(sql,args).fetchone()[0]
    stats={
        "total_active":scalar("SELECT COUNT(*) FROM titles WHERE active=1"),
        "movies":scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND media_type='movie'"),
        "series":scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND media_type='series'"),
        "curated":scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND curated=1"),
        "hydrated":scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND hydrated=1"),
        "with_imdb":scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND imdb_id IS NOT NULL AND imdb_id<>''"),
        "with_wikidata":scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND wikidata_qid IS NOT NULL AND wikidata_qid<>''"),
        "with_fa_title":scalar("SELECT COUNT(*) FROM titles WHERE active=1 AND title_fa IS NOT NULL AND title_fa<>''"),
    }
    if summary_path:
        existing={}
        try: existing=json.loads(summary_path.read_text(encoding="utf-8"))
        except Exception: pass
        existing.update({
            "schema_version":1,
            "generated_at":utcnow(),
            "source":"TMDB official daily ID exports + TMDB API hydration",
            "stats":stats,
        })
        summary_path.parent.mkdir(parents=True,exist_ok=True)
        summary_path.write_text(json.dumps(existing,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    if top_path:
        con.row_factory=sqlite3.Row
        rows=con.execute(
            """
            SELECT pendar_id,media_type,tmdb_id,original_title,popularity,curated,hydrated,
                   title_fa,title_en,year,imdb_id,wikidata_qid,poster_path,genres_json,original_language,origin_country_json
            FROM titles WHERE active=1 AND hydrated=1
            ORDER BY curated DESC,popularity DESC,tmdb_id ASC
            """
        ).fetchall()
        items=[]
        for row in rows:
            x=dict(row)
            try: x["origin_country"]=json.loads(x.pop("origin_country_json") or "[]")
            except Exception: x["origin_country"]=[]
            x["detail_bucket"]=int(x["tmdb_id"]) % 64
            try: x["genres"]=json.loads(x.pop("genres_json") or "[]")
            except Exception: x["genres"]=[]
            items.append(x)
        # Details are fetched on demand; keep the browse index small.
        detail_dir=top_path.parent / "movie-master-details"
        detail_dir.mkdir(parents=True,exist_ok=True)
        buckets={}
        for item in items:
            row=con.execute("SELECT * FROM titles WHERE pendar_id=?", (item["pendar_id"],)).fetchone()
            detail={**item}
            for key in ("overview_fa","overview_en","runtime_min","status","release_date","backdrop_path"):
                detail[key]=row[key]
            try: detail.update(json.loads(row["tmdb_payload_json"] or "{}"))
            except Exception: pass
            try: detail["credits"]=json.loads(row["credits_json"] or "[]")
            except Exception: detail["credits"]=[]
            buckets.setdefault(item["detail_bucket"],{})[item["pendar_id"]]=detail
        for bucket in range(64):
            (detail_dir / f"{bucket}.json").write_text(
                json.dumps(buckets.get(bucket,{}),ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
        top_path.parent.mkdir(parents=True,exist_ok=True)
        top_path.write_text(json.dumps({
            "schema_version":1,"generated_at":utcnow(),"limit":top_limit,"items":items[:top_limit]
        },ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--export-only",action="store_true")
    ap.add_argument("--db",required=True)
    ap.add_argument("--limit",type=int,default=1500)
    ap.add_argument("--workers",type=int,default=4)
    ap.add_argument("--min-interval",type=float,default=0.08)
    ap.add_argument("--max-attempts",type=int,default=3)
    ap.add_argument("--summary")
    ap.add_argument("--top")
    ap.add_argument("--top-limit",type=int,default=5000)
    args=ap.parse_args()

    token=str(os.environ.get("TMDB_READ_TOKEN") or "").strip()
    if not token or args.export_only:
        print("Movie Master: exporting existing metadata" if args.export_only else "TMDB hydration: skipped (TMDB_READ_TOKEN is not configured)")
        con=sqlite3.connect(args.db)
        ensure_columns(con)
        write_public(con,Path(args.summary) if args.summary else None,Path(args.top) if args.top else None,args.top_limit)
        con.close()
        return

    con=sqlite3.connect(args.db)
    ensure_columns(con)
    rows=select_rows(con,max(1,args.limit),max(1,args.max_attempts))
    started=utcnow()
    ok=0; failed=0; not_found=0
    now=utcnow()

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,args.workers)) as pool:
        futures=[pool.submit(hydrate_one,row,token,max(0,args.min_interval)) for row in rows]
        for future in concurrent.futures.as_completed(futures):
            pendar_id,data,error=future.result()
            if data:
                con.execute(
                    """
                    UPDATE titles SET
                      original_title=COALESCE(?,original_title),
                      title_fa=?,title_en=?,release_date=?,year=?,
                      overview_fa=?,overview_en=?,poster_path=?,backdrop_path=?,
                      runtime_min=?,status=?,original_language=?,origin_country_json=?,
                      genres_json=?,credits_json=?,translations_json=?,
                      imdb_id=?,wikidata_qid=?,tmdb_payload_json=?,
                      hydrated=1,hydrated_at=?,hydrate_attempted_at=?,
                      hydrate_attempts=COALESCE(hydrate_attempts,0)+1,hydrate_error=NULL
                    WHERE pendar_id=?
                    """,
                    (
                        data["original_title"],data["title_fa"],data["title_en"],
                        data["release_date"],data["year"],data["overview_fa"],data["overview_en"],
                        data["poster_path"],data["backdrop_path"],data["runtime_min"],data["status"],
                        data["original_language"],data["origin_country_json"],data["genres_json"],
                        data["credits_json"],data["translations_json"],data["imdb_id"],data["wikidata_qid"],data["tmdb_payload_json"],
                        now,now,pendar_id,
                    )
                )
                ok+=1
            else:
                con.execute(
                    """
                    UPDATE titles SET hydrate_attempted_at=?,
                      hydrate_attempts=COALESCE(hydrate_attempts,0)+1,hydrate_error=?
                    WHERE pendar_id=?
                    """,(now,error,pendar_id)
                )
                failed+=1
                if error=="404": not_found+=1
            if (ok+failed)%100==0:
                con.commit()
                print("Hydration progress:",ok+failed,"/",len(rows),"ok",ok,"failed",failed)

    con.commit()
    write_public(
        con,
        Path(args.summary) if args.summary else None,
        Path(args.top) if args.top else None,
        max(100,min(args.top_limit,20000)),
    )
    total_hydrated=con.execute("SELECT COUNT(*) FROM titles WHERE active=1 AND hydrated=1").fetchone()[0]
    with_imdb=con.execute("SELECT COUNT(*) FROM titles WHERE active=1 AND imdb_id IS NOT NULL AND imdb_id<>''").fetchone()[0]
    with_fa=con.execute("SELECT COUNT(*) FROM titles WHERE active=1 AND title_fa IS NOT NULL AND title_fa<>''").fetchone()[0]
    con.close()
    print("TMDB hydration:",json.dumps({
        "started_at":started,"selected":len(rows),"hydrated_this_run":ok,
        "failed_this_run":failed,"not_found":not_found,
        "total_hydrated":total_hydrated,"with_imdb":with_imdb,"with_fa_title":with_fa,
    },ensure_ascii=False))

if __name__=="__main__":
    main()


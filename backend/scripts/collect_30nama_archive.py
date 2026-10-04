#!/usr/bin/env python3
"""Collect public 30nama catalog metadata and merge it into Pendar's movie catalog.

Scope is intentionally limited to public metadata:
- public movie/series page URL and 30nama ID
- title, year, type, public-list provenance
No download links, subscriber-only content, credentials, or media URLs are collected.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

BASE = "https://30nama.com"
USER_AGENT = "Pendar-Metadata/1.0 (+https://nimania.github.io/pendar/)"
TITLE_URL_RE = re.compile(r"^/(movie|series)/(\d+)/([^?#]+)")
YEAR_RE = re.compile(r"(?:^|[-\s])(19\d{2}|20\d{2})(?:$|[-\s])")
NON_WORD_RE = re.compile(r"[^0-9a-zA-Z\u0600-\u06FF]+")
PERSIAN_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789")

PUBLIC_LIST_URLS = [
    *[f"{BASE}/featured?page={page}" for page in range(1, 28)],
    f"{BASE}/toplist/top-movie-30nama",
    f"{BASE}/toplist/top-series-30nama",
    f"{BASE}/toplist/top-movie-imdb",
    f"{BASE}/toplist/top-series-imdb",
]

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def norm(value: str) -> str:
    s = str(value or "").translate(PERSIAN_DIGITS)
    s = s.replace("ي","ی").replace("ى","ی").replace("ك","ک").replace("‌"," ").replace("ـ"," ")
    s = NON_WORD_RE.sub(" ", s).lower()
    return " ".join(s.split()).strip()

def load(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default

def fetch(url: str, timeout: int = 25) -> str:
    req=urllib.request.Request(url,headers={
        "User-Agent":USER_AGENT,
        "Accept":"text/html,application/xhtml+xml",
        "Accept-Language":"fa,en;q=0.8",
    })
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return r.read().decode("utf-8","replace")

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack=[]
        self.items=[]

    def handle_starttag(self,tag,attrs):
        if tag.lower()!="a":
            return
        href=dict(attrs).get("href") or ""
        m=TITLE_URL_RE.match(urllib.parse.urlparse(href).path)
        if not m:
            return
        self.stack.append({
            "href":urllib.parse.urljoin(BASE,href),
            "type":"movie" if m.group(1)=="movie" else "series",
            "id":m.group(2),
            "slug":m.group(3).strip("/"),
            "text":[],
        })

    def handle_data(self,data):
        if self.stack:
            self.stack[-1]["text"].append(data)

    def handle_endtag(self,tag):
        if tag.lower()=="a" and self.stack:
            item=self.stack.pop()
            item["text"]=" ".join(" ".join(item["text"]).split())
            self.items.append(item)

def parse_title_year(item: dict) -> tuple[str,int|None]:
    text=str(item.get("text") or "").strip()
    slug=urllib.parse.unquote(str(item.get("slug") or ""))
    slug_text=slug.replace("-"," ").strip()

    def split_candidate(v: str):
        v=" ".join(v.split()).strip()
        m=re.search(r"\b(19\d{2}|20\d{2})\b\s*$",v)
        if m:
            return v[:m.start()].strip(" -–—|:"),int(m.group(1))
        return v,None

    title,year=split_candidate(text)
    if not title or len(title)<2:
        title,year2=split_candidate(slug_text)
        year=year or year2
    if not title:
        title=slug_text
    return title.strip(),year

def source_name(url: str) -> str:
    p=urllib.parse.urlparse(url)
    if p.path=="/featured":
        q=urllib.parse.parse_qs(p.query)
        return "featured:"+str((q.get("page") or ["1"])[0])
    return p.path.strip("/").replace("/","_") or "home"

def collect_url(url: str) -> list[dict]:
    try:
        html=fetch(url)
    except Exception as exc:
        print("30nama list warning:",url,type(exc).__name__,str(exc)[:100])
        return []
    parser=LinkParser()
    parser.feed(html)
    out=[]
    for raw in parser.items:
        title,year=parse_title_year(raw)
        if not title or len(norm(title))<2:
            continue
        out.append({
            "id":raw["id"],
            "type":raw["type"],
            "title":title,
            "year":year,
            "url":raw["href"],
            "source_list":source_name(url),
        })
    return out

def collect() -> list[dict]:
    merged={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures={pool.submit(collect_url,url):url for url in PUBLIC_LIST_URLS}
        for future in concurrent.futures.as_completed(futures):
            for item in future.result():
                key=(item["type"],item["id"])
                row=merged.get(key)
                if row is None:
                    row=dict(item)
                    row["source_lists"]=[item["source_list"]]
                    row.pop("source_list",None)
                    merged[key]=row
                else:
                    src=item["source_list"]
                    if src not in row["source_lists"]:
                        row["source_lists"].append(src)
                    if not row.get("year") and item.get("year"):
                        row["year"]=item["year"]
                    if len(item.get("title") or "")>len(row.get("title") or ""):
                        row["title"]=item["title"]
    rows=list(merged.values())
    rows.sort(key=lambda x:(x["type"],-(x.get("year") or 0),x["title"]))
    return rows

def year_compatible(a,b) -> bool:
    try:
        aa=int(a); bb=int(b)
    except Exception:
        return True
    return abs(aa-bb)<=1

def movie_aliases(movie: dict) -> set[str]:
    return {
        norm(x) for x in [
            movie.get("title_fa"),movie.get("original_title"),*(movie.get("aliases") or [])
        ] if norm(x)
    }

def find_existing(movies: list[dict], item: dict) -> dict|None:
    wanted=norm(item.get("title"))
    if not wanted:
        return None
    matches=[]
    for movie in movies:
        if movie.get("type") and movie.get("type")!=item.get("type"):
            continue
        if wanted not in movie_aliases(movie):
            continue
        if not year_compatible(movie.get("year"),item.get("year")):
            continue
        matches.append(movie)
    return matches[0] if len(matches)==1 else None

def provider_ref(item: dict) -> dict:
    return {
        "id":str(item["id"]),
        "url":item["url"],
        "direct":False,
        "public_page":True,
        "source_lists":item.get("source_lists") or [],
    }

def new_movie(item: dict,seen_at: str) -> dict:
    return {
        "slug":"30nama-"+str(item["id"]),
        "type":item["type"],
        "title_fa":item["title"],
        "original_title":item["title"],
        "aliases":[item["title"]],
        "year":item.get("year"),
        "country_fa":None,
        "genres_fa":[],
        "runtime_min":None,
        "poster_url":None,
        "overview_fa":"",
        "director":None,
        "cast":[],
        "ratings":{},
        "external":{"30nama":item["url"]},
        "provider_refs":{"30nama":provider_ref(item)},
        "mentions":[],
        "mention_count":0,
        "first_seen_at":seen_at,
        "verification":{
            "level":"provider_catalog",
            "source":"30nama public archive",
            "providers":["30nama"],
        },
    }

def merge_archive(movies_payload: dict,items: list[dict]) -> dict:
    movies=movies_payload.get("movies") if isinstance(movies_payload,dict) else []
    movies=movies if isinstance(movies,list) else []
    seen_at=now_iso()
    linked=0
    added=0
    ambiguous=0

    for item in items:
        existing=find_existing(movies,item)
        if existing:
            existing.setdefault("provider_refs",{})["30nama"]=provider_ref(item)
            existing.setdefault("external",{})["30nama"]=item["url"]
            linked+=1
            continue

        # Only add provider-catalog identities when title, type and year are all
        # explicit in the public 30nama listing. This prevents weak slug-only rows.
        if not item.get("year") or not item.get("title"):
            ambiguous+=1
            continue
        movies.append(new_movie(item,seen_at))
        added+=1

    movies_payload["movies"]=movies
    stats=movies_payload.setdefault("catalog_stats",{})
    stats["30nama_public_archive_items"]=len(items)
    stats["30nama_linked_existing"]=linked
    stats["30nama_added"]=added
    stats["30nama_skipped_weak"]=ambiguous
    return movies_payload

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--output",required=True)
    ap.add_argument("--movies")
    ap.add_argument("--movies-js")
    args=ap.parse_args()

    items=collect()
    output={
        "schema_version":1,
        "generated_at":now_iso(),
        "scope":"public metadata lists only; no media/download/subscriber content",
        "source":"30nama.com",
        "items":items,
        "stats":{
            "items":len(items),
            "movies":sum(1 for x in items if x["type"]=="movie"),
            "series":sum(1 for x in items if x["type"]=="series"),
            "lists":len(PUBLIC_LIST_URLS),
        },
    }
    out=Path(args.output)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":")),encoding="utf-8")

    merge_stats={}
    if args.movies:
        mp=Path(args.movies)
        payload=load(mp,{"movies":[]})
        before=len(payload.get("movies") or [])
        payload=merge_archive(payload,items)
        compact=json.dumps(payload,ensure_ascii=False,separators=(",",":"))
        mp.write_text(compact,encoding="utf-8")
        if args.movies_js:
            Path(args.movies_js).write_text("window.__MOVIES_DATA__="+compact+";\n",encoding="utf-8")
        merge_stats={
            "catalog_before":before,
            "catalog_after":len(payload.get("movies") or []),
            **{k:v for k,v in (payload.get("catalog_stats") or {}).items() if k.startswith("30nama_")},
        }

    print("30nama public archive:",json.dumps({**output["stats"],**merge_stats},ensure_ascii=False))

if __name__=="__main__":
    main()

"""Build Pendar's canonical film/series catalog.

Trust order:
1) hand-verified anchor identities;
2) titles exposed by a provider's own public catalog (currently FilmNet);
3) editorial discoveries from Pendar content only after exact Wikidata identity verification.

No fuzzy/unverified title is promoted to the public catalog.
"""
from __future__ import annotations

import concurrent.futures
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ARCHIVE = ROOT / "periodicals" / "archive.json"
PUBLIC_PERIODICALS = ROOT / "public" / "data" / "periodicals.json"
PUBLIC_STORIES = ROOT / "public" / "data" / "stories.json"
PUBLIC_FIGURES = ROOT / "public" / "data" / "figures.json"
OUT = ROOT / "public" / "data" / "movies.json"
OUT_JS = ROOT / "public" / "data" / "movies.js"
CANDIDATES = ROOT / "periodicals" / "movie_candidates.json"
IDENTITY_CACHE = ROOT / "data" / "movie_identity_cache.json"

USER_AGENT = "Pendar-MovieCatalog/2.0 (+https://nimania.github.io/pendar/)"
FILMNET_API = "https://filmnet.ir/api-v2/video-contents"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
MAX_FILMNET_TITLES = 360
MAX_WIKIDATA_CANDIDATES = 180

ANCHORS = [
    {
        "slug": "a-separation-2011",
        "type": "movie",
        "title_fa": "جدایی نادر از سیمین",
        "original_title": "A Separation",
        "aliases": ["جدایی نادر از سیمین", "A Separation", "Jodaeiye Nader az Simin"],
        "year": 2011,
        "country_fa": "ایران",
        "genres_fa": ["درام"],
        "runtime_min": 123,
        "poster_url": "https://image.tmdb.org/t/p/w500/ks7Ba6minvXTMKUa1PR9D9aij7G.jpg",
        "overview_fa": "درامی خانوادگی از اصغر فرهادی درباره جدایی یک زوج و زنجیره‌ای از تصمیم‌های اخلاقی و حقوقی که زندگی چند خانواده را به هم گره می‌زند.",
        "director": {"name_fa": "اصغر فرهادی", "name_en": "Asghar Farhadi"},
        "cast": ["پیمان معادی", "لیلا حاتمی", "ساره بیات", "شهاب حسینی"],
        "ratings": {"imdb": 8.3, "rotten_tomatoes": 99, "metacritic": 95},
        "external": {"tmdb": "https://www.themoviedb.org/movie/60243", "imdb": "https://www.imdb.com/title/tt1832382/"},
        "verification": {"level": "hand_verified", "source": "Pendar"},
    },
    {
        "slug": "persepolis-2007",
        "type": "movie",
        "title_fa": "پرسپولیس",
        "original_title": "Persepolis",
        "aliases": ["پرسپولیس", "Persepolis"],
        "year": 2007,
        "country_fa": "فرانسه / ایران",
        "genres_fa": ["انیمیشن", "زندگینامه", "درام"],
        "runtime_min": 96,
        "poster_url": "https://image.tmdb.org/t/p/w500/aU8i2QAdTyRR1nYb36Gq51xXP8p.jpg",
        "overview_fa": "اقتباسی پویانمایی از رمان گرافیکی مرجان ساتراپی؛ روایتی شخصی از کودکی در ایران، انقلاب، جنگ و مهاجرت.",
        "director": {"name_fa": "مرجان ساتراپی و ونسان پارونو", "name_en": "Marjane Satrapi, Vincent Paronnaud"},
        "cast": ["Chiara Mastroianni", "Catherine Deneuve", "Danielle Darrieux"],
        "ratings": {"imdb": 8.0, "rotten_tomatoes": 96, "metacritic": 90},
        "external": {"tmdb": "https://www.themoviedb.org/movie/2011", "imdb": "https://www.imdb.com/title/tt0808417/"},
        "verification": {"level": "hand_verified", "source": "Pendar"},
    },
    {
        "slug": "the-lives-of-others-2006",
        "type": "movie",
        "title_fa": "زندگی دیگران",
        "original_title": "The Lives of Others",
        "aliases": ["زندگی دیگران", "The Lives of Others", "Das Leben der Anderen"],
        "year": 2006,
        "country_fa": "آلمان",
        "genres_fa": ["درام", "سیاسی", "تاریخی"],
        "runtime_min": 137,
        "poster_url": "https://image.tmdb.org/t/p/w500/5BCyeLJHPcRwhu0YaRqUzw00JJ4.jpg",
        "overview_fa": "داستان یک مأمور اشتازی که مأمور نظارت بر یک نویسنده و شریک زندگی او در آلمان شرقی می‌شود و به‌تدریج نگاهش به مأموریت و نظام تغییر می‌کند.",
        "director": {"name_fa": "فلوریان هنکل فون دونرسمارک", "name_en": "Florian Henckel von Donnersmarck"},
        "cast": ["Ulrich Mühe", "Martina Gedeck", "Sebastian Koch"],
        "ratings": {"imdb": 8.4, "rotten_tomatoes": 92, "metacritic": 89},
        "external": {"tmdb": "https://www.themoviedb.org/movie/582", "imdb": "https://www.imdb.com/title/tt0405094/"},
        "verification": {"level": "hand_verified", "source": "Pendar"},
    },
]

# Direct/common Wikidata instance classes accepted without fuzzy inference.
FILM_CLASSES = {
    "Q11424",   # film
    "Q93204",   # documentary film
    "Q202866",  # animated film
    "Q24869",   # short film
    "Q506240",  # television film
}
SERIES_CLASSES = {
    "Q5398426", # television series
    "Q1259759", # miniseries
}

CANDIDATE_PATTERNS = [
    re.compile(
        r"(?P<kind>فیلم|سریال|مستند|انیمیشن|movie|film|series|documentary)\s*"
        r"(?:با\s+نام|به\s+نام|با\s+عنوان)?\s*[«\"“](?P<title>[^»\"”\n]{2,140})[»\"”]",
        re.I,
    ),
    re.compile(
        r"[«\"“](?P<title>[^»\"”\n]{2,140})[»\"”]\s*"
        r"(?:،|؛|:|-)?\s*(?P<kind>فیلم|سریال|مستند|انیمیشن|movie|film|series|documentary)",
        re.I,
    ),
]


def _norm(value: str) -> str:
    value = (
        str(value or "")
        .replace("ي", "ی").replace("ى", "ی").replace("ك", "ک")
        .replace("‌", " ").replace("ـ", "")
        .lower()
    )
    value = re.sub(r"[^0-9a-z\u0600-\u06ff]+", " ", value, flags=re.I)
    return " ".join(value.split()).strip()


def _slug(value: str) -> str:
    s = _norm(value)
    s = re.sub(r"\s+", "-", s).strip("-")
    return s[:72] or "title"


def _load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _fetch_json(url: str, timeout: int = 25):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json,*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8-sig"))


def _load_archive() -> list[dict]:
    public = _load_json(PUBLIC_PERIODICALS, [])
    archive = _load_json(ARCHIVE, [])
    out, seen = [], set()
    for row in list(public if isinstance(public, list) else []) + list(archive if isinstance(archive, list) else []):
        key = str(row.get("id") or row.get("source_url") or row.get("article_url") or "")
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        out.append(row)
    return out


def _load_stories() -> list[dict]:
    rows = _load_json(PUBLIC_STORIES, [])
    return rows if isinstance(rows, list) else []


def _load_figures() -> list[dict]:
    data = _load_json(PUBLIC_FIGURES, {})
    return data.get("figures", []) if isinstance(data, dict) else []


def _article_text(x: dict) -> str:
    return "\n".join(str(v or "") for v in [
        x.get("title_original"), x.get("headline_fa"), x.get("summary_fa"),
        x.get("body_fa"), " ".join(x.get("key_points_fa") or []),
    ])


def _story_text(x: dict) -> str:
    return "\n".join(str(v or "") for v in [
        x.get("headline_fa"), x.get("summary_fa"), x.get("what_happened_fa"),
    ])


def _post_text(p: dict) -> str:
    return "\n".join(str(v or "") for v in [p.get("topic_fa"), p.get("summary_fa")])


def _press_mention(x: dict) -> dict:
    return {
        "kind": "press",
        "source_name": x.get("publisher") or "منبع",
        "article_id": x.get("id"),
        "headline_fa": x.get("headline_fa") or x.get("title_original") or "",
        "summary_fa": x.get("summary_fa") or "",
        "url": x.get("source_url") or x.get("article_url") or x.get("telegram_post_url"),
        "published_at": x.get("source_published_at") or x.get("published_at"),
    }


def _story_mention(x: dict) -> dict:
    return {
        "kind": "news",
        "source_name": "خط خبری",
        "story_id": x.get("id"),
        "headline_fa": x.get("headline_fa") or "",
        "summary_fa": x.get("summary_fa") or "",
        "published_at": x.get("published_at"),
    }


def _figure_mention(person: dict, post: dict) -> dict:
    return {
        "kind": "figure",
        "source_name": person.get("name_fa") or "چهره",
        "handle": person.get("handle"),
        "post_id": post.get("id"),
        "headline_fa": post.get("topic_fa") or ("گفتهٔ " + (person.get("name_fa") or "چهره")),
        "summary_fa": post.get("summary_fa") or "",
        "url": post.get("url"),
        "published_at": post.get("published_at"),
    }


def _sources() -> list[dict]:
    out = []
    for x in _load_archive():
        out.append({"kind": "press", "text": _article_text(x), "mention": _press_mention(x)})
    for x in _load_stories():
        out.append({"kind": "news", "text": _story_text(x), "mention": _story_mention(x)})
    for person in _load_figures():
        for post in person.get("posts") or []:
            text = _post_text(post)
            if text.strip():
                out.append({"kind": "figure", "text": text, "mention": _figure_mention(person, post)})
    return out


def _contains_alias(text: str, aliases: list[str]) -> bool:
    hay = _norm(text)
    for alias in aliases:
        needle = _norm(alias)
        if len(needle) >= 3 and needle in hay:
            return True
    return False


def _dedupe_mentions(rows: list[dict]) -> list[dict]:
    out, seen = [], set()
    for row in rows:
        key = str(row.get("article_id") or row.get("story_id") or row.get("post_id") or row.get("url") or "")
        if key and key in seen:
            continue
        if key:
            seen.add(key)
        out.append(row)
    return out


def _candidate_kind(kind: str) -> str:
    k = _norm(kind)
    if k in {"سریال", "series"}:
        return "series"
    return "movie"


def discover_candidates(sources: list[dict]) -> list[dict]:
    candidates: dict[str, dict] = {}
    for src in sources:
        for pattern in CANDIDATE_PATTERNS:
            for match in pattern.finditer(src["text"]):
                title = match.group("title").strip(" .،؛:-")
                key = _norm(title)
                if len(key) < 2 or len(key) > 120:
                    continue
                row = candidates.setdefault(key, {
                    "title": title,
                    "type_hint": _candidate_kind(match.group("kind")),
                    "status": "candidate",
                    "mentions": [],
                    "source_kinds": [],
                })
                row["mentions"].append(src["mention"])
                if src["kind"] not in row["source_kinds"]:
                    row["source_kinds"].append(src["kind"])
    for row in candidates.values():
        row["mentions"] = _dedupe_mentions(row["mentions"])
        row["mention_count"] = len(row["mentions"])
    return sorted(
        candidates.values(),
        key=lambda x: (-len(x["source_kinds"]), -x["mention_count"], x["title"]),
    )


def _category_values(x: dict, wanted: str) -> list[str]:
    out = []
    for cat in x.get("categories") or []:
        if not isinstance(cat, dict) or str(cat.get("type") or "").lower() != wanted:
            continue
        for item in cat.get("items") or []:
            title = item.get("title") if isinstance(item, dict) else None
            if title and title not in out:
                out.append(str(title))
    return out


def fetch_filmnet_catalog(limit: int = MAX_FILMNET_TITLES) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    count = 24
    failures = 0
    while len(rows) < limit and failures < 2:
        query = urllib.parse.urlencode([
            ("offset", str(offset)),
            ("count", str(count)),
            ("order", "latest"),
            ("query", ""),
            ("types", "single_video"),
            ("types", "series"),
        ])
        try:
            payload = _fetch_json(FILMNET_API + "?" + query)
        except Exception as exc:
            failures += 1
            print("FilmNet catalog warning:", type(exc).__name__, str(exc)[:120])
            offset += count
            continue
        batch = payload.get("data") if isinstance(payload, dict) else []
        if not isinstance(batch, list) or not batch:
            break
        failures = 0
        for x in batch:
            if not isinstance(x, dict):
                continue
            title = str(x.get("title") or "").strip()
            short_id = x.get("short_id")
            provider_slug = x.get("slug")
            if not title or not short_id or not provider_slug:
                continue
            original = str(x.get("original_name") or x.get("original_title") or "").strip()
            aliases = [title] + ([original] if original and _norm(original) != _norm(title) else [])
            cover = x.get("cover_image")
            if isinstance(cover, dict):
                cover = cover.get("path")
            year = x.get("year")
            try:
                year = int(year) if year is not None else None
            except Exception:
                year = None
            typ = "series" if str(x.get("type") or "") == "series" else "movie"
            url = f"https://filmnet.ir/contents/{short_id}/{provider_slug}"
            rows.append({
                "slug": "filmnet-" + str(short_id),
                "type": typ,
                "title_fa": title,
                "original_title": original or None,
                "aliases": aliases,
                "year": year,
                "country_fa": " / ".join(_category_values(x, "territory")) or None,
                "genres_fa": _category_values(x, "genre"),
                "runtime_min": round(float(x["duration"]) / 60) if isinstance(x.get("duration"), (int, float)) and x.get("duration") else None,
                "poster_url": cover,
                "overview_fa": x.get("summary") or "",
                "director": None,
                "cast": [],
                "ratings": {},
                "external": {},
                "provider_refs": {
                    "filmnet": {
                        "id": str(x.get("id") or ""),
                        "short_id": str(short_id),
                        "slug": str(provider_slug),
                        "url": url,
                    }
                },
                "verification": {"level": "provider_catalog", "source": "FilmNet"},
            })
            if len(rows) >= limit:
                break
        offset += count
        if len(batch) < count:
            break
    print("FilmNet catalog:", len(rows), "titles")
    return rows


def _claim_ids(entity: dict, prop: str) -> list[str]:
    out = []
    for claim in (entity.get("claims") or {}).get(prop) or []:
        try:
            value = claim["mainsnak"]["datavalue"]["value"]
            if isinstance(value, dict) and value.get("id"):
                out.append(value["id"])
        except Exception:
            pass
    return out


def _claim_string(entity: dict, prop: str) -> str | None:
    for claim in (entity.get("claims") or {}).get(prop) or []:
        try:
            value = claim["mainsnak"]["datavalue"]["value"]
            if isinstance(value, str) and value:
                return value
        except Exception:
            pass
    return None


def _claim_year(entity: dict) -> int | None:
    for claim in (entity.get("claims") or {}).get("P577") or []:
        try:
            value = claim["mainsnak"]["datavalue"]["value"]
            raw = value.get("time")
            m = re.match(r"^[+-](\d{4,})-", raw or "")
            if m:
                return int(m.group(1))
        except Exception:
            pass
    return None


def _label(entity: dict, lang: str) -> str:
    return (((entity.get("labels") or {}).get(lang) or {}).get("value") or "").strip()


def _aliases(entity: dict, lang: str) -> list[str]:
    return [str(x.get("value") or "").strip() for x in (entity.get("aliases") or {}).get(lang) or [] if x.get("value")]


def _wikidata_get_entity(qid: str) -> dict | None:
    params = urllib.parse.urlencode({
        "action": "wbgetentities",
        "format": "json",
        "ids": qid,
        "props": "labels|aliases|claims",
        "languages": "fa|en",
        "languagefallback": "1",
    })
    payload = _fetch_json(WIKIDATA_API + "?" + params)
    return (payload.get("entities") or {}).get(qid)


def _wikidata_search(title: str, lang: str) -> list[str]:
    params = urllib.parse.urlencode({
        "action": "wbsearchentities",
        "format": "json",
        "search": title,
        "language": lang,
        "uselang": lang,
        "type": "item",
        "limit": 8,
    })
    payload = _fetch_json(WIKIDATA_API + "?" + params)
    return [x.get("id") for x in payload.get("search") or [] if x.get("id")]


def verify_candidate(candidate: dict, cache: dict) -> dict:
    key = _norm(candidate["title"])
    cached = cache.get(key)
    if isinstance(cached, dict) and cached.get("status") in {"verified", "ambiguous", "not_found"}:
        return cached

    title = candidate["title"]
    lang = "fa" if re.search(r"[\u0600-\u06ff]", title) else "en"
    try:
        ids = _wikidata_search(title, lang)
        if lang != "en" and len(ids) < 3:
            ids += [x for x in _wikidata_search(title, "en") if x not in ids]
    except Exception as exc:
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}

    valid = []
    wanted = key
    for qid in ids[:10]:
        try:
            entity = _wikidata_get_entity(qid)
        except Exception:
            continue
        if not entity:
            continue
        p31 = set(_claim_ids(entity, "P31"))
        typ = "series" if p31 & SERIES_CLASSES else "movie" if p31 & FILM_CLASSES else None
        if not typ:
            continue
        names = [_label(entity, "fa"), _label(entity, "en"), *_aliases(entity, "fa"), *_aliases(entity, "en")]
        if wanted not in {_norm(x) for x in names if x}:
            continue
        if candidate.get("type_hint") and candidate["type_hint"] != typ:
            continue
        valid.append((qid, typ, entity, names))

    if len(valid) != 1:
        result = {"status": "ambiguous" if len(valid) > 1 else "not_found", "matches": [x[0] for x in valid]}
        cache[key] = result
        return result

    qid, typ, entity, names = valid[0]
    fa = _label(entity, "fa") or title
    en = _label(entity, "en")
    aliases = []
    for name in [fa, en, *names]:
        if name and _norm(name) not in {_norm(x) for x in aliases}:
            aliases.append(name)

    imdb = _claim_string(entity, "P345")
    image = _claim_string(entity, "P18")
    poster = None
    if image:
        poster = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(image) + "?width=500"

    result = {
        "status": "verified",
        "movie": {
            "slug": "wikidata-" + qid.lower(),
            "type": typ,
            "title_fa": fa,
            "original_title": en or None,
            "aliases": aliases[:30],
            "year": _claim_year(entity),
            "country_fa": None,
            "genres_fa": [],
            "runtime_min": None,
            "poster_url": poster,
            "overview_fa": "",
            "director": None,
            "cast": [],
            "ratings": {},
            "external": {
                "wikidata": "https://www.wikidata.org/wiki/" + qid,
                **({"imdb": "https://www.imdb.com/title/" + imdb + "/"} if imdb else {}),
            },
            "verification": {"level": "wikidata_exact", "source": "Wikidata", "qid": qid},
        },
    }
    cache[key] = result
    return result


def _same_identity(a: dict, b: dict) -> bool:
    aa = {_norm(x) for x in (a.get("aliases") or []) + [a.get("title_fa"), a.get("original_title")] if x}
    bb = {_norm(x) for x in (b.get("aliases") or []) + [b.get("title_fa"), b.get("original_title")] if x}
    if not aa.intersection(bb):
        return False
    ay, by = a.get("year"), b.get("year")
    if ay and by and abs(int(ay) - int(by)) > 1:
        return False
    if a.get("type") and b.get("type") and a["type"] != b["type"]:
        return False
    return True


def _merge_movie(base: dict, incoming: dict) -> dict:
    out = json.loads(json.dumps(base, ensure_ascii=False))
    aliases = []
    for x in (base.get("aliases") or []) + [base.get("title_fa"), base.get("original_title")] + (incoming.get("aliases") or []) + [incoming.get("title_fa"), incoming.get("original_title")]:
        if x and _norm(x) not in {_norm(y) for y in aliases}:
            aliases.append(x)
    out["aliases"] = aliases
    for key in ("poster_url", "overview_fa", "country_fa", "runtime_min", "original_title", "year"):
        if not out.get(key) and incoming.get(key):
            out[key] = incoming[key]
    if not out.get("genres_fa") and incoming.get("genres_fa"):
        out["genres_fa"] = incoming["genres_fa"]
    out.setdefault("provider_refs", {}).update(incoming.get("provider_refs") or {})
    out.setdefault("external", {}).update(incoming.get("external") or {})
    return out


def add_deduped(public: list[dict], movie: dict) -> None:
    for i, current in enumerate(public):
        if _same_identity(current, movie):
            public[i] = _merge_movie(current, movie)
            return
    public.append(movie)


def attach_mentions(public: list[dict], sources: list[dict]) -> None:
    for movie in public:
        aliases = [x for x in (movie.get("aliases") or [movie.get("title_fa"), movie.get("original_title")]) if x]
        mentions = [src["mention"] for src in sources if _contains_alias(src["text"], aliases)]
        movie["mentions"] = _dedupe_mentions(mentions)
        movie["mention_count"] = len(movie["mentions"])


def build() -> dict:
    sources = _sources()
    candidates = discover_candidates(sources)

    public: list[dict] = []
    for raw in ANCHORS:
        add_deduped(public, raw)

    provider_rows = fetch_filmnet_catalog()
    for movie in provider_rows:
        add_deduped(public, movie)

    cache = _load_json(IDENTITY_CACHE, {})
    if not isinstance(cache, dict):
        cache = {}
    verify_rows = candidates[:MAX_WIKIDATA_CANDIDATES]
    verified = []

    def task(cand):
        return cand, verify_candidate(cand, cache)

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(task, cand) for cand in verify_rows]
        for future in concurrent.futures.as_completed(futures):
            try:
                cand, result = future.result()
            except Exception:
                continue
            cand["identity_status"] = result.get("status")
            if result.get("status") == "verified" and result.get("movie"):
                movie = result["movie"]
                movie["editorial_discovery"] = {
                    "title": cand["title"],
                    "mention_count": cand["mention_count"],
                    "source_kinds": cand["source_kinds"],
                }
                add_deduped(public, movie)
                verified.append(movie)

    _write_json(IDENTITY_CACHE, cache)
    attach_mentions(public, sources)

    public.sort(key=lambda x: (
        -int(bool((x.get("provider_refs") or {}).get("filmnet"))),
        -int(x.get("mention_count") or 0),
        -int(x.get("year") or 0),
        x.get("title_fa") or "",
    ))

    CANDIDATES.parent.mkdir(parents=True, exist_ok=True)
    _write_json(CANDIDATES, candidates)

    payload = {
        "movies": public,
        "catalog_stats": {
            "published": len(public),
            "anchor_titles": len(ANCHORS),
            "filmnet_catalog_titles": len(provider_rows),
            "editorial_candidates": len(candidates),
            "wikidata_checked": len(verify_rows),
            "wikidata_verified": len(verified),
        },
        "candidate_count": len(candidates),
        "candidate_sources": {
            "press": sum(1 for x in sources if x["kind"] == "press"),
            "news": sum(1 for x in sources if x["kind"] == "news"),
            "figure": sum(1 for x in sources if x["kind"] == "figure"),
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(compact, encoding="utf-8")
    OUT_JS.write_text("window.__MOVIES_DATA__=" + compact + ";\n", encoding="utf-8")
    print(
        "movies:",
        "published", len(public),
        "| filmnet", len(provider_rows),
        "| candidates", len(candidates),
        "| wikidata verified", len(verified),
        "| mentions", sum(x.get("mention_count", 0) for x in public),
    )
    return payload


if __name__ == "__main__":
    build()

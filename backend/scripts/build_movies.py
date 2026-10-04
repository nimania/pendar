"""Build the Jan Kalam film/series knowledge layer.

Evidence-first rules:
- discover broad movie/series candidates from press, news and figure posts;
- publish only identities present in the verified registry;
- attach every exact/alias mention from Jan Kalam content;
- keep unverified discoveries in a private diagnostic queue.
"""
from __future__ import annotations

import json
import re
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

MOVIES = [
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
    },
]

CANDIDATE_RE = re.compile(
    r"(?:فیلم|سریال|مستند|انیمیشن|movie|film|series|documentary)\s*"
    r"(?:با\s+نام|به\s+نام|با\s+عنوان)?\s*[«\"“](?P<title>[^»\"”\n]{2,140})[»\"”]",
    re.I,
)


def _norm(value: str) -> str:
    return " ".join(
        str(value or "")
        .replace("ي", "ی").replace("ى", "ی").replace("ك", "ک")
        .replace("‌", " ").replace("ـ", "")
        .lower().split()
    ).strip()


def _load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


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
    hay = " " + _norm(text) + " "
    for alias in aliases:
        needle = _norm(alias)
        if len(needle) < 3:
            continue
        if " " + needle + " " in hay:
            return True
        # Persian punctuation often touches titles.
        if needle in _norm(text):
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


def build() -> dict:
    sources = _sources()

    # Broad diagnostic discovery: never automatically becomes a public movie.
    candidates: dict[str, dict] = {}
    for src in sources:
        for match in CANDIDATE_RE.finditer(src["text"]):
            title = match.group("title").strip()
            key = _norm(title)
            if len(key) < 2:
                continue
            row = candidates.setdefault(key, {
                "title": title, "status": "candidate", "mentions": [], "source_kinds": [],
            })
            row["mentions"].append(src["mention"])
            if src["kind"] not in row["source_kinds"]:
                row["source_kinds"].append(src["kind"])

    public = []
    for raw in MOVIES:
        movie = json.loads(json.dumps(raw, ensure_ascii=False))
        aliases = movie.get("aliases") or [movie.get("title_fa"), movie.get("original_title")]
        mentions = []
        for src in sources:
            if _contains_alias(src["text"], [x for x in aliases if x]):
                mentions.append(src["mention"])
        movie["mentions"] = _dedupe_mentions(mentions)
        movie["mention_count"] = len(movie["mentions"])
        public.append(movie)

    public.sort(key=lambda x: (-int(x.get("mention_count") or 0), -int(x.get("year") or 0), x.get("title_fa") or ""))

    CANDIDATES.parent.mkdir(parents=True, exist_ok=True)
    CANDIDATES.write_text(json.dumps(list(candidates.values()), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    payload = {
        "movies": public,
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
    print("movies: published %d verified titles, %d candidate titles, %d mentions" % (
        len(public), len(candidates), sum(x["mention_count"] for x in public)
    ))
    return payload


if __name__ == "__main__":
    build()

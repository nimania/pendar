"""Build three reviewable Radar assets from ONE approved editorial dossier.

No network or publishing side effects. Usage:
python backend/scripts/package_radar_daily.py dossier.json --out /tmp/radar-package --wpm 130
"""
from __future__ import annotations
import argparse
from datetime import date
from html import escape
import json
from pathlib import Path
import re
from urllib.parse import urlparse

AUTHOR_NAME_FA = "نیما افشارنادری"
AUTHOR_NAME_EN = "Nima Afshar Naderi"
AUTHOR_PROFILE = "https://pendar.io/@nima-afshar-naderi"
# Same publicly listed portrait as the Pendar figures profile fallback.
AUTHOR_AVATAR = "https://pbs.twimg.com/profile_images/2094137144591933440/SIBK8HjF_400x400.jpg"

SECTIONS = ("نقشهٔ امروز", "جان کلام", "فردا چه چیزی را زیر نظر بگیریم")
WORD = re.compile(r"[^\W_]+(?:[‌'’][^\W_]+)*", re.UNICODE)

def valid_url(value):
    p = urlparse(str(value))
    return p.scheme == "https" and bool(p.netloc) and not p.username and not p.password

def check(data, wpm):
    failures = []
    if data.get("status") != "approved":
        failures.append("status must be approved; drafts are never packaged")
    day = str(data.get("date", ""))
    try:
        if date.fromisoformat(day).isoformat() != day:
            failures.append("date must be ISO YYYY-MM-DD")
    except ValueError:
        failures.append("invalid ISO date")
    slug = str(data.get("slug", ""))
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
        failures.append("unsafe or invalid slug")
    for key in ("report_id", "headline_fa", "summary_fa", "headline_en", "summary_en",
                "article_fa", "article_en", "narration_fa"):
        if not isinstance(data.get(key), str) or not data[key].strip():
            failures.append("missing " + key)
    sources = data.get("sources")
    if not isinstance(sources, list) or len(sources) < 2:
        failures.append("at least two independently reviewed source records required")
    else:
        for source in sources:
            if not isinstance(source, dict) or not valid_url(source.get("url")) or not source.get("title") or not source.get("published_at"):
                failures.append("each source needs HTTPS URL, title and published_at")
    script = str(data.get("narration_fa", ""))
    count = len(WORD.findall(script))
    secs = round(count / wpm * 60)
    if secs < 480:
        failures.append("estimated spoken narration below eight minutes")
    for section in SECTIONS:
        if section not in script:
            failures.append("missing narration section: " + section)
    return failures, count, secs

def article_html(data, language):
    fa = language == "fa"
    title = data["headline_fa" if fa else "headline_en"]
    summary = data["summary_fa" if fa else "summary_en"]
    article = data["article_fa" if fa else "article_en"]
    # Plain text paragraphs prevent injected HTML/JS in authored dossier.
    paragraphs = "".join("<p>" + escape(p.strip()) + "</p>" for p in re.split(r"\n\s*\n", article) if p.strip())
    links = "".join('<li><a href="' + escape(s["url"], quote=True) + '" rel="noopener noreferrer">' + escape(s["title"]) + "</a> · " + escape(str(s["published_at"])) + "</li>" for s in data["sources"])
    author_name = AUTHOR_NAME_FA if fa else AUTHOR_NAME_EN
    byline = ('<div class="byline"><a href="' + escape(AUTHOR_PROFILE, quote=True) +
              '"><img src="' + escape(AUTHOR_AVATAR, quote=True) +
              '" width="52" height="52" alt="' + escape(author_name, quote=True) +
              '" loading="lazy"></a><div><span>' + ('نویسنده: ' if fa else 'By ') +
              '</span><a rel="author" href="' + escape(AUTHOR_PROFILE, quote=True) +
              '">' + escape(author_name) + '</a></div></div>')
    counterpart = ("https://nimania.github.io/IranSignal/daily/" if fa else "https://pendar.io/reports/daily/")
    return ('<!doctype html><html lang="' + language + '" dir="' + ('rtl' if fa else 'ltr') + '"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="author" content="' + escape(author_name, quote=True) + '"><title>' + escape(title) + '</title>'
            '<meta name="description" content="' + escape(summary, quote=True) + '">'
            '<style>body{font:18px/1.85 system-ui,sans-serif;max-width:780px;margin:3rem auto;padding:0 1.25rem;color:#172036}'
            'a{color:#1467a1}h1{line-height:1.3}.byline{display:flex;align-items:center;gap:12px;margin:1rem 0 1.5rem}.byline img{border-radius:50%;object-fit:cover}footer{margin-top:3rem;border-top:1px solid #ccc;padding-top:1rem}</style></head><body>'
            '<main><small>' + escape(data["date"]) + ' · ' + escape(data["report_id"]) + '</small><h1>' + escape(title) + '</h1>' + byline
            '<p><strong>' + escape(summary) + '</strong></p>' + paragraphs + '<h2>' + ('منابع' if fa else 'Sources') + '</h2><ul>' + links + '</ul>'
            '<p><a href="' + counterpart + escape(data["date"]) + '/' + escape(data["slug"]) + '/">' +
            ('English edition' if fa else 'Persian edition') + '</a></p></main><footer>Radar Iran — reviewed editorial publication</footer></body></html>')

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("dossier", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--wpm", type=float, default=130)
    args = ap.parse_args()
    if not 60 <= args.wpm <= 230:
        ap.error("calibrated speaking speed must be between 60 and 230 WPM")
    data = json.loads(args.dossier.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        ap.error("dossier must be a JSON object")
    errors, words, seconds = check(data, args.wpm)
    if errors:
        ap.error("; ".join(errors))
    out = args.out
    out.mkdir(parents=True, exist_ok=True)
    (out / "pendar-article.html").write_text(article_html(data, "fa"), encoding="utf-8")
    (out / "iransignal-article.html").write_text(article_html(data, "en"), encoding="utf-8")
    (out / "youtube-narration-fa.md").write_text(data["narration_fa"] + "\n", encoding="utf-8")
    manifest = {"author": {"name": AUTHOR_NAME_EN, "profile": AUTHOR_PROFILE, "avatar": AUTHOR_AVATAR},
                "date":data["date"],"slug":data["date"] + "/" + data["slug"],
                "title":data["headline_en"],"summary":data["summary_en"],"status":"published"}
    (out / "iransignal-manifest-entry.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2) + "\n",encoding="utf-8")
    (out / "preflight.json").write_text(json.dumps({"report_id":data["report_id"],"words":words,
        "estimated_seconds":seconds,"wpm":args.wpm,
        "warning":"Estimated duration only; record and verify actual narration before YouTube."},indent=2)+"\n",encoding="utf-8")
    print(f"Staged {data['report_id']}: {words} spoken words, {seconds/60:.1f} min estimated; NO auto-publish")

if __name__ == "__main__":
    main()

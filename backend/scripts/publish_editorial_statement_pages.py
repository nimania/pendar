#!/usr/bin/env python3
"""Publish crawlable, source-attributed editorial statements in the light Pages build.

The light deployment intentionally discards bulky cached /statement/ trees.
Only reviewed recaps that are also present in the published figures dataset
are eligible here. Never turn an unpublished recap into a public page.
"""
from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path
from urllib.parse import quote, urlsplit
from xml.etree import ElementTree as ET

ORIGIN = "https://pendar.io"
NAME = "sitemap-editorial-statements.xml"
NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
Q = "{" + NS + "}"
SAFE_ID = re.compile(r"[a-z0-9][a-z0-9-]{2,120}", re.I)
SAFE_HANDLE = re.compile(r"[a-zA-Z0-9_.-]{2,100}")
ET.register_namespace("", NS)


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def page_html(record: dict) -> str:
    item_id = str(record["id"])
    url = f"{ORIGIN}/statement/{quote(item_id, safe='')}/"
    subject = str(record.get("topic_fa") or "بازخوانی دیدگاه")
    speaker = str(record.get("name_fa") or "گوینده")
    title = f"{subject} | {speaker} | پندار"
    summary = " ".join(str(record.get("summary_fa") or "").split())[:170]
    text = str(record["recap_fa"]).strip()
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        raise ValueError(f"Empty statement body: {item_id}")
    body = "\n".join("<p>" + esc(p).replace("\n", "<br>") + "</p>" for p in paragraphs)
    handle = str(record.get("speaker_handle") or "")
    profile = (f"/@{quote(handle, safe='')}/" if SAFE_HANDLE.fullmatch(handle)
               else "/figures/")
    recorded = str(record.get("published_at") or record.get("recorded_at") or "")[:10]
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", recorded):
        recorded = ""
    source = str(record.get("source_name") or "")
    note = str(record.get("source_note_fa") or "")
    source_url = str(record.get("url") or "")
    source_link = (f'<a href="{esc(source_url)}" rel="nofollow noopener">منبع اصلی</a>'
                   if urlsplit(source_url).scheme == "https"
                   and urlsplit(source_url).netloc else "")
    schema = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": subject,
        "description": summary,
        "inLanguage": "fa-IR",
        "url": url,
        "mainEntityOfPage": url,
        "author": {"@type": "Organization", "name": "تحریریه پندار"},
        "publisher": {"@type": "Organization", "name": "پندار", "url": ORIGIN},
        "about": {"@type": "Person", "name": speaker},
    }
    if recorded:
        schema["datePublished"] = recorded
    safe_schema = json.dumps(schema, ensure_ascii=False).replace("<", "\\u003c")
    return f"""<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(summary)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="{esc(url)}">
<meta property="og:type" content="article">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(summary)}">
<meta property="og:url" content="{esc(url)}">
<script type="application/ld+json" id="seo-schema">{safe_schema}</script>
<style>
body{{background:#f4f3ef;color:#252622;margin:0;font:16px/2.1 Vazirmatn,Tahoma,sans-serif}}
header{{background:#2a2928;color:#fff;padding:14px max(20px,calc((100% - 960px)/2))}}
header a{{color:#fff;text-decoration:none;font-weight:700}}
main{{max-width:820px;margin:34px auto;padding:28px;background:#fff;border:1px solid #ddd}}
h1{{font-size:clamp(24px,4vw,35px);line-height:1.6;margin:8px 0 22px}}
p{{margin:0 0 20px;overflow-wrap:anywhere}}
.meta{{color:#65645f;font-size:14px;border-bottom:1px solid #ddd;padding-bottom:16px}}
a{{color:#155a4f}}footer{{border-top:1px solid #ddd;padding-top:15px;font-size:14px}}
@media(max-width:700px){{main{{margin:0;padding:19px;border:0}}}}
</style>
</head>
<body>
<header><a href="/">پندار</a> · <a href="/figures/">چهره‌ها و دیدگاه‌ها</a></header>
<main>
<nav><a href="{esc(profile)}">پروندهٔ {esc(speaker)}</a></nav>
<article>
<h1>{esc(subject)}</h1>
<p class="meta">{esc(speaker)} · {esc(source)}{(' · ' + esc(recorded)) if recorded else ''}</p>
<p><strong>خلاصه:</strong> {esc(summary)}</p>
<section aria-label="متن بازخوانی">
{body}
</section>
<footer><p>{esc(note or 'این مطلب بازخوانی دیدگاه گوینده است، نه تأیید مستقل ادعاها.')}</p>
<p><a href="{esc(profile)}">مطالب بیشتر از {esc(speaker)}</a>{(' · ' + source_link) if source_link else ''}</p></footer>
</article>
</main>
</body>
</html>
"""


def publish(site: Path, source: Path) -> dict:
    site = Path(site)
    recaps = json.loads(Path(source).read_text(encoding="utf-8"))
    figures = json.loads((site / "data/figures.json").read_text(encoding="utf-8"))
    active = {str(post.get("id") or "")
              for figure in figures.get("figures", [])
              for post in figure.get("posts", []) if isinstance(post, dict)}
    if not isinstance(recaps, list):
        raise ValueError("Reviewed editorial recaps must be a list")
    created = []
    skipped = []
    seen = set()
    for record in recaps:
        if not isinstance(record, dict):
            continue
        item_id = str(record.get("id") or "")
        if not SAFE_ID.fullmatch(item_id):
            raise ValueError(f"Unsafe editorial recap id: {item_id!r}")
        if item_id in seen:
            raise ValueError("Duplicate editorial recap id: " + item_id)
        seen.add(item_id)
        if item_id not in active:
            skipped.append(item_id)
            continue
        if len(str(record.get("recap_fa") or "").strip()) < 300:
            raise ValueError("Reviewed recap too short: " + item_id)
        destination = site / "statement" / item_id / "index.html"
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(page_html(record), encoding="utf-8")
        created.append((item_id, str(record.get("published_at") or record.get("recorded_at") or "")[:10]))
    if not created:
        raise RuntimeError("No published editorial statements; refusing empty sitemap")

    sitemap = ET.Element(Q + "urlset")
    for item_id, date in sorted(created):
        node = ET.SubElement(sitemap, Q + "url")
        ET.SubElement(node, Q + "loc").text = f"{ORIGIN}/statement/{item_id}/"
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            ET.SubElement(node, Q + "lastmod").text = date
    ET.ElementTree(sitemap).write(site / NAME, encoding="utf-8", xml_declaration=True)

    index_file = site / "sitemap.xml"
    index = ET.parse(index_file)
    root = index.getroot()
    if root.tag != Q + "sitemapindex":
        raise ValueError("Expected existing sitemap index")
    index_url = ORIGIN + "/" + NAME
    for existing in root.findall(Q + "sitemap"):
        loc = existing.findtext(Q + "loc") or ""
        if loc == index_url:
            root.remove(existing)
    entry = ET.SubElement(root, Q + "sitemap")
    ET.SubElement(entry, Q + "loc").text = index_url
    index.write(index_file, encoding="utf-8", xml_declaration=True)

    # Do not keep advertising /statement/ URLs removed by the light build.
    pruned = 0
    for existing in root.findall(Q + "sitemap"):
        loc = existing.findtext(Q + "loc") or ""
        filename = loc.removeprefix(ORIGIN + "/")
        if not re.fullmatch(r"sitemap-[a-zA-Z0-9-]+\.xml", filename) or filename == NAME:
            continue
        sheet_file = site / filename
        if not sheet_file.is_file():
            continue
        tree = ET.parse(sheet_file)
        sheet = tree.getroot()
        if sheet.tag != Q + "urlset":
            continue
        for node in list(sheet.findall(Q + "url")):
            url = node.findtext(Q + "loc") or ""
            parsed = urlsplit(url)
            if (parsed.scheme, parsed.netloc) != ("https", "pendar.io"):
                continue
            match = re.fullmatch(r"/statement/([a-z0-9-]+)/", parsed.path, re.I)
            if match and not (site / "statement" / match.group(1) / "index.html").is_file():
                sheet.remove(node)
                pruned += 1
        if pruned:
            tree.write(sheet_file, encoding="utf-8", xml_declaration=True)
    report = {"created": len(created), "skipped_unpublished": skipped,
              "removed_missing_statement_sitemap_urls": pruned}
    (site / "data/editorial-statement-seo-audit.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True, type=Path)
    parser.add_argument("--source", required=True, type=Path)
    args = parser.parse_args()
    print("Published editorial statement SEO:", json.dumps(
        publish(args.site, args.source), ensure_ascii=False))

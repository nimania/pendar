#!/usr/bin/env python3
"""Publish a size-bounded pilot of human-readable Pendar news permalinks.

An alias is a real, crawlable static page. UUID URLs remain functional, but
their canonical metadata points to the new permalink. Persist mappings from the
previous Pages artifact so a future title edit cannot move an existing URL.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import unicodedata

ORIGIN = "https://pendar.io"
UUID = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$", re.I)
SAFE_SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9-]{2,75}[a-z0-9])?$")
STOP = set("""در از به با و یا برای روی که یک دو سه این آن است شد شده میشود می‌شود
چه چرا چگونه آیا درباره بر اساس پس پیش آخرین جدید امروز فردا روز روزهای پس از
میان نسبت همچنان احتمال تحلیل بررسی گزارش خبر خبرها گفتگو گفت‌وگو""".split())
WORDS = {
    "ایران":"iran","ایرانی":"iranian","آمریکا":"america","امریکا":"america",
    "ترامپ":"trump","اسرائیل":"israel","نتانیاهو":"netanyahu","جنگ":"war",
    "صلح":"peace","آتش‌بس":"ceasefire","آتشبس":"ceasefire",
    "مذاکرات":"negotiations","مذاکره":"talks","توافق":"agreement",
    "تنگه":"strait","هرمز":"hormuz","اروپا":"europe","چین":"china",
    "روسیه":"russia","ترکیه":"turkey","اقتصاد":"economy","تورم":"inflation",
    "دلار":"dollar","بانک":"bank","بازار":"market","نفت":"oil","گاز":"gas",
    "قیمت":"prices","انتخابات":"elections","دولت":"government",
    "مجلس":"parliament","دیپلماسی":"diplomacy","تحریم":"sanctions",
    "سیاست":"politics","امنیت":"security","بحران":"crisis",
    "هسته‌ای":"nuclear","هسته‌ایِ":"nuclear","مردم":"people",
    "آینده":"future","منطقه":"region","خاورمیانه":"middle-east",
    "آب":"water","هوا":"weather","اقلیم":"climate","فرهنگ":"culture",
    "کتاب":"books","سینما":"cinema","فیلم":"film","سریال":"series",
    "کارگران":"workers","مدرسه":"school","دانشگاه":"university",
    "رییس‌جمهور":"president","رئیس‌جمهور":"president","تحولات":"developments",
}
CHARS = dict(zip(
    "اآبپتثجچحخدذرزژسشصضطظعغفقکگلمنوهیئءؤة",
    ["a","a","b","p","t","s","j","ch","h","kh","d","z","r","z","zh",
     "s","sh","s","z","t","z","","gh","f","gh","k","g","l","m","n","v",
     "h","y","y","","v","h"]))
CHARS.update({"ا":"a","آ":"a","و":"o","ه":"h","ی":"i","ک":"k"})
PUNCT = re.compile(r"[^\w\u0600-\u06ff-]+", re.U)
TITLE_TOKENS = re.compile(r"[\u0600-\u06ffA-Za-z0-9\u200c]+", re.U)


def text(value: object) -> str:
    return str(value or "").strip()


def slugify(title: str) -> str:
    title = unicodedata.normalize("NFKC", title).replace("ي","ی").replace("ك","ک")
    title = re.sub(r"[\u064b-\u065f\u0670\u200f\u200e]", "", title)
    title = title.replace("\u200c", "‌")
    parts = []
    for token in TITLE_TOKENS.findall(title):
        if token in STOP:
            continue
        if token.isascii():
            translated = token.lower()
        else:
            translated = WORDS.get(token)
            if translated is None:
                translated = "".join(CHARS.get(ch,"") for ch in token)
        translated = re.sub(r"[^a-z0-9-]", "", translated).strip("-")
        if translated and (len(translated)>1 or translated.isdigit()):
            parts.append(translated)
        if len(parts)>=7:
            break
    slug = "-".join(parts).strip("-")[:76].rstrip("-")
    return slug if SAFE_SLUG.fullmatch(slug) else ""


def array(data, key):
    return data if isinstance(data, list) else data.get(key, []) if isinstance(data, dict) else []


def read_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def update_html_canonical(content: str, old: str, new: str) -> str:
    # Only canonical metadata and structured-data URL references are rewritten;
    # editorial content, sources, and the readable prerendered article stay intact.
    content = re.sub(r'(<link\b[^>]*\brel="canonical"[^>]*href=")'+re.escape(old)+r'(")',
                     lambda m: m.group(1)+new+m.group(2), content)
    content = re.sub(r'(<meta\b[^>]*\bproperty="og:url"[^>]*content=")'+re.escape(old)+r'(")',
                     lambda m: m.group(1)+new+m.group(2), content)
    # JSON-LD includes canonical main-entity URL as an ordinary JSON string.
    content = content.replace('"url": "'+old+'"', '"url": "'+new+'"')
    content = content.replace('"url":"'+old+'"', '"url":"'+new+'"')
    content = content.replace('"item": "'+old+'"', '"item": "'+new+'"')
    content = content.replace('"item":"'+old+'"', '"item":"'+new+'"')
    return content


def update_seo_json(path: Path, canonical: str):
    if not path.is_file():
        return
    item = read_json(path,{})
    item["canonical"] = canonical
    item.setdefault("tags",{})["og:url"] = canonical
    for node in item.get("schema",{}).get("@graph",[]):
        if isinstance(node,dict):
            if node.get("url") and "/story/" in node["url"]:
                node["url"] = canonical
            if node.get("@type")=="BreadcrumbList":
                for part in node.get("itemListElement",[]):
                    if isinstance(part,dict) and "/story/" in str(part.get("item","")):
                        part["item"] = canonical
    path.write_text(json.dumps(item,ensure_ascii=False),encoding="utf-8")


def run(site: Path, limit: int = 60) -> dict:
    data = site/"data"
    persistent = read_json(data/"story-permalinks.json",{})
    old_map = persistent.get("id_to_slug",{}) if isinstance(persistent,dict) else {}
    used, mapping = set(), {}
    for sid, slug in old_map.items():
        if UUID.fullmatch(sid) and isinstance(slug,str) and SAFE_SLUG.fullmatch(slug) and slug not in used:
            mapping[sid] = slug
            used.add(slug)

    editorial = array(read_json(data/"editorial-archive.json",{}),"reports")
    stories = array(read_json(data/"stories.json",[]),"stories")
    choices = []
    seen = set(mapping)
    for row in editorial + stories:
        if not isinstance(row,dict):
            continue
        sid = text(row.get("id"))
        if sid in seen or not UUID.fullmatch(sid):
            continue
        if row in editorial and row.get("status") not in ("ai_draft","published","live"):
            continue
        seen.add(sid)
        choices.append((sid,row))
    choices.sort(key=lambda entry:text(entry[1].get("published_at")),reverse=True)
    for sid, row in choices:
        if len(mapping)>=limit:
            break
        original = site/"story"/sid/"index.html"
        if not original.is_file():
            continue
        slug = slugify(text(row.get("title_fa") or row.get("editorial_report_title_fa") or row.get("headline_fa")))
        if not slug:
            continue
        if slug in used:
            slug=slug[:67].rstrip("-")+"-"+sid[:7]
        if not SAFE_SLUG.fullmatch(slug) or slug in used:
            continue
        mapping[sid]=slug
        used.add(slug)

    slug_to_id = {slug:sid for sid,slug in mapping.items()}
    effective = {}
    for sid, slug in mapping.items():
        source = site/"story"/sid/"index.html"
        if not source.is_file():
            continue
        old = ORIGIN+"/story/"+sid+"/"
        new = ORIGIN+"/story/"+slug+"/"
        original = source.read_text(encoding="utf-8")
        alias = site/"story"/slug/"index.html"
        alias.parent.mkdir(parents=True,exist_ok=True)
        alias.write_text(update_html_canonical(original,old,new),encoding="utf-8")
        old_html = update_html_canonical(original,old,new)
        if old_html != original:
            source.write_text(old_html,encoding="utf-8")
        old_seo = source.parent/"seo.json"
        if old_seo.is_file():
            update_seo_json(old_seo,new)
            target_seo = alias.parent/"seo.json"
            target_seo.write_bytes(old_seo.read_bytes())
        effective[sid]=slug
    rev={slug:sid for sid,slug in effective.items()}
    payload={"version":1,"id_to_slug":effective,"slug_to_id":rev}
    (data/"story-permalinks.json").write_text(json.dumps(payload,ensure_ascii=False,sort_keys=True),encoding="utf-8")
    js="window.PENDAR_STORY_PERMALINKS="+json.dumps(payload,ensure_ascii=False,separators=(",",":"))+";\n"
    js+="window.pendarStoryURL=function(id){var slug=window.PENDAR_STORY_PERMALINKS.id_to_slug[String(id||'')];return '/story/'+(slug||encodeURIComponent(String(id||'')))+'/';};\n"
    (data/"story-permalinks.js").write_text(js,encoding="utf-8")

    for sitemap in site.glob("sitemap-*.xml"):
        content=sitemap.read_text(encoding="utf-8")
        for sid,slug in effective.items():
            content=content.replace("<loc>"+ORIGIN+"/story/"+sid+"/</loc>",
                                    "<loc>"+ORIGIN+"/story/"+slug+"/</loc>")
        sitemap.write_text(content,encoding="utf-8")
    print(f"Story permalinks: {len(effective)} readable aliases, UUID routes preserved")
    return payload


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--site",type=Path,default=Path("site"))
    parser.add_argument("--limit",type=int,default=60)
    args=parser.parse_args()
    run(args.site,args.limit)

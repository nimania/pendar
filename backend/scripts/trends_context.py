"""Grounded coverage for monitored trends, without empty person/place/event shells.

Coverage is sourced from locally published Pendar stories and the specific
Google Trends news items attached to the matching term. Plain mentions alone
never assert that a story is *caused* by a search spike.
"""
from __future__ import annotations
import json,re,html,unicodedata
from pathlib import Path
from urllib.parse import urlsplit

def norm(value):
    s=unicodedata.normalize("NFKC",str(value or "")).replace("ي","ی").replace("ك","ک").replace("\u200c"," ")
    return re.sub(r"\s+"," ",s).strip().lower()

def includes(text,phrase):
    hay,needle=norm(text),norm(phrase)
    if not needle or len(needle)<3:return False
    return re.search(r"(?<![\w\u0600-\u06ff])"+re.escape(needle)+r"(?![\w\u0600-\u06ff])",hay) is not None

def source_news(briefs, keyword, limit=6):
    results=[];seen=set()
    for brief in briefs:
        if not isinstance(brief,dict):continue
        term=str(brief.get("trend_keyword") or "")
        if not (includes(term,keyword) or includes(keyword,term)):continue
        for row in brief.get("related_news",[])[:6]:
            if not isinstance(row,dict):continue
            url=str(row.get("url") or "")
            h=str(row.get("headline") or "").strip()
            p=urlsplit(url)
            if p.scheme!="https" or not p.hostname or not h or url in seen:continue
            seen.add(url)
            results.append({"url":url,"title":h,"source":row.get("publisher") or p.hostname,"kind":"external"})
            if len(results)>=limit:return results
    return results

def pendar_coverage(site, keyword, limit=12):
    file=Path(site)/"data"/"stories.json"
    if not file.is_file():return []
    try:rows=json.loads(file.read_text(encoding="utf-8"))
    except (OSError,ValueError):return []
    if isinstance(rows,dict):rows=rows.get("stories") or rows.get("items") or []
    if not isinstance(rows,list):return []
    results=[];seen=set()
    for row in rows:
        if not isinstance(row,dict):continue
        sid=str(row.get("id") or "")
        if not re.fullmatch(r"[0-9a-fA-F-]{36}",sid):continue
        title=str(row.get("headline_fa") or row.get("title_fa") or "")
        intro=str(row.get("summary_fa") or row.get("lead_fa") or "")
        if not includes(title,keyword) and not includes(intro,keyword):continue
        if sid in seen:continue
        seen.add(sid)
        results.append({"url":"/story/"+sid+"/","title":title,
                        "summary":intro[:220],"date":row.get("published_at") or "",
                        "kind":"pendar"})
    results.sort(key=lambda x:x["date"],reverse=True)
    return results[:limit]

def report_coverage(articles, keyword, limit=6):
    results=[]
    for article in articles:
        if not isinstance(article,dict):continue
        title=str(article.get("title") or "")
        term=str(article.get("trend_keyword") or "")
        location_hit=keyword in (article.get("locations") or [])
        if includes(title,keyword) or includes(str(article.get("lead_fa") or ""),keyword) or location_hit or includes(term,keyword) or includes(keyword,term):
            if article.get("url"):results.append({"url":article["url"],"title":title,
                "summary":article.get("lead_fa") or "","kind":"pendar"})
    return results[:limit]

def context_content(site,entity,briefs,articles):
    # For people, use the selected person's actual name rather than terms like
    # "احمدینژاد" or "جست‌وجوی احمد آرام در گوگل".
    label=str(entity.get("name") or entity["label"])
    keyword=label
    trend_keyword=str(entity.get("trend_keyword") or "")
    internal=pendar_coverage(site,keyword)
    matched=report_coverage(articles,keyword)
    outside=source_news(briefs,trend_keyword or keyword)
    # No shallow destinations: only a source-backed record can be promoted.
    unique=[];seen=set()
    for item in matched+internal+outside:
        if item["url"] not in seen:
            unique.append(item);seen.add(item["url"])
    return unique

def register_verified_person(site,entity):
    """Make source-identified people discoverable in Pendar's native figure feed.

    Do not create identities from unchecked keywords; only the small curated
    KNOWN_PEOPLE catalog reaches this branch, and no account is marked verified.
    """
    if entity.get("kind")!="person" or entity.get("existing"):return
    from trends_topics import KNOWN_PEOPLE
    record=entity.get("record") or {}
    if not any(record.get("slug")==p.get("slug") and record.get("source")==p.get("source")
               for p in KNOWN_PEOPLE.values()):
        return
    file=Path(site)/"data"/"figures.json"
    if not file.is_file():return
    try:data=json.loads(file.read_text(encoding="utf-8"))
    except (OSError,ValueError):return
    if not isinstance(data,dict) or not isinstance(data.get("figures"),list):return
    handle=record.get("slug")
    if any(str(p.get("handle") or "").casefold()==handle.casefold() for p in data["figures"]):
        return
    data["figures"].append({
        "handle":handle,"name_fa":record.get("name") or entity["label"],
        "role_fa":record.get("description") or "",
        "bio_fa":record.get("description") or "",
        "aliases":[],"posts":[],"avatar":"","verified":False,"directory":True,
        "profile_source_url":record["source"],
    })
    file.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")

def render_context(site,entity,briefs,articles):
    from trends_magazine import magazine_shell,e
    url=entity["url"]
    target=Path(site)/url.lstrip("/")/"index.html"
    if entity.get("existing"):return True
    if entity.get("kind") not in ("person","event","country","province","city"):return False
    # Respect independently existing profile pages. Only replace our own
    # previously-generated empty shells.
    if target.is_file():
        previous=target.read_text(encoding="utf-8")
        is_ours=("PENDAR_TRENDS_CONTEXT_V2" in previous or
                "پروندهٔ این چهره در پندار در حال تکمیل" in previous or
                "صفحه ساختار اولیهٔ «نشانی»" in previous or
                "صفحه برای پیوند دادن گزارش‌های یک ماجرا" in previous or
                'data-pendar-context="v2"' in previous)
        if not is_ours:return True
    items=context_content(site,entity,briefs,articles)
    # A sourced person/place landing with at least one Pendar report is useful;
    # for other pages retain the stricter two-item threshold.
    enough=(len(items)>=2 or (entity.get("kind") in {"person","city","province","country"}
           and any(x.get("kind")=="pendar" for x in items)))
    if not enough:
        # Older low-value pages must stop inviting visits. They remain a
        # non-indexed route back to the source section, not a fake dossier.
        if target.is_file():
            target.write_text('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=/trends/"><link rel="canonical" href="https://pendar.io/trends/"></head><body><a href="/trends/">ترندهای امروز</a></body></html>',encoding="utf-8")
        return False
    kind=entity["kind"]
    kinds={"person":"چهره‌ها","event":"ماجرا","country":"نشانی","province":"نشانی","city":"نشانی"}
    label=str(entity.get("name") or entity["label"])
    intro={"person":str(entity.get("record",{}).get("description") or ""),
           "event":"تازه‌ترین خبرها و گزارش‌های مرتبط با این ماجرا در پندار",
           "country":"خبرها و گزارش‌های مرتبط با "+label,
           "province":"خبرها و گزارش‌های مرتبط با "+label,
           "city":"خبرها و گزارش‌های مرتبط با "+label}[kind]
    body='<div data-pendar-context="v2"><!-- PENDAR_TRENDS_CONTEXT_V2 -->'
    body+='<div class="magazine-article-kicker">'+e(kinds[kind])+'</div><h1>'+e(label)+'</h1>'
    if intro:body+='<p class="magazine-article-lead">'+e(intro)+'</p>'
    if kind=="person":
        handle=url.strip("/").removeprefix("@")
        if re.fullmatch(r"[a-z0-9_.-]{2,90}",handle):
            body+='<button type="button" hidden class="trend-follow-button" data-trend-figure-follow="'+e(handle)+'" aria-pressed="false">+ دنبال کن</button>'
    pendar=[x for x in items if x["kind"]=="pendar"]
    external=[x for x in items if x["kind"]=="external"]
    if pendar:
        body+='<section class="trend-index-section"><h2>در پندار</h2><div class="trend-index-grid">'
        for item in pendar[:8]:
            body+='<a class="trend-index-item" href="'+e(item["url"])+'"><strong>'+e(item["title"])+'</strong>'
            if item.get("summary"):body+='<p>'+e(item["summary"][:160])+'</p>'
            body+='</a>'
        body+='</div></section>'
    if external:
        body+='<section class="trend-index-section"><h2>در خبرها</h2>'
        for item in external[:6]:
            body+='<a class="trend-coverage-story" href="'+e(item["url"])+'" rel="noopener noreferrer"><strong>'+e(item["title"])+'</strong><small>'+e(item["source"])+'</small></a>'
        body+='</section>'
    if kind=="person" and entity.get("record",{}).get("source"):
        body+='<p><a href="'+e(entity["record"]["source"])+'" rel="noopener noreferrer">منبع معرفی چهره ←</a></p>'
    body+='</div>'
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(magazine_shell(label,body,intro or label,path=url,
                 kind="ProfilePage" if kind=="person" else "CollectionPage",
                 robots="noindex,follow"),encoding="utf-8")
    register_verified_person(site,entity)
    return True

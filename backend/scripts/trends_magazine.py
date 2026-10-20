"""Shared Pendar magazine reader for sourced daily-trends reporting.

Covers are not fabricated. An image appears only if publication rights and
provenance are explicitly recorded in the input; otherwise a photo-free,
typographic magazine layout is used.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

def e(s):
    return html.escape(str(s or ""),quote=True)

def authors():
    catalog=Path(__file__).resolve().parents[2]/"web-static"/"data"/"pendar-editorial-authors.json"
    try:
        return json.loads(catalog.read_text(encoding="utf-8")).get("authors",[])
    except (OSError,ValueError):
        return []

def byline(row):
    """Associate with an existing writer desk; no new fictional identities."""
    catalog=authors()
    author_id=row.get("author_id")
    if author_id:
        selected=next((a for a in catalog if a["id"]==author_id),None)
        if selected:return selected
    text=" ".join([row.get("trend_keyword",""),row.get("report",{}).get("title_fa","")]+[
        x.get("headline","") for x in row.get("sources",[])])
    scores=[]
    for person in catalog:
        score=0
        for term in person.get("keywords",[]):
            term=str(term).strip()
            if len(term)<4:continue
            if term in text[:160]:score+=5
            elif term in text:score+=1
        if score:scores.append((score,person["id"],person))
    scores.sort(key=lambda x:(-x[0],x[1]))
    if scores and (len(scores)==1 or scores[0][0]>scores[1][0]):
        return scores[0][2]
    return {"id":"desk","display_name_fa":"تحریریهٔ پندار"}

def portrait(author):
    idx=author.get("portrait_index")
    if not isinstance(idx,int) or idx not in range(7) or author.get("portrait_status")!="installed":
        return '<span class="story-author-monogram" aria-hidden="true">پ</span>'
    return ('<span class="story-author-monogram" aria-hidden="true" style="'
        'background-image:url(/assets/editorial/pendar-authors-sprite.avif);'
        'background-size:700% 100%;background-position:'+str(idx*100/6)+'% 0"></span>')

def related_stories(site,keyword,title,limit=4):
    """Headline-first related coverage; don't misrepresent mere word overlap."""
    path=Path(site)/"data"/"stories.json"
    if not path.is_file():return []
    try:rows=json.loads(path.read_text(encoding="utf-8"))
    except (OSError,ValueError):return []
    from trends_seo import stable_key
    def tokens(value):
        return set(re.findall(r"[\u0600-\u06ff\w]{3,}",str(value or "").replace("ي","ی").replace("ك","ک")))
    needle=tokens(keyword)|tokens(title)
    meaningful={w for w in needle if w not in {"برای","ایران","گزارش","جدید","امروز","خبر","درباره","بررسی","جزئیات","این","از","با","ترندهای"}}
    matched=[]
    for row in rows if isinstance(rows,list) else []:
        if not isinstance(row,dict):continue
        sid=str(row.get("id") or "")
        if not re.fullmatch(r"[a-fA-F0-9-]{36}",sid):continue
        name=str(row.get("headline_fa") or "")
        hits=tokens(name)&meaningful
        if len(hits)<min(2,len(meaningful)):continue
        matched.append((len(hits),row))
    matched.sort(key=lambda x:(-x[0],str(x[1].get("published_at") or "")),reverse=False)
    return [{"title":r.get("headline_fa") or "","url":"/story/"+r["id"]+"/",
             "published_at":r.get("published_at")} for _,r in matched[:limit]]

def history_graph(history,keyword_id):
    points=sorted([x for x in history if isinstance(x,dict)
                   and x.get("keyword_id")==keyword_id and isinstance(x.get("lower_bound"),int)
                   and x["lower_bound"]>=0 and x.get("observed_at")],
                  key=lambda x:x["observed_at"])
    dedup={p["observed_at"]:p for p in points}
    points=list(dedup.values())[-12:]
    if len(points)<3:return ""
    peak=max(p["lower_bound"] for p in points) or 1
    width=640
    xs=[50+(540*i/(len(points)-1)) for i in range(len(points))]
    ys=[160-116*(p["lower_bound"]/peak) for p in points]
    coords=" ".join(f"{x:.1f},{y:.1f}" for x,y in zip(xs,ys))
    circles="".join('<circle cx="'+f'{x:.1f}'+'" cy="'+f'{y:.1f}'+'" r="4" fill="#178e99"/>'
                  for x,y in zip(xs,ys))
    labels="".join('<li><time>'+e(p["observed_at"][:16].replace("T"," "))+'</time> — '
                   +e(p.get("raw") or p["lower_bound"])+' جست‌وجو (حداقل تقریبی)</li>'
                   for p in points[-5:])
    return ('<section class="trend-evidence-chart"><h3>روند ثبت‌شدهٔ توجه به این موضوع</h3>'
        '<p>مشاهده‌های دوره‌ای از خوراک Google Trends ایران؛ مقادیر تقریبی‌اند، '
        'نه آمار قطعی کل جست‌وجوها و نه شاخص مقیاس‌بندی‌شدهٔ Interest over time.</p>'
        '<svg viewBox="0 0 640 190" role="img" aria-label="نمودار مشاهدات تقریبی خوراک ترندهای روز">'
        '<line x1="50" y1="160" x2="590" y2="160" stroke="#afbdb5"/>'
        '<polyline points="'+coords+'" fill="none" stroke="#168e99" stroke-width="3"/>'+circles+'</svg>'
        '<details><summary>مشاهده‌ها و اعداد</summary><ol>'+labels+'</ol></details></section>')

def credited_photo(row):
    """Only configured reusable images; never hotlink a publisher thumbnail."""
    image=str(row.get("image_url") or "")
    license=str(row.get("image_license") or "").lower()
    credit=str(row.get("image_credit") or "")
    if license not in {"cc-by","cc-by-sa","cc0","public-domain","original-pendar"} and not re.fullmatch(r"cc by(?:-sa)? [234]\.0",license):return None
    if not image.startswith("/assets/") or ".." in image or not credit:return None
    return {"url":image,"credit":credit,"source_url":row.get("image_source_url") or "",
            "license":row.get("image_license") or "","license_url":row.get("image_license_url") or "",
            "caption":row.get("image_caption") or ""}

def magazine_shell(title,body,meta,**kwargs):
    sidebar_html=kwargs.pop("sidebar_html",None)
    from trends_seo import head_meta
    return ('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">'
      '<meta name="viewport" content="width=device-width,initial-scale=1">'
      +head_meta(title,meta,**kwargs)
      +'<link rel="icon" href="/icons/icon.svg" type="image/svg+xml">'
      '<link rel="preconnect" href="https://fonts.googleapis.com">'
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap">'
      '<link rel="stylesheet" href="/styles.css">'
      '<link rel="stylesheet" href="/heritage-article.css">'
      '<link rel="stylesheet" href="/trends-magazine.css?v=20261020-trends-list-layout-5">'
      '</head><body><main id="detail-view"><div class="magazine-reader">'
      '<header class="magazine-masthead"><div class="magazine-container magazine-masthead-inner">'
      '<a class="magazine-brand" href="/"><img src="/assets/pendar-logo.svg" alt="پندار"></a>'
      '<span class="magazine-masthead-tagline">خبر، اندیشه و فرهنگ</span>'
      '<a class="magazine-masthead-back" href="/">بازگشت به صفحهٔ اول ←</a></div></header>'
      '<nav class="magazine-topnav"><div class="magazine-container magazine-topnav-links">'
      '<a href="/">خانه</a><a href="/reports/">گزارش‌ها</a><a href="/trends/">ترندهای روز</a>'
      '<a href="/figures/">چهره‌ها</a><a href="/books/">پیشخوان کتاب</a>'
      '<a href="/press/">پیشخوان جراید</a><a href="/market/">بازار</a></div></nav>'
      '<div class="magazine-container magazine-article-container"><nav class="magazine-breadcrumb" aria-label="موقعیت">'
      '<a href="/">پندار</a> / <a href="/trends/">ترندهای روز</a></nav>'
      '<div class="magazine-article-layout"><article class="magazine-article-paper">'
      +body+'</article><aside class="magazine-article-rail">'
      +(sidebar_html if sidebar_html is not None else '')
      +'<section class="magazine-rail-box trend-compact-other"><div class="magazine-rail-heading"><h2>دیگر ترندهای امروز</h2></div><div data-trends-related-rail><a class="trend-side-link" href="/trends/">دیدن ترندها ←</a></div></section>'
      +'</aside></div></div>'
      '<footer class="trend-reader-footer"><a href="/">پندار</a> · خبر، اندیشه و فرهنگ</footer>'
      '<script src="/trends-interactions.js?v=20261020-follow-rail-1" defer></script>'
      '</div></main></body></html>')

def report_body(row,site,observations,article_rows):
    report=row["report"]
    writer=byline(row)
    name=writer.get("display_name_fa") or "تحریریهٔ پندار"
    author_id=writer["id"]
    refs={x["id"]:x for x in row["sources"] if isinstance(x,dict)}
    def cites(ids):
        return " ".join('<a class="trend-cite" href="#source-'+e(s)+'" aria-label="منبع '+e(s)+'">'+e(s)+'</a>'
                        for s in ids if s in refs)
    date=e((row.get("generated_at") or row.get("observed_at") or "")[:10])
    body='<div class="magazine-article-kicker">گزارش • ترندهای روز</div>'
    body+='<div class="d-head"><div class="meta"><span class="chip">گزارش</span><time>'+date+'</time></div><h1>'+e(report["title_fa"])+'</h1></div>'
    body+='<div class="story-author-byline"><div class="story-author-credit">'+portrait(writer)
    body+='<span><a href="/editorial-author/'+e(author_id)+'/">'+e(name)+'</a>'
    body+='<small>تحریریهٔ پندار</small></span></div></div>'
    photo=credited_photo(row)
    if photo:
        credit=e(photo["credit"])
        link=('<a href="'+e(photo["source_url"])+'" rel="noopener noreferrer">منبع تصویر</a>' if photo["source_url"].startswith("https://") else "")
        license_link=('<a href="'+e(photo["license_url"])+'" rel="noopener noreferrer">'+e(photo["license"])+'</a>' if photo["license_url"].startswith("https://") else e(photo["license"]))
        body+='<figure class="magazine-article-photo"><div class="trend-photo-frame"><img class="hero-img" src="'+e(photo["url"])+'" alt="'+e(photo.get("caption") or report["title_fa"])+'" loading="eager" decoding="async" width="1150" height="647"></div><figcaption class="hero-credit">'+e(photo.get("caption") or "عکس آرشیوی")+' — عکس: '+credit+' · '+link+' · '+license_link+'</figcaption></figure>'
    body+='<p class="magazine-article-lead">'+e(report["lead_fa"])+' '+cites(report.get("lead_citation_ids",[]))+'</p>'
    context=report.get("trend_context")
    if isinstance(context,dict) and context.get("text_fa") and context.get("citation_ids"):
        body+='<section class="trend-context-evidence"><h2>زمینهٔ احتمالی افزایش جست‌وجو</h2><p>'+e(context["text_fa"])+' '+cites(context["citation_ids"])+'</p></section>'
    body+='<div class="trend-report-prose">'
    for block in report["paragraphs"]:
        body+='<p>'+e(block["text_fa"])+' '+cites(block["citation_ids"])+'</p>'
    body+='</div>'
    # An editorial digest of the actual source articles, not a fabricated trend narrative.
    body+='<section class="trend-news-coverage"><h2>در خبرها</h2>'
    for source in row.get("sources",[])[:4]:
        link=str(source.get("url") or "")
        if link.startswith("https://"):
            body+='<a class="trend-coverage-story" href="'+e(link)+'" rel="noopener noreferrer"><strong>'+e(source.get("headline"))+'</strong><small>'+e(source.get("publisher"))+'</small></a>'
    body+='</section>'
    key=row.get("id","")
    body+=history_graph(observations,key)
    related=related_stories(site,row.get("trend_keyword"),report["title_fa"])
    other=[p for p in article_rows if p.get("url") and p.get("trend_keyword")!=row.get("trend_keyword")
           and len(set(str(p.get("trend_keyword") or "").split())&set(str(row.get("trend_keyword") or "").split()))>=2]
    related.extend([{"title":p["title"],"url":p["url"]} for p in other[:2]])
    if related:
        body+='<section class="trend-related"><h2>در همین موضوع</h2>'
        body+=''.join('<a href="'+e(x["url"])+'">'+e(x["title"])+' ←</a>' for x in related[:5])
        body+='</section>'
    body+='<details class="story-examination"><summary>زیر ذره‌بین پندار <small>منابع، داده‌ها و اطلاعات پرونده</small></summary><div class="story-examination-body">'
    body+='<h3>منابع این گزارش</h3><ol class="trend-sources">'
    for r in row["sources"]:
        url=str(r.get("url") or "")
        if urlsplit(url).scheme!="https":continue
        body+='<li id="source-'+e(r["id"])+'"><a href="'+e(url)+'" rel="noopener noreferrer">'+e(r.get("publisher"))+' — '+e(r.get("headline"))+'</a></li>'
    body+='</ol>'
    body+='<p>مبنای انتخاب سوژه، دادهٔ عمومی ترندهای ایران بوده است. اطلاعات خبری این گزارش تنها از منابع درج‌شده تهیه شده‌اند.</p>'
    body+='</div></details>'
    return body

def index_shell(contents):
    return magazine_shell("ترندهای روز",contents,
        "گزارش‌ها و موضوعات پرجست‌وجوی روز ایران در تحریریهٔ پندار.",
        path="/trends/",kind="CollectionPage")

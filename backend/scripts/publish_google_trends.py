"""Publish Daily Trends as normal Pendar magazine reports and controlled dossiers.

Public longform reports are sourced and structurally validated; high-risk or
unreviewed drafts are not copied into the public site. No synthetic photos.
"""
from __future__ import annotations
import argparse
import os
import html
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

from trends_seo import stable_key,canonical_path,update_sitemap
from trends_media import verify_and_install
from trends_topics import clean_title, canonical_label, classify, figures_index, related_people, write_context_page
from trends_magazine import (e,byline,magazine_shell,report_body,
                              index_shell,related_stories,credited_photo)

def valid_link(url):
    parsed=urlsplit(str(url or ""))
    return parsed.scheme=="https" and bool(parsed.hostname)

def safe_report(row):
    if not isinstance(row,dict) or row.get("research_status")!="eligible_low_risk" or row.get("risk_review_required") is not False:
        return False
    report=row.get("report")
    sources=row.get("sources")
    key=str(row.get("id") or "")
    if not re.fullmatch(r"[a-f0-9]{16}",key) or not isinstance(report,dict) or not isinstance(sources,list):
        return False
    if len({s.get("domain") for s in sources if isinstance(s,dict)})<2:return False
    ids={s.get("id") for s in sources if isinstance(s,dict) and valid_link(s.get("url"))}
    if len(ids)<2 or not report.get("paragraphs"):return False
    if not str(report.get("title_fa") or "").strip() or not str(report.get("lead_fa") or "").strip():return False
    if any(not isinstance(p,dict) or not p.get("text_fa") or not p.get("citation_ids") or
           set(p["citation_ids"])-ids for p in report["paragraphs"]):return False
    return bool(report.get("lead_citation_ids")) and not set(report["lead_citation_ids"])-ids

def trend_sidebar(row,site,all_articles,index):
    people=related_people(site,row,index=index)
    boxes=[]
    if people:
        content="".join('<a class="trend-side-person" href="'+e(p["url"])+'"><strong>'+e(p.get("name") or p["label"])+'</strong><span>دیدن صفحه و دنبال‌کردن ←</span></a>' for p in people)
        boxes.append('<section class="magazine-rail-box"><div class="magazine-rail-heading"><h2>چهره‌های مرتبط</h2></div>'+content+'</section>')
    stories=related_stories(site,row.get("trend_keyword"),row["report"]["title_fa"],limit=4)
    if stories:
        links="".join('<a class="trend-side-link" href="'+e(story["url"])+'">'+e(story["title"])+'</a>' for story in stories)
        boxes.append('<section class="magazine-rail-box"><div class="magazine-rail-heading"><h2>در همین موضوع</h2></div>'+links+'</section>')
    others=[a for a in all_articles if a.get("id")!=row.get("id")][:5]
    if others:
        cards="".join('<a class="trend-side-link" href="'+e(a["url"])+'">'+e(a["title"])+'</a>' for a in others)
        boxes.append('<section class="magazine-rail-box"><div class="magazine-rail-heading"><h2>ترندهای دیگر</h2></div>'+cards+'</section>')
    boxes.append('<section class="magazine-rail-box"><div class="magazine-rail-heading"><h2>از تحریریه</h2></div><a class="trend-side-link" href="/reports/">همهٔ گزارش‌های پندار ←</a><a class="trend-side-link" href="/trends/">ترندهای امروز ←</a></section>')
    return "".join(boxes)

def report_page(row,site,observations,all_articles,index):
    report=row["report"]
    photo=credited_photo(row)
    lead=report["lead_fa"]
    body=report_body(row,site,observations,all_articles)
    path=canonical_path("report",row["id"])
    return magazine_shell(report["title_fa"],body,lead,
        path=path,image=photo["url"] if photo else None,
        kind="Article",published=row.get("generated_at") or row.get("observed_at"),
        keyword=row.get("trend_keyword"),sidebar_html=trend_sidebar(row,site,all_articles,index))

def brief_page(brief,path):
    """Contextual search topic, not masquerading as an independently reported story."""
    links=[]
    for entry in brief.get("related_news",[]):
        if isinstance(entry,dict) and valid_link(entry.get("url")) and entry.get("headline"):
            links.append('<li><a href="'+e(entry["url"])+'" rel="noopener noreferrer">'+e(entry.get("publisher"))+' — '+e(entry["headline"])+'</a></li>')
    lead=str(brief.get("lead_fa") or "")
    body='<div class="magazine-article-kicker">رصد جست‌وجو</div><div class="d-head"><h1>'+e(brief["title_fa"])+'</h1></div>'
    photo=credited_photo(brief)
    if photo:
        attribution='<a href="'+e(photo["source_url"])+'">منبع عکس</a>' if photo["source_url"].startswith("https://") else ""
        body+='<figure class="magazine-article-photo"><div class="trend-photo-frame"><img class="hero-img" src="'+e(photo["url"])+'" alt="'+e(photo["caption"] or brief["title_fa"])+'" decoding="async" width="1150" height="647"></div><figcaption class="hero-credit">'+e(photo["caption"])+' · '+e(photo["credit"])+' · '+attribution+'</figcaption></figure>'
    body+='<p class="magazine-article-lead">'+e(lead)+'</p><h2>پوشش خبری این موضوع</h2><ol class="trend-sources">'+''.join(links)+'</ol>'
    existing=brief.get("existing_article_url")
    if valid_link(existing) and urlsplit(existing).hostname=="pendar.io":
        body+='<p><a href="'+e(existing)+'">گزارش مرتبط پندار ←</a></p>'
    return magazine_shell(brief["title_fa"],body,lead,path=path,kind="WebPage",
                          image=photo["url"] if photo else None,
                          keyword=brief.get("trend_keyword"),robots="noindex,follow")

def topical_dossiers(site,rows):
    """Generate a topic hub only with multiple *substantive* reports and context."""
    catalog={
        "diplomacy":("دیپلماسی","مذاکرات، روابط خارجی و تحولات منطقه‌ای"),
        "politics":("سیاست","دولت، مجلس و تحولات حکمرانی"),
        "economy":("اقتصاد","بازار، کسب‌وکار و تصمیم‌های اقتصادی"),
        "society":("جامعه","آموزش، اشتغال و زندگی روزمره"),
        "environment":("محیط زیست","آب، هوا و تغییرات محیطی"),
        "culture":("فرهنگ","کتاب، سینما، موسیقی و هنر"),
        "technology":("فناوری","فناوری و دگرگونی‌های علمی"),
    }
    output=[]
    for author_id,(title,description) in catalog.items():
        relevant=[r for r in rows if r.get("author_id")==author_id]
        if len(relevant)<2:continue
        contextual=[]
        seen=set()
        for r in relevant:
            for story in related_stories(site,r.get("trend_keyword"),r["title"],limit=3):
                if story["url"] not in seen:
                    seen.add(story["url"]);contextual.append(story)
        # A pile of tags with no editorial context is not an indexable topic page.
        if len(contextual)<2:continue
        url="/trends/subject/"+author_id+"/"
        items=''.join('<a class="trend-index-item" href="'+e(r["url"])+'"><strong>'+e(r["title"])+'</strong><p>'+e(r.get("lead_fa","")[:185])+'</p></a>'
                      for r in relevant)
        background=''.join('<a class="trend-index-item" href="'+e(x["url"])+'"><strong>'+e(x["title"])+'</strong></a>' for x in contextual[:6])
        body='<div class="magazine-article-kicker">پروندهٔ موضوعی</div><h1>'+e(title)+'</h1>'
        body+='<p class="trend-index-lead">'+e(description)+'؛ مرور گزارش‌های منتشرشده و پوشش مرتبط در آرشیو پندار.</p>'
        body+='<h2>گزارش‌های تحریریه</h2><div class="trend-index-grid">'+items+'</div>'
        body+='<section class="trend-index-section"><h2>پیشینه و مطالب مرتبط</h2><div class="trend-index-grid">'+background+'</div></section>'
        dest=Path(site)/url.lstrip("/")/"index.html";dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text(magazine_shell(title,body,description,path=url,kind="CollectionPage"),encoding="utf-8")
        output.append({"id":author_id,"title":title,"url":url,"description":description})
    return output

def redirect_legacy_trends(site):
    """Forward old URLs to their stable new equivalents; no indexable duplicates."""
    old=Path(site)/"search-trends"
    old.mkdir(parents=True,exist_ok=True)
    original=list(old.rglob("index.html"))
    original.append(old/"index.html")
    count=0
    for file in set(original):
        suffix=file.parent.relative_to(old).as_posix()
        target="/trends/" if suffix in (".","") or suffix.isdigit() else "/trends/"+suffix+"/"
        if not (Path(site)/target.lstrip("/")/"index.html").is_file():
            target="/trends/"
        file.parent.mkdir(parents=True,exist_ok=True)
        file.write_text('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">'
            '<title>ترندهای امروز | پندار</title>'
            '<meta name="robots" content="noindex,follow">'
            '<meta http-equiv="refresh" content="0;url='+e(target)+'">'
            '<link rel="canonical" href="https://pendar.io'+e(target)+'"></head>'
            '<body><a href="'+e(target)+'">ترندهای امروز در پندار ←</a></body></html>',
            encoding="utf-8")
        count+=1
    return count

def run(site,data):
    site=Path(site);source=Path(data)
    if not source.is_file():
        print("No Trends snapshot; retaining prior published site");return
    d=json.loads(source.read_text(encoding="utf-8"))
    if d.get("status")!="ok":raise ValueError("Invalid Trends snapshot")
    briefs=d.get("briefs",[])
    if not isinstance(briefs,list):raise ValueError("Invalid brief index")
    root=site/"trends";root.mkdir(parents=True,exist_ok=True)
    observations=d.get("trend_observations",[])
    if not isinstance(observations,list):observations=[]
    records=[row for row in d.get("research_reports",[])[:120] if safe_report(row)]
    index=figures_index(site)
    enable_media=os.environ.get("PENDAR_TRENDS_MEDIA")=="1"
    for row in records:
        row["report"]["title_fa"]=clean_title(row["report"]["title_fa"])
        existing_photo=credited_photo(row)
        if existing_photo:
            file=site/existing_photo["url"].lstrip("/")
            if not file.is_file() or file.stat().st_size<6000:
                # A stale asset reference must not create a broken image.
                for key in ("image_url","image_credit","image_license","image_license_url",
                            "image_source_url","image_caption"):
                    row.pop(key,None)
        if enable_media and not credited_photo(row):
            photo=verify_and_install(site,row.get("trend_keyword"),row["report"]["title_fa"])
            if photo:
                row.update({"image_url":photo["url"],"image_credit":photo["credit"],
                    "image_license":photo["license"],"image_license_url":photo["license_url"],
                    "image_source_url":photo["source_url"],"image_caption":photo["caption"]})
        for person in related_people(site,row,index=index):
            write_context_page(site,person,related_stories(site,row.get("trend_keyword"),row["report"]["title_fa"]))
    articles=[]
    for row in records:
        url=canonical_path("report",row["id"])
        writer=byline(row)
        photo=credited_photo(row)
        articles.append({"id":row["id"],"title":row["report"]["title_fa"],"url":url,
                         "lead_fa":row["report"].get("lead_fa") or "",
                         "author_id":writer["id"],"author_name_fa":writer.get("display_name_fa") or "تحریریهٔ پندار",
                         "image_url":photo["url"] if photo else None,
                         "image_alt":row["report"]["title_fa"] if photo else "",
                         "image_credit":photo["credit"] if photo else "",
                         "published_at":row.get("generated_at") or row.get("observed_at"),
                         "trend_keyword":row.get("trend_keyword")})
    for row in records:
        url=canonical_path("report",row["id"])
        target=site/url.lstrip("/")/"index.html"
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(report_page(row,site,observations,articles,index),encoding="utf-8")
    topics=[]
    for brief in briefs[:10]:
        if not isinstance(brief,dict) or not brief.get("related_news") or not brief.get("trend_keyword"):continue
        key=stable_key(brief["trend_keyword"])
        classified=classify(site,brief["trend_keyword"],index)
        url=classified.get("url") or canonical_path("topic",key)
        brief["title_fa"]=clean_title(brief["title_fa"])
        if enable_media and classified["kind"]=="topic":
            photo=verify_and_install(site,brief["trend_keyword"],brief["title_fa"])
            if photo:
                brief.update({"image_url":photo["url"],"image_credit":photo["credit"],
                    "image_license":photo["license"],"image_license_url":photo["license_url"],
                    "image_source_url":photo["source_url"],"image_caption":photo["caption"]})
        if classified["kind"]=="topic":
            target=site/url.lstrip("/")/"index.html"
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_text(brief_page(brief,url),encoding="utf-8")
        else:
            linked=related_stories(site,classified["label"],brief["title_fa"])
            write_context_page(site,classified,linked)
        topics.append({"title":classified["label"] if classified["kind"]!="topic" else brief["title_fa"],
                       "url":url,"trend_keyword":brief["trend_keyword"],"kind":classified["kind"]})
    dossiers=topical_dossiers(site,articles)
    body='<div class="magazine-article-kicker">گزارش‌های تحریریه</div><h1>ترندهای روز</h1>'
    body+='<p class="trend-index-lead">مهم‌ترین موضوعاتی که توجه جست‌وجوگران ایران را جلب کرده‌اند؛ همراه با گزارش‌های مستند تحریریهٔ پندار.</p>'
    if dossiers:
        body+='<nav class="trend-topic-links" aria-label="پرونده‌های موضوعی">'+''.join('<a href="'+e(q["url"])+'">'+e(q["title"])+'</a>' for q in dossiers)+'</nav>'
    # Keep the same visual hierarchy as homepage: only actual photographs
    # enter visual cards; all other reports remain discoverable as headlines.
    photographed=[r for r in articles if r.get("image_url")]
    no_photo=[r for r in articles if not r.get("image_url")]
    if photographed:
        body+='<div class="trend-index-grid trend-index-visual">'
        for row in photographed:
            body+='<a class="trend-index-item trend-index-with-photo" href="'+e(row["url"])+'">'
            body+='<span class="trend-index-photo"><img src="'+e(row["image_url"])+'" alt="'+e(row.get("image_alt") or row["title"])+'" loading="lazy" decoding="async" width="640" height="360"></span>'
            body+='<span class="trend-index-photo-copy"><strong>'+e(row["title"])+'</strong>'
            body+='<p>'+e(row["lead_fa"][:195])+'</p><span class="byline">'+e(row["author_name_fa"])+'</span></span></a>'
        body+='</div>'
    if no_photo:
        body+='<section class="trend-index-continuation"><h2>ادامهٔ ترندهای امروز</h2><div class="trend-index-headline-list">'
        for row in no_photo:
            body+='<a class="trend-index-headline" href="'+e(row["url"])+'"><strong>'+e(row["title"])+'</strong>'
            body+='<span>'+e(row["lead_fa"][:160])+'</span><small>'+e(row["author_name_fa"])+'</small></a>'
        body+='</div></section>'
    if not articles:
        body+='<p>در حال تکمیل گزارش‌های این نوبت.</p>'
    if topics:
        body+='<section class="trend-index-section"><h2>موضوعات زیر نظر</h2><p class="trend-observation-only">واژه‌های پرجست‌وجو و پیوند خبرهای مرتبط؛ این صفحه‌ها جای گزارش کامل را نمی‌گیرند.</p>'
        body+='<div class="trend-topic-links">'+''.join('<a href="'+e(r["url"])+'">'+e(r["trend_keyword"])+'</a>' for r in topics)+'</div></section>'
    (root/"index.html").write_text(index_shell(body),encoding="utf-8")

    public={k:v for k,v in d.items() if k not in ("research_reports","research_metrics","unmatched_trends","trend_observations")}
    public["published_report_count"]=len(articles)
    public["reports"]=articles
    public["briefs"]=topics
    public["subjects"]=dossiers
    public["display_title"]="ترندهای روز"
    out=site/"data"/"google-trends-iran.json";out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(public,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print("Search Trends indexed sitemap URLs:",update_sitemap(site,["/trends/"]+
                       [x["url"] for x in articles]+[x["url"] for x in dossiers]))
    print("Published sourced trend briefing pages:",len(topics))
    print("Published eligible editorial long reports:",len(articles))
    print("Published substantial controlled topic dossiers:",len(dossiers))
    print("Human-review research drafts are excluded from public outputs")
    print("Legacy Trends redirects:",redirect_legacy_trends(site))
    # Early numeric pilots were unstable: do not let them masquerade as fresh reporting.
    for i in range(1,11):
        p=root/str(i)/"index.html"
        if p.is_file():
            p.write_text('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=/trends/"><link rel="canonical" href="https://pendar.io/trends/"></head><body><a href="/trends/">ترندهای روز</a></body></html>',encoding="utf-8")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--site",default="site")
    parser.add_argument("--data",default="/tmp/trends/data/google-trends-iran.json")
    args=parser.parse_args()
    run(args.site,args.data)

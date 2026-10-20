"""Publish a sourced search-trend index and only evidence-eligible long reports.

High-risk AI drafts stay exclusively in private workflow output for human review.
Public JSON excludes all unapproved draft bodies.
"""
import argparse
import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlsplit

CSS = """body{font:18px/2 Vazirmatn,Tahoma,system-ui,sans-serif;max-width:920px;margin:2.5rem auto;padding:1rem;color:#252629;background:#fcfcfb}
a{color:#126575;text-decoration:none}a:hover{text-decoration:underline}
nav,.date{color:#66727a;font-size:.8em}.article{max-width:760px}
h1{font-size:2em;line-height:1.55;margin:1rem 0}h2{margin-top:2em;font-size:1.25em}
.lead{font-size:1.15em;color:#32383b;line-height:2}.item{margin:1rem 0;padding:1rem 0;border-bottom:1px solid #e5e6e7}
.note{border-right:3px solid #65828c;background:#f1f5f5;padding:.8rem 1rem;font-size:.88em}
.cite{font-size:.72em;margin-right:.35em}.sources li{margin:.75rem 0;font-size:.9em}
.small{font-size:.85em;color:#53626c}
"""

def e(value):
    return html.escape(str(value or ""), quote=True)

def valid_link(url):
    p = urlsplit(str(url or ""))
    return p.scheme == "https" and bool(p.hostname)

def shell(title, content, description=""):
    return ('<!doctype html><html lang="fa" dir="rtl"><head>'
            '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<meta name="description" content="'+e(description[:160])+'"><title>'+e(title)+' | پندار</title>'
            '<style>'+CSS+'</style></head><body>'
            '<nav><a href="/">پندار</a> / <a href="/search-trends/">از جست‌وجوها</a></nav>'
            +content+'</body></html>')

def citations(refs, known):
    rows=[]
    for ref in refs:
        source=known.get(ref)
        if source and valid_link(source["url"]):
            rows.append('<a class="cite" rel="noopener noreferrer" href="'+e(source["url"])+'">['+e(ref)+']</a>')
    return " ".join(rows)

def brief_page(b):
    related=b.get("related_news") or []
    links="".join('<li><a rel="noopener noreferrer" href="'+e(n["url"])+'">'
                  +e(n.get("publisher"))+': '+e(n.get("headline"))+'</a></li>'
                  for n in related if isinstance(n,dict) and valid_link(n.get("url")))
    existing=b.get("existing_article_url")
    extra=('<p>گزارش مرتبط در پندار: <a href="'+e(existing)+'">خواندن</a></p>'
           if valid_link(existing) and urlsplit(existing).hostname=="pendar.io" else "")
    body=('<article class="article"><h1>'+e(b["title_fa"])+'</h1>'
          '<p class="lead">'+e(b["lead_fa"])+'</p>'
          '<div class="note">این صفحه رصد جست‌وجو و فهرست پوشش خبری است؛ '
          'وقوع رویداد یا علت افزایش جست‌وجو مستقلاً تأیید نشده است.</div>'
          '<h2>پوشش رسانه‌ای مرتبط</h2><ul class="sources">'+links+'</ul>'
          +extra+'<p class="small"><a href="https://trends.google.com/trending?geo=IR">'
          'منبع شاخص جست‌وجو: Google Trends ایران</a></p></article>')
    return shell(b["title_fa"],body,b.get("lead_fa") or "")

def report_page(row):
    report=row["report"]
    sources={s["id"]:s for s in row["sources"] if isinstance(s,dict)}
    body='<article class="article"><p class="date">گزارش پژوهشی پندار از یک موضوع جست‌وجوشده</p>'
    body+='<h1>'+e(report["title_fa"])+'</h1>'
    body+='<p class="lead">'+e(report["lead_fa"])+' '+citations(report["lead_citation_ids"],sources)+'</p>'
    for paragraph in report["paragraphs"]:
        body+='<p>'+e(paragraph["text_fa"])+' '+citations(paragraph["citation_ids"],sources)+'</p>'
    body+='<h2>منابع گزارش</h2><ol class="sources">'
    for source in sources.values():
        if not valid_link(source["url"]):
            continue
        body+='<li id="'+e(source["id"])+'"><a href="'+e(source["url"])+'" rel="noopener noreferrer">'+e(source.get("publisher"))+' — '+e(source.get("headline"))+'</a></li>'
    body+='</ol><div class="note">ارتباط این موضوع با Google Trends به‌معنای تأیید علت افزایش جست‌وجو نیست. '
    body+='این گزارش از متن منابع درج‌شده تهیه شده است؛ استنادها کنار هر بند آمده‌اند.</div></article>'
    return shell(report["title_fa"],body,report.get("lead_fa") or "")

def run(site,data):
    site=Path(site)
    source=Path(data)
    if not source.is_file():
        print("No Google Trends artifact; retaining healthy site")
        return
    d=json.loads(source.read_text(encoding="utf-8"))
    if d.get("status") != "ok":
        raise ValueError("invalid Google Trends artifact")
    briefs=d.get("briefs",[])
    if not isinstance(briefs,list):
        raise ValueError("invalid briefs")
    root=site/"search-trends"
    root.mkdir(parents=True,exist_ok=True)
    brief_rows=[]
    for i,b in enumerate(briefs[:10],1):
        if not isinstance(b,dict) or not b.get("related_news") or not b.get("trend_keyword"):
            continue
        target=root/str(i)/"index.html"
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(brief_page(b),encoding="utf-8")
        brief_rows.append({"title":b["title_fa"],"url":"/search-trends/"+str(i)+"/"})

    article_rows=[]
    # Only explicitly low-risk, structurally validated reports become public.
    # The research stage never marks war, deaths, accusations, health or political
    # conflicts eligible. Held drafts are NOT copied into publicly served JSON.
    for r in d.get("research_reports",[])[:120]:
        if not isinstance(r,dict) or r.get("research_status")!="eligible_low_risk" or r.get("risk_review_required") is not False:
            continue
        report=r.get("report")
        sources=r.get("sources")
        key=str(r.get("id") or "")
        if not re.fullmatch(r"[a-f0-9]{16}", key):
            continue
        if not isinstance(report,dict) or not isinstance(sources,list) or len({s.get("domain") for s in sources if isinstance(s,dict)})<2:
            continue
        ids={s.get("id") for s in sources if isinstance(s,dict) and valid_link(s.get("url"))}
        if len(ids)<2 or not report.get("paragraphs") or any(set(p.get("citation_ids") or [])-ids for p in report.get("paragraphs") or []):
            continue
        if set(report.get("lead_citation_ids") or [])-ids:
            continue
        dest=root/"report"/key/"index.html"
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text(report_page(r),encoding="utf-8")
        article_rows.append({"title":report["title_fa"],"url":"/search-trends/report/"+key+"/"})

    cards=lambda items:"".join('<li class="item"><a href="'+e(x["url"])+'">'+e(x["title"])+'</a></li>' for x in items)
    lead='<h1>از جست‌وجوها</h1><p>جست‌وجوهای پرطرفدار ایران و پژوهش‌های مستند برآمده از آن‌ها؛ ترند به‌تنهایی خبر نیست.</p>'
    longform=('<h2>گزارش‌های پژوهشی</h2><ul>'+cards(article_rows)+'</ul>') if article_rows else ''
    archive='<h2>موضوعات رصدشده</h2><ul>'+cards(brief_rows)+'</ul>'
    (root/"index.html").write_text(shell("از جست‌وجوها",lead+longform+archive),encoding="utf-8")

    # Expose only safe public metadata; no unreviewed generated articles or
    # source excerpts in a public endpoint.
    public={k:v for k,v in d.items() if k not in ("research_reports","research_metrics","unmatched_trends")}
    public["published_report_count"]=len(article_rows)
    public["reports"]=article_rows
    out=site/"data"/"google-trends-iran.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(public,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print("Published sourced trend briefing pages:",len(brief_rows))
    print("Published eligible editorial long reports:",len(article_rows))
    print("Human-review research drafts are excluded from public outputs")

    if brief_rows or article_rows:
        homepage=site/"index.html"
        body=homepage.read_text(encoding="utf-8")
        marker="<!-- pendar-google-trends-link -->"
        if marker not in body:
            link=marker+'<aside lang="fa" dir="rtl" style="text-align:right;padding:8px 16px"><a href="/search-trends/">از جست‌وجوها: تازه‌ترین موضوعات Google Trends ←</a></aside>'
            if "<main" in body:
                body=body.replace("<main",link+"<main",1)
            elif "<body" in body:
                body=re.sub(r"(<body[^>]*>)",r"\1"+link,body,count=1)
            homepage.write_text(body,encoding="utf-8")

if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--site",default="site")
    parser.add_argument("--data",default="/tmp/trends/data/google-trends-iran.json")
    a=parser.parse_args()
    run(a.site,a.data)

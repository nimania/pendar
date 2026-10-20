"""Publish verified Google Trends briefing index into an existing static site."""
import argparse, html, json, re, shutil
from pathlib import Path

def page(brief):
    title=html.escape(brief["title_fa"])
    desc=html.escape(brief["lead_fa"])
    sources="".join('<li><a rel="noopener noreferrer" href="'+html.escape(n["url"],quote=True)+'">'+html.escape(n["publisher"]+": " if n["publisher"] else "")+html.escape(n["headline"])+'</a></li>' for n in brief.get("related_news",[]) if n["url"].startswith("https://"))
    existing=brief.get("existing_article_url")
    extra=('<p>گزارش مرتبط پندار: <a href="'+html.escape(existing,quote=True)+'">خواندن گزارش</a></p>') if existing else ""
    return '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' | پندار</title><style>body{font:18px/2 system-ui,sans-serif;max-width:800px;margin:2rem auto;padding:1rem;color:#232323}a{color:#006a76}li{margin:1rem 0}.note{background:#eee;padding:1rem}</style></head><body><nav><a href="/">پندار</a> / <a href="/search-trends/">از جست‌وجوها</a></nav><article><h1>'+title+'</h1><p>'+desc+'</p><p>این صفحه یک گزارش رصد جست‌وجو است، نه تأیید صحت خبرهای فهرست‌شده.</p><h2>پوشش رسانه‌ای مرتبط</h2><ul>'+sources+'</ul>'+extra+'<p class="note">منبع شاخص جست‌وجو: <a href="https://trends.google.com/trending?geo=IR">Google Trends — Iran</a>. فهرست خبرهای مرتبط توسط سرویس گوگل ارائه شده و مطالب آن‌ها مستقلاً در این گزارش راستی‌آزمایی نشده است.</p></article></body></html>'

def run(site,data):
    p=Path(site);source=Path(data)
    if not source.is_file():print("No trend artifact; preserving existing site");return
    d=json.loads(source.read_text(encoding="utf-8"))
    if d.get("status")!="ok":raise ValueError("invalid trend status")
    briefs=d.get("briefs",[])
    if not isinstance(briefs,list):raise ValueError("invalid briefs")
    root=p/"search-trends";root.mkdir(parents=True,exist_ok=True)
    rows=[]
    for i,brief in enumerate(briefs[:10],1):
        if not brief.get("related_news") or not brief.get("trend_keyword"):continue
        target=root/str(i)/"index.html";target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(page(brief),encoding="utf-8")
        rows.append((brief["title_fa"],"/search-trends/"+str(i)+"/"))
    menu="".join('<li><a href="'+html.escape(url)+'">'+html.escape(t)+'</a></li>' for t,url in rows)
    index='<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>از جست‌وجوها | پندار</title><style>body{font:18px/2 system-ui,sans-serif;max-width:900px;margin:2rem auto;padding:1rem}a{color:#006a76}li{margin:1rem 0}</style></head><body><a href="/">خانه پندار</a><h1>از جست‌وجوها</h1><p>رصد جست‌وجوهای پرطرفدار ایران، همراه با پیوند پوشش رسانه‌ای؛ عنوان ترند به‌تنهایی تأییدکنندهٔ یک رویداد نیست.</p><ul>'+menu+'</ul></body></html>'
    (root/"index.html").write_text(index,encoding="utf-8")
    out=p/"data"/"google-trends-iran.json";out.parent.mkdir(exist_ok=True)
    shutil.copy2(source,out)
    print("Published sourced trend briefing pages:",len(rows))
    if rows:
        homepage=p/"index.html"
        body=homepage.read_text(encoding="utf-8")
        marker="<!-- pendar-google-trends-link -->"
        if marker not in body:
            link=marker+'<aside lang="fa" dir="rtl" style="text-align:right;padding:8px 16px"><a href="/search-trends/">از جست‌وجوها: تازه‌ترین موضوعات Google Trends ←</a></aside>'
            body=body.replace("<main",link+"<main",1) if "<main" in body else body.replace("<body", "<body",1).replace(">",">"+link,1)
            homepage.write_text(body,encoding="utf-8")

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--site",default="site")
    parser.add_argument("--data",default="/tmp/trends/data/google-trends-iran.json")
    a=parser.parse_args()
    run(a.site,a.data)

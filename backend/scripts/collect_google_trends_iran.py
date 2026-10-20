"""Google Trends Iran discovery and evidence-backed report index.
Only verified matches from Pendar's published story archive can be surfaced.
No trend is treated as evidence of an event. Fail closed on unavailable feeds.
"""
import argparse
import json
import re
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

RSS = "https://trends.google.com/trending/rss?geo=IR"
STORIES = "https://pendar.io/data/stories.json"
STOP = set("ایران درباره برای کرده است این آن های اخبار خبر گزارش امروز جدید آخرین همراه از به در با که را های".split())

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0 (compatible; PendarTrendMonitor/1.0)"})
    with urllib.request.urlopen(req, timeout=25) as response:
        return response.read()

def words(text):
    s = unicodedata.normalize("NFKC", str(text or "")).lower().replace("ي","ی").replace("ك","ک")
    return {x for x in re.findall(r"[\w\u0600-\u06ff]{3,}", s) if x not in STOP}

def fetch_trends():
    root = ET.fromstring(get(RSS))
    items = []
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        if not title: continue
        ns = "{https://trends.google.com/trending/rss}"
        volume = item.findtext(ns+"approx_traffic") or ""
        items.append({"keyword":title, "geo":"IR", "approx_traffic":volume,
                      "trend_url":item.findtext("link") or RSS,
                      "published_at":item.findtext("pubDate") or ""})
    if not items:
        raise RuntimeError("Google Trends IR RSS returned no items; refusing to fabricate trends")
    return items

def build(trends, stories, limit=10):
    seen=set()
    output=[]
    for trend in trends:
        tw=words(trend["keyword"])
        if not tw: continue
        ranked=[]
        for story in stories:
            if not isinstance(story,dict): continue
            sid=str(story.get("id") or "")
            if not re.fullmatch(r"[a-fA-F0-9-]{36}",sid) or sid in seen: continue
            title=story.get("headline_fa") or story.get("title_fa") or ""
            summary=story.get("summary_fa") or story.get("lead_fa") or ""
            match=tw & words(title)
            if not match: continue
            score=4*len(match)+len(tw & words(summary))
            if len(tw)>1 and len(match)<2: continue
            ranked.append((score,story,title,summary))
        if not ranked: continue
        ranked.sort(key=lambda x:-x[0])
        _,story,title,summary=ranked[0]
        sid=str(story["id"]);seen.add(sid)
        output.append({"trend_keyword":trend["keyword"],"geo":"IR",
                       "approx_traffic":trend["approx_traffic"],"trend_url":trend["trend_url"],
                       "trend_published_at":trend["published_at"],
                       "title_fa":title,"summary_fa":summary,"story_id":sid,
                       "article_url":"https://pendar.io/story/"+sid+"/",
                       "classification":"matched_existing_story",
                       "disclosure_fa":"این خبر مستقل از داده‌های جست‌وجو است؛ تطبیق واژگانی تأییدکنندهٔ رویداد یا علت ترندشدن نیست."})
        if len(output)>=limit:break
    return output

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--out",default="trend-payload/data/google-trends-iran.json")
    p.add_argument("--limit",type=int,default=10)
    args=p.parse_args()
    out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True)
    now=datetime.now(timezone.utc).isoformat()
    try:
        trends=fetch_trends()
        stories=json.loads(get(STORIES))
        if not isinstance(stories,list):raise ValueError("Published stories is not a list")
        matches=build(trends,stories,args.limit)
        result={"observed_at":now,"source":RSS,"status":"ok","trend_count":len(trends),
                "published_report_count":0,"existing_report_matches":len(matches),
                "requested_initial_count":args.limit,"items":matches,
                "unmatched_trends":[t for t in trends if t["keyword"] not in {m["trend_keyword"] for m in matches}][:30]}
    except Exception as exc:
        result={"observed_at":now,"source":RSS,"status":"source_unavailable",
                "error":str(exc)[:300],"published_report_count":0,"items":[]}
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({k:v for k,v in result.items() if k not in ("items","unmatched_trends")},ensure_ascii=False))
    if result["status"]!="ok":raise SystemExit(1)

if __name__=="__main__":main()

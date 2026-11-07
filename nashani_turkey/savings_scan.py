#!/usr/bin/env python3
"""Non-publishing pilot. Discover sale links from official Turkish merchants.

No item is treated as a verified discount without a product-level price history.
Never bypass access controls, CAPTCHA, login, robots or rate limits.
"""
import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup

UA="NashaniSavingsResearch/0.1 (+https://pendar.io/neshani/turkey/)"
MARKERS=re.compile(r"indirim|kampanya|fırsat|firsat|outlet|sale|özel fiyat|ozel fiyat|discount",re.I)
def scan(source):
    url=source["url"]
    p=urlparse(url)
    root=p.scheme+"://"+p.netloc
    try:
        robot=RobotFileParser()
        robot.set_url(root+"/robots.txt")
        robot.read()
        if not robot.can_fetch(UA,url):
            return {"brand":source["brand"],"status":"robots_disallowed","offers":[]}
        req=Request(url,headers={"User-Agent":UA,"Accept":"text/html"})
        with urlopen(req,timeout=12) as response:
            actual=response.geturl()
            if urlparse(actual).netloc != p.netloc:
                return {"brand":source["brand"],"status":"redirect_outside_host","offers":[]}
            ct=response.headers.get("content-type","")
            if "html" not in ct:
                return {"brand":source["brand"],"status":"non_html","offers":[]}
            soup=BeautifulSoup(response.read(450000),"html.parser")
        candidates=[]
        seen=set()
        for a in soup.select("a[href]"):
            href=urljoin(actual,a.get("href",""))
            parsed=urlparse(href)
            if parsed.scheme!="https" or parsed.netloc!=p.netloc:
                continue
            label=" ".join(a.stripped_strings)[:140]
            if not MARKERS.search(label+" "+parsed.path):
                continue
            key=href.split("#",1)[0]
            if key in seen:continue
            seen.add(key)
            candidates.append({"label":label or "صفحه پیشنهادها","url":key,"verification":"not_verified",
                                "price_try":None,"previous_price_try":None})
            if len(candidates)>=12:break
        return {"brand":source["brand"],"category":source["category"],
                "status":"ok","offers":candidates}
    except Exception as error:
        return {"brand":source["brand"],"status":"fetch_error_"+type(error).__name__,"offers":[]}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--sources",default="nashani_turkey/savings-sources.json")
    ap.add_argument("--output",default="savings-output/candidates.json")
    args=ap.parse_args()
    sources=json.loads(Path(args.sources).read_text(encoding="utf-8"))["sources"]
    results=[scan(s) for s in sources]
    doc={"created_at":datetime.now(timezone.utc).isoformat(),
         "status":"monitoring_candidates_only_no_verified_prices_no_publication",
         "source_count":len(results),"results":results}
    dest=Path(args.output)
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"sources":len(results),"reachable":sum(r["status"]=="ok" for r in results),
                      "candidate_links":sum(len(r["offers"]) for r in results)},ensure_ascii=False))
if __name__=="__main__":
    main()

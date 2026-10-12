"""Small radar-only client payloads, derived from already published site data."""
import argparse
import json
from pathlib import Path

ISRAEL_TERMS=("اسرائیل","نتانیاهو","نفتالی بنت","یائیر لاپید","آیزنکوت","ایزنکوت","بن گویر","اسموتریچ","کنست")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--site",type=Path,required=True)
    args=ap.parse_args()
    data=args.site/"data"
    stories=json.loads((data/"stories.json").read_text(encoding="utf-8"))
    figures=json.loads((data/"figures.json").read_text(encoding="utf-8"))
    if not isinstance(stories,list) or not isinstance(figures,dict):
        raise ValueError("Core radar inputs invalid")
    cards=[]
    for item in stories:
        if not isinstance(item,dict) or not item.get("id"): continue
        text=" ".join(str(item.get(k) or "") for k in ("headline_fa","topic_fa","summary_fa")).replace("ي","ی").replace("ك","ک").replace("‌"," ")
        if any(term in text for term in ISRAEL_TERMS):
            cards.append(item)
    cards.sort(key=lambda x:str(x.get("published_at") or x.get("last_seen_at") or ""),reverse=True)
    (data/"israel-radar-news.json").write_text(json.dumps(cards[:60],ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    avatars={}
    for f in figures.get("figures",[]):
        if isinstance(f,dict) and f.get("handle") and f.get("avatar"):
            avatars[str(f["handle"]).lower()]=f["avatar"]
    (data/"us-radar-portraits.json").write_text(json.dumps(avatars,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"Radar light payload: {len(cards[:60])} Israeli news cards, {len(avatars)} avatar references")

if __name__=="__main__":
    main()

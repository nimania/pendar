#!/usr/bin/env python3
"""Conservative evidence extraction from exported news stories.

No forecast, probability or causal certainty is produced from keywords.
Stores attributable evidence and review status for later editorial/AI review.
"""
import argparse
import json
from pathlib import Path
from datetime import datetime, timezone

def build(data_dir):
    files=sorted((data_dir/"story").glob("*.json"))
    index={}
    for p in files:
        try: story=json.loads(p.read_text(encoding="utf-8"))
        except (ValueError,OSError): continue
        if not isinstance(story,dict) or not story.get("id"): continue
        sources=[{"name":x.get("source_name",""),"url":x.get("article_url","")} for x in story.get("sources",[]) if isinstance(x,dict) and x.get("source_name") and str(x.get("article_url","")).startswith(("https://","http://"))]
        facts=[x for x in (story.get("facts") or []) if isinstance(x,str) and x.strip()][:4]
        uncertainties=[x for x in (story.get("uncertainties") or []) if isinstance(x,str) and x.strip()][:4]
        impact={
          "schema_version":1,"status":"pending_editorial_review",
          "status_fa":"در انتظار بررسی تحریری",
          "evidence_basis":"reported_story_material",
          "reported_change":(story.get("what_happened_fa") or story.get("summary_fa") or "").strip()[:600],
          "known_facts":facts,"uncertainties":uncertainties,
          "source_links":sources[:8],
          "independent_sources_claimed":story.get("credibility",{}).get("independent_sources",0) if isinstance(story.get("credibility"),dict) else 0,
          "causal_mechanism":None,"alternative_explanation":None,
          "observable_signals":[],"disconfirming_signals":[],
          "impact_direction":"not_assessed","confidence":"not_assessed",
          "review_history":[],"last_reviewed_at":None
        }
        # Never label automatically scraped/report-summary text as independently verified.
        story["future_impact"]=impact
        p.write_text(json.dumps(story,ensure_ascii=False),encoding="utf-8")
        index[str(story["id"])]= {"status":impact["status"],"sources":len(sources)}
    (data_dir/"future-impact-review-queue.json").write_text(json.dumps({"generated_at":datetime.now(timezone.utc).isoformat(),"items":index},ensure_ascii=False),encoding="utf-8")
    return len(index)

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--data-dir",type=Path,default=Path("site/data"))
    args=parser.parse_args()
    print("Future impact pending review:",build(args.data_dir))

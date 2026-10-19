"""Freeze homepage lead and editorial ordering from already validated site data.

Runs inside Fast Deploy, before the Pages artifact is uploaded. No external
request or invented news; failures prevent replacing the healthy Pages version.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

def title(row):
    return str(row.get("title_fa") or row.get("editorial_report_title_fa") or row.get("headline_fa") or "").strip()

IRAN = ("ایران","ایرانی","هویت ملی","میراث ایران","تاریخ ایران","تمامیت ارضی","آینده ایران","مشروطه","آزادی ایران","ایراندوستی","ایران‌دوستی","ملی‌گرایی")
POLITICAL = ("سیاست","انتخابات","دولت","مجلس","دیپلماسی","تحریم","مذاکره","جنگ","حکمرانی","امنیت","حقوق شهروندی","جامعه مدنی")

def score(row):
    text=(title(row)+" "+str(row.get("category") or row.get("section") or ""))
    return 12*any(t in title(row) for t in IRAN)+6*any(t in text for t in POLITICAL)+3*any(t in text for t in IRAN)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--site",type=Path,required=True)
    args=parser.parse_args()
    data=args.site/"data"
    target=data/"homepage-snapshot.json"
    now=datetime.now(timezone.utc)
    bucket=int(now.timestamp())//1800
    if target.is_file():
        try:
            previous=json.loads(target.read_text(encoding="utf-8"))
            previous_at=datetime.fromisoformat(previous["generated_at"].replace("Z","+00:00"))
            if previous.get("version")==1 and int(previous_at.timestamp())//1800==bucket:
                print("Retaining existing homepage composition for current half-hour slot")
                return
        except (ValueError,KeyError,TypeError,AttributeError):
            pass
    stories=json.loads((data/"stories.json").read_text(encoding="utf-8"))
    archive=json.loads((data/"editorial-archive.json").read_text(encoding="utf-8")) if (data/"editorial-archive.json").exists() else {}
    reports=archive.get("reports",[]) if isinstance(archive,dict) else []
    if not isinstance(stories,list) or not stories:
        raise SystemExit("Refusing empty homepage snapshot")
    ids={str(s.get("id")) for s in stories if s.get("id")}
    viable=[s for s in stories if s.get("id") and title(s)]
    for report in reports:
        if isinstance(report,dict) and report.get("status")=="ai_draft" and str(report.get("id")) in ids and title(report):
            viable.append(report)
    if not viable:
        raise SystemExit("No eligible headline for homepage lead")
    viable.sort(key=lambda r:(score(r),str(r.get("published_at") or "")),reverse=True)
    lead=str(viable[0]["id"])
    ordered=sorted(stories,key=lambda r:str(r.get("published_at") or ""),reverse=True)
    result={
        "version":1,
        "generated_at":datetime.now(timezone.utc).isoformat(),
        "lead_id":lead,
        "story_ids":[str(s["id"]) for s in ordered if s.get("id")],
        "source":"validated-published-site"
    }
    target.write_text(json.dumps(result,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print("Homepage snapshot:",result["generated_at"],"lead",lead,"stories",len(result["story_ids"]))

if __name__=="__main__":
    main()

#!/usr/bin/env python3
"""Publish fresh, fully deployed five-hour voice recaps to @pendario.

Separate GitHubLedger state prevents replay on retries and scheduled runs.
Only pre-existing public site reports are used; never generate content here.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone, timedelta
import html
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit

try:
    from backend.scripts.publish_figures import Telegram, GitHubLedger, TelegramRejected, DeliveryUncertain
except ImportError:
    from publish_figures import Telegram, GitHubLedger, TelegramRejected, DeliveryUncertain

SITE = "https://pendar.io"
STATE = "telegram/voice-recaps-state.json"
MAX_MESSAGE = 3900
AGE_LIMIT_HOURS = 15


def parse_date(value):
    try:
        parsed=datetime.fromisoformat(str(value or "").replace("Z","+00:00"))
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def valid_reports(dataset, now):
    if not isinstance(dataset,dict) or not isinstance(dataset.get("reports"),list):
        raise ValueError("Missing or malformed published voice reports")
    picked={}
    for row in dataset["reports"]:
        if not isinstance(row,dict):
            continue
        ident=str(row.get("id") or "")
        kind=row.get("kind")
        path=str(row.get("url") or "")
        time=parse_date(row.get("generated_at"))
        if (kind not in ("news","opinions") or not ident.endswith("-"+kind) or
                not path.startswith("/reports/voices/") or
                ".." in path or path!=f"/reports/voices/{ident}/" or
                not time or time>now+timedelta(minutes=10) or
                now-time>timedelta(hours=AGE_LIMIT_HOURS)):
            continue
        if not (len(str(row.get("title_fa") or ""))>10 and
                len(str(row.get("lead_fa") or ""))>60 and
                isinstance(row.get("paragraphs"),list) and
                len(row["paragraphs"])>=2 and
                isinstance(row.get("sources"),list) and row["sources"]):
            continue
        picked[ident]=row
    # A single window's news and opinions remain separate Telegram posts.
    return sorted(picked.values(),key=lambda x:(x["window_end"],0 if x["kind"]=="news" else 1,x["id"]))


def link(label,url):
    return '<a href="'+html.escape(url,quote=True)+'">'+html.escape(str(label))+'</a>'


def editorial_text(value):
    """Normalize the repetitive opening without changing attributed claims."""
    value=" ".join(str(value or "").split())
    value=value.replace(
        "بررسی تازه‌ترین دیدگاه‌های منتشرشده در پندار حاکی از",
        "مرور بر تازه‌ترین دیدگاه‌های شخصیت‌های گوناگون، حاکی از", 1)
    return value


def qualified_body(report):
    """Identify people with verified source roles on their first mention."""
    import re
    sources=report.get("sources") or []
    roles={}
    for row in sources:
        if not isinstance(row,dict):
            continue
        name=str(row.get("person") or "").strip()
        role=" ".join(str(row.get("role") or "").split()).strip(" ،،")
        if name and role and name not in roles:
            roles[name]=role
    seen=set()
    pattern=(re.compile(r"(?<!\\w)("+ "|".join(re.escape(n) for n in sorted(roles,key=len,reverse=True))+r")(?!\\w)")
             if roles else None)
    def qualify(value):
        value=editorial_text(value)
        if not pattern:
            return value
        def replace(match):
            name=match.group(0)
            if name in seen:
                return name
            seen.add(name)
            role=roles[name]
            following=value[match.end():].lstrip()
            # Do not double a description already supplied by the editor.
            if following.startswith(("، "+role, "،"+role, "("+role, "("+role)):
                return name
            return name+"، "+role+"،"
        return pattern.sub(replace,value)
    texts=[qualify(report.get("lead_fa") or "")]
    for para in report["paragraphs"]:
        value=str(para.get("text_fa") or "").strip() if isinstance(para,dict) else ""
        if value:
            texts.append(qualify(value))
    return texts


def message(report):
    writer=str(report.get("author_name") or "تحریریهٔ پندار")
    author_url=SITE+"/@"+str(report.get("author_handle") or "desk").replace("/","%2F")+"/"
    url=SITE+str(report["url"])
    # Telegram contains the actual report, not the site headline, recap label,
    # or machine-readable UTC reporting window.
    byline=("\\n\\nتنظیم: "+link(writer,author_url)+
            "\\n"+link("متن کامل، چهره‌ها، خبرها و منابع در پندار ←",url))
    body=qualified_body(report)
    allowance=MAX_MESSAGE-len(byline)-32
    parts=[]
    for text in body:
        value=" ".join(text.split())
        escaped=html.escape(value)
        if len(escaped)>allowance:
            if allowance>=100:
                low,high=0,len(value)
                while low<high:
                    middle=(low+high+1)//2
                    if len(html.escape(value[:middle]+"…"))<=allowance:
                        low=middle
                    else:
                        high=middle-1
                if low:
                    parts.append(html.escape(value[:low].rsplit(" ",1)[0]+"…"))
            break
        parts.append(escaped)
        allowance-=len(escaped)+2
        if allowance<100:
            break
    result="\\n\\n".join(parts)+byline
    if len(result)>MAX_MESSAGE:
        raise ValueError("Telegram recap exceeds message size limit")
    return result


def payload(report,chat_id):
    return {"chat_id":chat_id,"text":message(report),
            "parse_mode":"HTML","disable_web_page_preview":True}


def deliver(reports,ledger,telegram,chat_id,*,now=None,limit=2):
    now=now or datetime.now(timezone.utc)
    selected=valid_reports(reports,now)
    state=ledger.load()
    if state is None:
        # Only fresh reports are eligible; do not replay the historical archive.
        state={"version":1,"channel":str(chat_id),"messages":{},"initialized_at":now.isoformat()}
        ledger.save(state)
    if (state.get("version")!=1 or str(state.get("channel"))!=str(chat_id)
            or not isinstance(state.get("messages"),dict)):
        raise ValueError("Voice recap state is invalid or channel has changed")
    records=state["messages"]
    sent=[]
    for row in selected:
        key=row["id"]
        if len(sent)>=limit:
            break
        if key in records and records[key].get("status") in ("sent","sending"):
            continue
        records[key]={"status":"sending","reserved_at":now.isoformat(),"url":SITE+row["url"]}
        ledger.save(state)  # reserve before calling Telegram: uncertain API results must not duplicate
        try:
            result=telegram.call("sendMessage",payload(row,chat_id))
            if not isinstance(result,dict) or not isinstance(result.get("message_id"),int):
                raise DeliveryUncertain("Telegram did not confirm message_id")
        except TelegramRejected:
            records[key]["status"]="pending"  # explicitly rejected: safe to retry
            ledger.save(state)
            raise
        except DeliveryUncertain:
            # Ambiguous delivery: leave sending, require manual check, no replay.
            print("::warning::Uncertain delivery of",key,": check channel before retry",flush=True)
            raise
        records[key]={"status":"sent","message_id":result["message_id"],
                      "sent_at":now.isoformat(),"url":SITE+row["url"]}
        ledger.save(state)
        sent.append(key)
    return sent


def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument("--input",type=Path,required=True)
    parser.add_argument("--dry-run",action="store_true")
    args=parser.parse_args(argv)
    published=json.loads(args.input.read_text(encoding="utf-8"))
    selected=valid_reports(published,datetime.now(timezone.utc))
    if args.dry_run:
        print(json.dumps([{"id":r["id"],"url":SITE+r["url"],"text":message(r)} for r in selected],
                         ensure_ascii=False,indent=2))
        return 0
    if not selected:
        print("No fresh, valid five-hour reports to publish to Telegram")
        return 0
    token=os.environ.get("TELEGRAM_BOT_TOKEN","").strip()
    repo=os.environ.get("GITHUB_REPOSITORY","").strip()
    gh=os.environ.get("GH_TOKEN","").strip()
    if not token or not repo or not gh:
        raise RuntimeError("Missing Telegram or GitHub delivery-state credentials")
    telegram=Telegram(token)
    chat=telegram.verify(os.environ.get("TELEGRAM_BOT_USERNAME","janekalaam_bot"),
                         os.environ.get("TELEGRAM_CHAT_ID","@pendario"))
    result=deliver(published,GitHubLedger(repo,gh,path=STATE),telegram,chat)
    print("Five-hour voice reports sent:",json.dumps(result,ensure_ascii=False))
    return 0


if __name__=="__main__":
    try:
        sys.exit(main())
    except (RuntimeError,ValueError,OSError,KeyError,TypeError,TelegramRejected,DeliveryUncertain) as exc:
        print("::error::Voice recap Telegram publication interrupted:",type(exc).__name__,file=sys.stderr)
        sys.exit(1)

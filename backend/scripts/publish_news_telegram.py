"""Publish verified, fresh Pendar news selectively to @pendario.

No AI paraphrasing or claims are added: only published story headline and lead.
Persistent sent ledger prevents repeat messages across scheduled runs.
"""
from __future__ import annotations
import argparse
import html
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
try:
    from backend.scripts.publish_figures import Telegram, GitHubLedger, DeliveryUncertain, TelegramRejected
except ImportError:
    from publish_figures import Telegram, GitHubLedger, DeliveryUncertain, TelegramRejected

STATE_PATH = "telegram/news-state.json"
SITE = "https://pendar.io"
POLITICAL_CATEGORIES = {"iran", "politics", "world"}
BAD_TITLES = {"خبر", "بدون عنوان", "در حال به‌روزرسانی"}
AI_ERRORS = ("امکان استخراج", "قابل خلاصه‌سازی نیست", "متن ورودی", "داده‌های ساختاری")

def stamp(value):
    try:
        dt = datetime.fromisoformat(str(value or "").replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None

def eligible(story, now):
    if not isinstance(story, dict):
        return False
    key = str(story.get("id") or "")
    title = str(story.get("headline_fa") or story.get("title_fa") or "").strip()
    lead = str(story.get("summary_fa") or story.get("lead_fa") or "").strip()
    published = stamp(story.get("published_at"))
    if not key or len(title)<18 or len(title)>180 or title in BAD_TITLES:
        return False
    if not lead or len(lead)<75 or any(x in lead for x in AI_ERRORS):
        return False
    if not published or not now-timedelta(hours=10)<=published<=now+timedelta(minutes=10):
        return False
    if story.get("is_hidden") or story.get("hidden") or story.get("status") in ("draft","ai_draft"):
        return False
    # Reject single-source inflammatory claims without review rather than risk misreporting.
    risky = ("کشته", "ترور", "اعدام", "حمله نظامی", "اتهام", "تجاوز", "بازداشت")
    if any(term in title for term in risky) and int(story.get("source_count") or 0)<2:
        return False
    return True

def choose(stories, state, now, limit=2):
    seen=set(state.get("seen", []))
    candidates=[s for s in stories if eligible(s,now) and str(s.get("id")) not in seen]
    candidates.sort(key=lambda s:(float(s.get("importance_score") or 0),
                                  stamp(s.get("published_at"))),reverse=True)
    selected=[]; groups=set()
    for s in candidates:
        group=str(s.get("category") or "other")
        if group in groups and len(candidates)>limit:
            continue
        selected.append(s);groups.add(group)
        if len(selected)>=limit:break
    if len(selected)<limit:
        selected.extend(s for s in candidates if s not in selected and len(selected)<limit)
    return selected

def message(story):
    title=html.escape(str(story.get("headline_fa") or story.get("title_fa") or "").strip())
    lead=str(story.get("summary_fa") or story.get("lead_fa") or "").strip()
    # Summarize by trimming at a sentence boundary only; never invent content.
    if len(lead)>650:
        cut=max(lead.rfind("।",0,600),lead.rfind("。",0,600),lead.rfind(".",0,600),lead.rfind("؛",0,600))
        lead=lead[:cut+1] if cut>=250 else lead[:620].rsplit(" ",1)[0]+"…"
    url=f"{SITE}/story/{story['id']}/"
    return f"<b>{title}</b>\n\n{html.escape(lead)}\n\n<a href=\"{html.escape(url,quote=True)}\">متن کامل و منابع در پندار ←</a>\n\n@pendario"

def publish(stories, ledger, telegram, chat_id, now=None):
    now=now or datetime.now(timezone.utc)
    state=ledger.load()
    if state is None:
        # On first run, baseline old stories so no backlog floods the channel.
        state={"version":1,"seen":[str(s.get("id")) for s in stories if s.get("id")],
               "initialized_at":now.isoformat()}
        ledger.save(state)
        print("News baseline initialized; no old posts sent")
        return 0
    seen=set(state.get("seen",[]))
    sent=0
    for story in choose(stories,state,now):
        key=str(story["id"])
        seen.add(key)
        state["seen"]=sorted(seen)
        ledger.save(state)  # reserve BEFORE send: no accidental duplicates on uncertain delivery
        try:
            telegram.call("sendMessage",{"chat_id":chat_id,"text":message(story),
                   "parse_mode":"HTML","disable_web_page_preview":True})
        except (DeliveryUncertain,TelegramRejected):
            print("::error::News send failed or uncertain; reserved item needs manual review")
            raise
        sent+=1
        print("Published news story",key)
    # Bound old keys eventually, but never drop recent ids.
    if len(state.get("seen",[]))>6000:
        state["seen"]=state["seen"][-4000:]
        ledger.save(state)
    return sent

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--stories",type=Path,required=True)
    p.add_argument("--dry-run",action="store_true")
    args=p.parse_args()
    stories=json.loads(args.stories.read_text(encoding="utf-8"))
    if not isinstance(stories,list) or not stories:
        raise ValueError("Invalid or empty published news dataset")
    if args.dry_run:
        selection=choose(stories,{"seen":[]},datetime.now(timezone.utc))
        for s in selection: print(message(s)+"\n----")
        print("Eligible preview:",len(selection))
        return
    token=os.environ.get("TELEGRAM_BOT_TOKEN","").strip()
    if not token:raise RuntimeError("Missing TELEGRAM_BOT_TOKEN")
    gh=os.environ.get("GH_TOKEN","").strip()
    repo=os.environ.get("GITHUB_REPOSITORY","").strip()
    if not gh or not repo:raise RuntimeError("Missing GitHub state credentials")
    telegram=Telegram(token)
    chat=telegram.verify("janekalaam_bot","@pendario")
    print("News published:",publish(stories,GitHubLedger(repo,gh,path=STATE_PATH),telegram,chat))

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("::error::Telegram editorial news job failed:",type(exc).__name__,file=sys.stderr)
        sys.exit(1)

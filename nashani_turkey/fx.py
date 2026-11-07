#!/usr/bin/env python3
"""Publish verified TRY exchange-rate updates to Nashani Turkiye.

TCMB indicative FX is business-day reference data, NOT intraday market quotes.
Iran free-market IRR must come from a separately validated provider; do not
substitute official/interbank IRR for Iranian street-market prices.
"""
from __future__ import annotations
import argparse
import base64
from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET
import json
import os
import sys

TCMB="https://www.tcmb.gov.tr/kurlar/today.xml"
REPO=os.getenv("GITHUB_REPOSITORY","nimania/pendar")
BRANCH="nashani-state"
PATH="nashani/turkiye-fx-state.json"
CHAT="@neshaniturkiye"
BOT="neshanikermanbot"
MIN_CHANGE=Decimal("0.30")
TZ=timezone(timedelta(hours=3))
def req(url,body=None,token=None,method=None):
    content=json.dumps(body,ensure_ascii=False).encode() if body is not None else None
    headers={"User-Agent":"NashaniTurkiyeFX/1.0","Accept":"application/vnd.github+json,application/json"}
    if content is not None:headers["Content-Type"]="application/json"
    if token: headers["Authorization"]="Bearer "+token
    request=Request(url,data=content,headers=headers,method=method or ("POST" if content else "GET"))
    with urlopen(request,timeout=20) as response:return response.read()
def api(token,method,payload=None):
    if not token:raise RuntimeError("Bot token missing")
    try: output=json.loads(req("https://api.telegram.org/bot"+token+"/"+method,payload))
    except HTTPError as e:raise RuntimeError("Bot API "+method+" HTTP "+str(e.code)) from None
    if not output.get("ok"):raise RuntimeError("Bot API "+method+" failed")
    return output["result"]
def verified_chat(token):
    bot=api(token,"getMe")
    if bot.get("username","").lower()!=BOT:raise RuntimeError("Unexpected bot")
    chat=api(token,"getChat",{"chat_id":CHAT})
    if chat.get("type")!="channel" or chat.get("username","").lower()!="neshaniturkiye":
        raise RuntimeError("Unexpected channel")
    member=api(token,"getChatMember",{"chat_id":CHAT,"user_id":bot["id"]})
    if member.get("status") not in ("administrator","creator") or (
        member.get("status")=="administrator" and member.get("can_post_messages") is not True):
        raise RuntimeError("Bot cannot post to Turkiye")
    return chat["id"]
def fetch_rates():
    root=ET.fromstring(req(TCMB))
    source_date=(root.attrib.get("Tarih") or "").strip()
    if not source_date:raise RuntimeError("TCMB rate date missing")
    observed=datetime.strptime(source_date,"%d.%m.%Y").date()
    now=datetime.now(TZ).date()
    if observed>now or (now-observed).days>4:raise RuntimeError("TCMB bulletin stale")
    rates={}
    for item in root.findall("Currency"):
        symbol=item.attrib.get("Kod","")
        if symbol not in ("USD","EUR","GBP"):continue
        unit=Decimal(item.findtext("Unit") or "1")
        buy=Decimal((item.findtext("ForexBuying") or "").strip())
        sell=Decimal((item.findtext("ForexSelling") or "").strip())
        if unit<=0 or buy<=0 or sell<=0 or sell<buy:raise ValueError("Invalid TCMB quote")
        rates[symbol]={"try_buy":buy/unit,"try_sell":sell/unit}
    if len(rates)!=3:raise RuntimeError("TCMB missing currency")
    return source_date,rates
def state_url():
    return "https://api.github.com/repos/"+REPO+"/contents/"+PATH
def load(gh):
    try:
        data=json.loads(req(state_url()+"?ref="+BRANCH,token=gh))
    except HTTPError as error:
        if error.code==404:return {"entries":{}},None
        raise
    return json.loads(base64.b64decode(data["content"])),data["sha"]
def save(gh,state,sha):
    payload={"message":"chore(nashani): checkpoint Turkey FX","branch":BRANCH,
             "content":base64.b64encode((json.dumps(state,ensure_ascii=False,indent=2)+"\n").encode()).decode()}
    if sha:payload["sha"]=sha
    req(state_url(),payload,token=gh,method="PUT")
def change_percent(now,old):
    old=Decimal(str(old))
    return abs((now-old)*100/old) if old else Decimal("999")
def fmt(v):
    return f"{v:,.4f}".rstrip("0").rstrip(".")
def message(day,rates):
    lines=["💱 <b>نرخ ارز در ترکیه | لیر ترکیه</b>","",
           "📅 تاریخ نرخ مرجع: "+day,
           "📍 منبع: بانک مرکزی جمهوری ترکیه (TCMB)",""]
    for currency,persian in (("USD","دلار آمریکا"),("EUR","یورو"),("GBP","پوند بریتانیا")):
        q=rates[currency]
        lines.append("▫️ "+persian+": خرید "+fmt(q["try_buy"])+" و فروش "+fmt(q["try_sell"])+" لیر")
    lines+=["","🇮🇷 نرخ لیر به ریال بازار آزاد ایران: در انتظار منبع تأییدشده؛ نرخ رسمی جایگزین نمی‌شود.",
            "⚠️ این نرخ‌ها مرجع روزانه‌اند، نه قیمت لحظه‌ای صرافی؛ نرخ واقعی معامله ممکن است متفاوت باشد.",
            "#نشانی_ترکیه #نرخ_ارز #لیر #دلار #یورو #پوند"]
    return "\n".join(lines)
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--dry-run",action="store_true")
    parser.add_argument("--check-connection",action="store_true")
    args=parser.parse_args()
    token=os.getenv("NASHANI_TELEGRAM_BOT_TOKEN","")
    if args.check_connection:
        print("Verified channel",verified_chat(token))
        return
    day,rates=fetch_rates()
    if args.dry_run:
        print(message(day,rates))
        return
    gh=os.getenv("GITHUB_TOKEN","")
    if not gh:raise RuntimeError("GITHUB_TOKEN missing")
    state,sha=load(gh)
    current={k:str((v["try_buy"]+v["try_sell"])/2) for k,v in rates.items()}
    prior=state.get("last",{})
    if prior.get("day")==day:
        print("Same TCMB bulletin date; no duplicate")
        return
    if prior and not any(change_percent(Decimal(current[k]),prior["mid"][k])>=MIN_CHANGE
                         for k in current if k in prior.get("mid",{})):
        print("New bulletin, but no material rate change")
        state["last"]={"day":day,"mid":current}
        save(gh,state,sha)
        return
    chat=verified_chat(token)
    # Reservation blocks automatic retries after ambiguous transport results.
    state.setdefault("entries",{})[day]={"status":"sending_uncertain"}
    save(gh,state,sha)
    state,sha=load(gh)
    result=api(token,"sendMessage",{"chat_id":chat,"text":message(day,rates),"parse_mode":"HTML",
                                     "link_preview_options":{"is_disabled":True}})
    state["entries"][day]={"status":"published","message_id":result["message_id"]}
    state["last"]={"day":day,"mid":current}
    state["entries"]=dict(sorted(state["entries"].items())[-60:])
    save(gh,state,sha)
    print("Published TCMB rates",day)
if __name__=="__main__":
    try:main()
    except Exception as error:
        print("Turkey FX error:",type(error).__name__,str(error)[:160],file=sys.stderr)
        sys.exit(1)

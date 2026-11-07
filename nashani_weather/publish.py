#!/usr/bin/env python3
"""Four daily Nashani forecasts. Official AQI and model estimates are distinct."""
from __future__ import annotations
import argparse
import base64
import json
import os
import sys
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from app.weather.service import fetch_weather

COORDS={"کرمان":(30.2839,57.0834),"تهران":(35.6892,51.3890)}

TZ = ZoneInfo("Asia/Tehran")
STATE_PATH = "nashani/weather-state.json"
STATE_BRANCH = "nashani-state"
REPO = os.getenv("GITHUB_REPOSITORY", "nimania/pendar")
CITIES = {
    "کرمان": {"chat_id": -1003958286892, "expected_title": "نشانی: کرمان", "tag": "#نشانی_کرمان"},
    "تهران": {"chat_id": "@neshanitehran", "username": "neshanitehran", "expected_title": "نشانی: تهران", "tag": "#نشانی_تهران"},
}
CONDITIONS = {"good":"پاک","moderate":"قابل قبول","sensitive":"ناسالم برای گروه‌های حساس",
              "unhealthy":"ناسالم","very-unhealthy":"بسیار ناسالم","hazardous":"خطرناک"}

def request(url, payload=None, token=None, method=None):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    headers = {"Accept":"application/json","User-Agent":"NashaniWeather/1.0"}
    if token:
        headers["Authorization"] = "Bearer " + token
    if data is not None:
        headers["Content-Type"]="application/json"
    req = Request(url, data=data, headers=headers, method=method or ("POST" if data else "GET"))
    with urlopen(req, timeout=25) as resp:
        return json.load(resp)

def bot_call(token, method, payload=None):
    # Never log token-bearing URL.
    try:
        r = request("https://api.telegram.org/bot"+token+"/"+method, payload)
    except HTTPError as exc:
        raise RuntimeError("Telegram "+method+" HTTP "+str(exc.code)) from None
    if not r.get("ok"):
        raise RuntimeError("Telegram "+method+" failed")
    return r["result"]

def verify(token, city):
    cfg = CITIES[city]
    me = bot_call(token, "getMe")
    if me.get("username","").lower() != "neshanikermanbot":
        raise RuntimeError("Unexpected bot identity")
    chat = bot_call(token, "getChat", {"chat_id":cfg["chat_id"]})
    if chat.get("type") != "channel" or chat.get("title","").strip() != cfg["expected_title"]:
        raise RuntimeError("Destination title/type mismatch: "+city)
    if cfg.get("username") and chat.get("username","").lower() != cfg["username"]:
        raise RuntimeError("Destination username mismatch: "+city)
    if isinstance(cfg["chat_id"], int) and chat.get("id") != cfg["chat_id"]:
        raise RuntimeError("Destination numeric ID mismatch")
    membership = bot_call(token, "getChatMember", {"chat_id":cfg["chat_id"], "user_id":me["id"]})
    if membership.get("status") not in ("administrator","creator"):
        raise RuntimeError("Bot is not channel administrator")
    if membership.get("status") == "administrator" and membership.get("can_post_messages") is not True:
        raise RuntimeError("Bot cannot post")
    return cfg["chat_id"]

def state_endpoint():
    return "https://api.github.com/repos/"+REPO+"/contents/"+quote(STATE_PATH,safe="/")

def load_state(gh):
    try:
        data=request(state_endpoint()+"?ref="+STATE_BRANCH,token=gh)
    except HTTPError as e:
        if e.code == 404:
            return {"sent":{}}, None
        raise
    return json.loads(base64.b64decode(data["content"])),data["sha"]

def save_state(gh,state,sha):
    body={"message":"chore(nashani): checkpoint daily weather posts",
          "branch":STATE_BRANCH,
          "content":base64.b64encode((json.dumps(state,ensure_ascii=False,indent=2)+"\n").encode()).decode()}
    if sha:
        body["sha"]=sha
    return request(state_endpoint(),body,token=gh,method="PUT")

def forecast_three_days(city):
    lat,lon=COORDS[city]
    params=urlencode({"latitude":lat,"longitude":lon,"daily":"temperature_2m_max,temperature_2m_min,precipitation_probability_max",
                      "timezone":"Asia/Tehran","forecast_days":3})
    try:
        d=request("https://api.open-meteo.com/v1/forecast?"+params)["daily"]
        dates=d.get("time") or []
        out=[]
        for i in range(min(3,len(dates))):
            high=(d.get("temperature_2m_max") or [])[i]
            low=(d.get("temperature_2m_min") or [])[i]
            rain=(d.get("precipitation_probability_max") or [])[i]
            if high is None or low is None:
                continue
            label=("امروز" if i==0 else "فردا" if i==1 else "پس‌فردا")
            out.append(label+": "+str(round(low))+" تا "+str(round(high))+"° | احتمال بارش "+(str(round(rain))+"٪" if rain is not None else "نامشخص"))
        return out
    except (HTTPError, OSError, KeyError, TypeError, IndexError, ValueError):
        return []

def fmt(value, unit=""):
    return "نامشخص" if value is None else str(value)+unit

def compose(row,city,now):
    cfg=CITIES[city]
    head="🌤 <b>هوا و کیفیت هوای "+city+" | "+now.strftime("%Y/%m/%d")+" </b>"
    lines=[head,"",
           "🌡 دمای فعلی: "+fmt(row.get("temp")," درجه"),
           "📈 کمینه و بیشینه امروز: "+fmt(row.get("min"))+" تا "+fmt(row.get("max"))+" درجه",
           "☁️ وضعیت: "+str(row.get("cond_fa") or "نامشخص")]
    days=row.get("three_days") or []
    if days:
        lines+=["","📅 پیش‌بینی سه‌روزه:"]+["• "+day for day in days]
    aqi=row.get("aqi")
    if aqi is not None:
        label=CONDITIONS.get(row.get("aqi_class"),row.get("aqi_label") or "نامشخص")
        src="اندازه‌گیری رسمی سازمان حفاظت محیط‌زیست" if not row.get("air_estimated",True) else "برآورد مدل Open-Meteo/CAMS؛ نه اندازه‌گیری ایستگاهی"
        lines += ["","🌫 کیفیت هوا (مقیاس AQI آمریکا): "+str(aqi)+" — "+label,
                  "📍 منبع شاخص: "+src]
        if row.get("air_observed_at"):
            lines.append("🕒 زمان داده کیفیت هوا: "+str(row["air_observed_at"]))
    else:
        lines+=["","🌫 شاخص کیفیت هوا: داده معتبر در دسترس نیست"]
    trends=row.get("air_forecast") or []
    if trends:
        values=["+"+str(x.get("hours"))+" ساعت: "+str(x.get("aqi")) for x in trends if x.get("aqi") is not None]
        if values:
            lines+=["🔭 پیش‌بینی مدل کیفیت هوا: "+" | ".join(values)]
    lines+=["","منبع هواشناسی: Open-Meteo | "+cfg["tag"]+" #هواشناسی #آلودگی_هوا"]
    return "\n".join(lines)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--dry-run",action="store_true")
    ap.add_argument("--check-connection",action="store_true")
    args=ap.parse_args()
    now=datetime.now(TZ)
    slot=("morning" if now.hour < 9 else "midday" if now.hour < 14 else "afternoon" if now.hour < 19 else "night")
    token=os.getenv("NASHANI_TELEGRAM_BOT_TOKEN","")
    if args.check_connection:
        for city in CITIES:
            verify(token,city)
            print("Verified",city)
        return
    rows={x["city_fa"]:x for x in fetch_weather()}
    if not rows:
        raise RuntimeError("No weather data: nothing sent")
    gh=os.getenv("GITHUB_TOKEN","")
    if not args.dry_run and not gh:
        raise RuntimeError("No GitHub state token")
    state,sha=({"sent":{}},None) if args.dry_run else load_state(gh)
    for city in CITIES:
        row=rows.get(city)
        if not row or row.get("temp") is None:
            print("Skipping incomplete forecast",city)
            continue
        row["three_days"]=forecast_three_days(city)
        message=compose(row,city,now)
        if args.dry_run:
            print(city,"\n",message,"\n")
            continue
        key=now.strftime("%Y-%m-%d")+"-"+slot+"-"+city
        if key in state.setdefault("sent",{}):
            print("Already sent",key)
            continue
        chat=verify(token,city)
        # Fail closed on delivery ambiguity: reserve before posting, never auto-retry.
        state["sent"][key]={"status":"sending_uncertain","at":now.isoformat()}
        save_state(gh,state,sha)
        state,sha=load_state(gh)
        delivered=bot_call(token,"sendMessage",{"chat_id":chat,"text":message,"parse_mode":"HTML","link_preview_options":{"is_disabled":True}})
        state["sent"][key]={"status":"published","message_id":delivered["message_id"],"at":now.isoformat()}
        save_state(gh,state,sha)
        state,sha=load_state(gh)
        print("Published",city,key)
    # Bound state growth.
    if len(state.get("sent",{}))>160 and not args.dry_run:
        state["sent"]=dict(sorted(state["sent"].items())[-120:])
        save_state(gh,state,sha)

if __name__=="__main__":
    try:
        main()
    except Exception as exc:
        print("Nashani weather failed:",type(exc).__name__,str(exc)[:180],file=sys.stderr)
        sys.exit(1)

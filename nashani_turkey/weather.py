#!/usr/bin/env python3
"""Nashani Turkiye: sourced city weather & modelled air-quality bulletins.

Publishes one six-city digest per Istanbul-local time slot, through the
existing Nashani Telegram bot. Does not label CAMS model as station data.
"""
from __future__ import annotations
import argparse
import base64
import html
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Istanbul")
REPO = os.getenv("GITHUB_REPOSITORY", "nimania/pendar")
BRANCH = "nashani-state"
STATE_PATH = "nashani/turkiye-weather-state.json"
CHANNEL = "@neshaniturkiye"
BOT_NAME = "neshanikermanbot"
CITIES = (
    ("استانبول", 41.0082, 28.9784),
    ("آنتالیا", 36.8969, 30.7133),
    ("آنکارا", 39.9334, 32.8597),
    ("ازمیر", 38.4237, 27.1428),
    ("وان", 38.4942, 43.3800),
    ("دنیزلی", 37.7765, 29.0864),
)
FORECAST = "https://api.open-meteo.com/v1/forecast"
AIR = "https://air-quality-api.open-meteo.com/v1/air-quality"
WMO = {0:"صاف",1:"عمدتاً صاف",2:"نیمه‌ابری",3:"ابری",45:"مه",48:"مه",
       51:"نم‌نم باران",53:"نم‌نم باران",55:"نم‌نم باران",
       61:"باران",63:"باران",65:"باران شدید",71:"برف",73:"برف",75:"برف سنگین",
       80:"رگبار",81:"رگبار",82:"رگبار شدید",85:"رگبار برف",86:"برف شدید",
       95:"رعدوبرق",96:"تگرگ و رعدوبرق",99:"تگرگ و رعدوبرق"}
AQI = ((50,"پاک"),(100,"قابل قبول"),(150,"ناسالم برای گروه‌های حساس"),
       (200,"ناسالم"),(300,"بسیار ناسالم"),(9999,"خطرناک"))

def http(url, payload=None, auth=None, method=None):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8") if payload is not None else None
    headers = {"Accept":"application/json", "User-Agent":"NashaniTurkiyeWeather/1.0"}
    if auth: headers["Authorization"] = "Bearer " + auth
    if data is not None: headers["Content-Type"] = "application/json"
    req = Request(url, data=data, headers=headers, method=method or ("POST" if data else "GET"))
    with urlopen(req, timeout=22) as response:
        return json.load(response)

def bot_call(token, method, params=None):
    if not token: raise RuntimeError("Telegram token not configured")
    try:
        result = http("https://api.telegram.org/bot"+token+"/"+method, params)
    except HTTPError as error:
        raise RuntimeError("Telegram "+method+" HTTP "+str(error.code)) from None
    if result.get("ok") is not True:
        raise RuntimeError("Telegram "+method+" rejected request")
    return result["result"]

def verify_channel(token):
    me = bot_call(token,"getMe")
    if me.get("username","").lower() != BOT_NAME: raise RuntimeError("Wrong bot identity")
    chat = bot_call(token,"getChat",{"chat_id":CHANNEL})
    if chat.get("type")!="channel" or chat.get("username","").lower()!="neshaniturkiye":
        raise RuntimeError("Telegram channel mismatch")
    member = bot_call(token,"getChatMember",{"chat_id":CHANNEL,"user_id":me["id"]})
    if member.get("status") not in ("administrator","creator") or (
        member.get("status")=="administrator" and member.get("can_post_messages") is not True
    ): raise RuntimeError("Bot does not have posting rights")
    return chat["id"]

def local_dt(raw):
    if not raw: return None
    try:
        t=datetime.fromisoformat(raw.replace("Z","+00:00"))
        return t.replace(tzinfo=TZ) if t.tzinfo is None else t.astimezone(TZ)
    except ValueError:
        return None

def api_forecast(city,lat,lon,now):
    params=urlencode({
        "latitude":lat,"longitude":lon,"timezone":"Europe/Istanbul",
        "current":"temperature_2m,weather_code,wind_speed_10m",
        "daily":"temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "forecast_days":3})
    data=http(FORECAST+"?"+params)
    current=data.get("current") or {}
    daily=data.get("daily") or {}
    observed=local_dt(current.get("time"))
    if not observed or abs((now-observed).total_seconds())>3*3600:
        raise ValueError("Missing or stale weather observations for "+city)
    if current.get("temperature_2m") is None or current.get("weather_code") is None:
        raise ValueError("Incomplete forecast for "+city)
    if not daily.get("time") or not daily.get("temperature_2m_max") or not daily.get("temperature_2m_min"):
        raise ValueError("Missing daily forecast for "+city)
    outlook=[]
    for index,day in enumerate(daily["time"][:3]):
        high=(daily.get("temperature_2m_max") or [])
        low=(daily.get("temperature_2m_min") or [])
        rain=(daily.get("precipitation_probability_max") or [])
        if index>=len(high) or index>=len(low) or high[index] is None or low[index] is None: continue
        p=rain[index] if index<len(rain) else None
        outlook.append((day,round(low[index]),round(high[index]),round(p) if p is not None else None))
    return {"city":city,"observed":observed.isoformat(),"temp":round(current["temperature_2m"]),
            "condition":WMO.get(current["weather_code"],"نامشخص"),"wind":current.get("wind_speed_10m"),
            "outlook":outlook}

def api_air(lat,lon,now):
    params=urlencode({"latitude":lat,"longitude":lon,
        "hourly":"us_aqi,pm2_5","timezone":"Europe/Istanbul",
        "forecast_days":2})
    data=http(AIR+"?"+params)
    h=data.get("hourly") or {}
    times=h.get("time") or []
    vals=h.get("us_aqi") or []
    choices=[]
    for i,raw in enumerate(times):
        t=local_dt(raw)
        if t and i<len(vals) and vals[i] is not None and abs((t-now).total_seconds())<=2*3600:
            choices.append((abs((t-now).total_seconds()),i,t))
    if not choices: return None
    _,idx,t=min(choices)
    val=round(vals[idx])
    if val<0 or val>500: return None
    label=next((label for limit,label in AQI if val<=limit),"نامشخص")
    return {"aqi":val,"label":label,"time":t.isoformat(),"source":"Open-Meteo/CAMS model"}

def collect(now):
    rows=[]
    for city,lat,lon in CITIES:
        try: row=api_forecast(city,lat,lon,now)
        except Exception as error:
            print("Skipping weather for",city,type(error).__name__,file=sys.stderr)
            continue
        try: row["air"]=api_air(lat,lon,now)
        except Exception as error:
            print("Air data unavailable for",city,type(error).__name__,file=sys.stderr)
            row["air"]=None
        rows.append(row)
    return rows

def render(rows,now):
    lines=["🌤 <b>هوا و کیفیت هوای شهرهای ترکیه</b>",
           "🕒 "+now.strftime("%Y-%m-%d %H:%M")+" به وقت ترکیه",""]
    for row in rows:
        lines.append("📍 <b>"+html.escape(row["city"])+"</b>")
        lines.append("🌡 "+str(row["temp"])+"°C | "+html.escape(row["condition"]))
        if row["outlook"]:
            days=row["outlook"]
            today=days[0]
            lines.append("امروز: "+str(today[1])+" تا "+str(today[2])+" درجه"+(
                " | احتمال بارش "+str(today[3])+"٪" if today[3] is not None else ""))
            if len(days)>1:
                tomorrow=days[1]
                lines.append("فردا: "+str(tomorrow[1])+" تا "+str(tomorrow[2])+" درجه"+(
                    " | احتمال بارش "+str(tomorrow[3])+"٪" if tomorrow[3] is not None else ""))
        air=row.get("air")
        if air: lines.append("🌫 شاخص برآوردی AQI آمریکا: "+str(air["aqi"])+" ("+air["label"]+")")
        else: lines.append("🌫 داده معتبر کیفیت هوا در دسترس نیست")
        lines.append("")
    lines.extend(["📡 هواشناسی: Open-Meteo | کیفیت هوا: مدل CAMS / Open-Meteo",
                  "شاخص آلودگی برآورد مدل است، نه اندازه‌گیری رسمی ایستگاه‌ها.",
                  "زمان داده‌ها هنگام دریافت کنترل شده است.",
                  "#نشانی_ترکیه #هواشناسی #آلودگی_هوا"])
    return "\n".join(lines)

def state_endpoint():
    return "https://api.github.com/repos/"+REPO+"/contents/"+quote(STATE_PATH,safe="/")

def load_state(gh):
    try: data=http(state_endpoint()+"?ref="+BRANCH,auth=gh)
    except HTTPError as error:
        if error.code==404:return {"slots":{}},None
        raise
    return json.loads(base64.b64decode(data["content"])),data["sha"]

def save_state(gh,state,sha):
    payload={"branch":BRANCH,"message":"chore(nashani): checkpoint Turkiye weather",
             "content":base64.b64encode((json.dumps(state,ensure_ascii=False,indent=2)+"\n").encode()).decode()}
    if sha:payload["sha"]=sha
    http(state_endpoint(),payload,auth=gh,method="PUT")

def slot_key(now):
    # Eight-hour weekly cron offsets are not slot keys: each of four windows has unique ID.
    hour=now.hour
    slot="morning" if hour<9 else "midday" if hour<14 else "afternoon" if hour<19 else "night"
    return now.strftime("%Y-%m-%d")+"-"+slot

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--dry-run",action="store_true")
    parser.add_argument("--check-connection",action="store_true")
    args=parser.parse_args()
    token=os.getenv("NASHANI_TELEGRAM_BOT_TOKEN","")
    if args.check_connection:
        print("Verified channel ID:",verify_channel(token))
        return
    now=datetime.now(TZ)
    rows=collect(now)
    if len(rows)<4:
        raise RuntimeError("Too few valid city forecasts; fail closed")
    message=render(rows,now)
    if len(message)>4096: raise RuntimeError("Telegram message exceeds limit")
    if args.dry_run:
        print(message)
        return
    gh=os.getenv("GITHUB_TOKEN","")
    if not gh:raise RuntimeError("GITHUB_TOKEN missing")
    state,sha=load_state(gh)
    key=slot_key(now)
    if key in state.setdefault("slots",{}):
        print("Already reserved or published:",key)
        return
    chat=verify_channel(token)
    state["slots"][key]={"status":"sending_uncertain","at":now.isoformat()}
    save_state(gh,state,sha)
    state,sha=load_state(gh)
    sent=bot_call(token,"sendMessage",{"chat_id":chat,"text":message,"parse_mode":"HTML",
                                       "link_preview_options":{"is_disabled":True}})
    state["slots"][key]={"status":"published","message_id":sent["message_id"],"at":now.isoformat()}
    state["slots"]=dict(sorted(state["slots"].items())[-90:])
    save_state(gh,state,sha)
    print("Published Turkiye weather",key,sent["message_id"])

if __name__=="__main__":
    try:main()
    except Exception as error:
        print("Nashani Turkiye weather failed:",type(error).__name__,str(error)[:150],file=sys.stderr)
        sys.exit(1)

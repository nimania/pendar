#!/usr/bin/env python3
"""Publish three evergreen launch posts for Nashani Turkiye once, with verified bot."""
import base64
import json
import os
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from urllib.parse import quote

REPO=os.getenv("GITHUB_REPOSITORY","nimania/pendar")
BRANCH="nashani-state"
PATH="nashani/turkiye-launch-state.json"
CHANNEL="@neshaniturkiye"
BOT_USERNAME="neshanikermanbot"

POSTS=[
("introduction", """📍 <b>نشانی: ترکیه | به کانال خوش آمدید</b>

اینجا خبرهایی را دنبال می‌کنیم که بر زندگی ایرانیان در ترکیه و سفر به این کشور اثر دارند؛ نه صرفاً تیترهای عمومی.

🔹 تغییر قوانین مهاجرت، اقامت، کار و تحصیل
🔹 پروازهای ایران–ترکیه و وضعیت فرودگاه‌ها
🔹 اخبار خدمات شهری، هواشناسی و کیفیت هوا
🔹 اطلاعیه‌های مهم و هشدارهای فوری

اولویت شهرها: استانبول، آنتالیا، آنکارا و ازمیر؛ وان و دنیزلی نیز پوشش داده می‌شوند. خبرهای مهم مهاجرتی و پروازی در همه شهرها بدون محدودیت جغرافیایی در اولویت‌اند.

خبرها به فارسی، با ذکر منبع و با تفکیک گزارش رسانه‌ای از اطلاعیه رسمی منتشر می‌شوند.

#نشانی_ترکیه #ایرانیان_ترکیه"""),
("immigration", """🛂 <b>رادار مهاجرت و اقامت | نشانی: ترکیه</b>

در این کانال، موضوعاتی مانند اقامت توریستی، تمدید اقامت، ثبت نشانی، اجازه کار، ویزا، تابعیت و مقررات مرتبط با اتباع خارجی را در اولویت قرار می‌دهیم.

🔹 مرجع اصلی تغییرات: اداره مهاجرت ترکیه (Göç İdaresi)، روزنامه رسمی (Resmî Gazete) و نهاد مسئول هر موضوع
🔹 برای هر تغییر مهم، تاریخ اعلام و تاریخ اجرا را جداگانه ذکر می‌کنیم.
🔹 انتشار یک ادعا در رسانه به‌تنهایی به معنای تصویب یا اجرایی‌شدن قانون نیست.

این کانال جایگزین مشاوره حقوقی یا اطلاعیه رسمی نهادهای ترکیه نیست.

#نشانی_ترکیه #اقامت_ترکیه #مهاجرت"""),
("flights_weather", """✈️ <b>پروازهای ایران–ترکیه و وضعیت شهرها</b>

اخبار لغو یا تأخیر پروازها، تغییر مسیرها، محدودیت فرودگاه‌ها و مقررات ورود و ترانزیت را برای تمام شهرهای ایران و ترکیه رصد می‌کنیم.

یکی از منابع رصد، کانال @iran_flights_watcher است که از سابقه انجام یا لغو پروازها گزارش می‌دهد. داده‌های مهم تا حد امکان با تابلوهای رسمی فرودگاه یا اطلاعیه شرکت هواپیمایی تطبیق داده می‌شوند.

⚠️ سابقه پروازها تضمینی برای انجام پرواز بعدی نیست. تصمیم خرید بلیت با خود مسافر است و تهیه‌کننده این آمار مسئولیتی درباره تصمیم خرید و پیامدهای آن نمی‌پذیرد.

🌤 گزارش هواشناسی و کیفیت هوا برای استانبول، آنتالیا، آنکارا، ازمیر، وان و دنیزلی نیز در برنامه کانال قرار دارد. داده‌های پیش‌بینی با اندازه‌گیری رسمی تفکیک می‌شوند.

#نشانی_ترکیه #پرواز_ایران_ترکیه #هواشناسی""")
]

def json_request(url,payload=None,token=None,method=None):
    raw=json.dumps(payload,ensure_ascii=False).encode() if payload is not None else None
    headers={"Accept":"application/vnd.github+json,application/json","User-Agent":"NashaniTurkiyeLaunch/1.0"}
    if token:headers["Authorization"]="Bearer "+token
    if raw is not None:headers["Content-Type"]="application/json"
    req=Request(url,data=raw,headers=headers,method=method or ("POST" if raw is not None else "GET"))
    with urlopen(req,timeout=25) as resp:return json.load(resp)

def bot_call(token,method,payload=None):
    try:
        response=json_request("https://api.telegram.org/bot"+token+"/"+method,payload)
    except HTTPError as e:
        raise RuntimeError("Telegram "+method+" HTTP "+str(e.code)) from None
    if response.get("ok") is not True:raise RuntimeError("Telegram "+method+" rejected request")
    return response["result"]

def validate(token):
    if not token:raise RuntimeError("Telegram token missing")
    bot=bot_call(token,"getMe")
    if bot.get("username","").lower()!=BOT_USERNAME:raise RuntimeError("Unexpected Telegram bot")
    chat=bot_call(token,"getChat",{"chat_id":CHANNEL})
    if chat.get("type")!="channel" or chat.get("username","").lower()!="neshaniturkiye":
        raise RuntimeError("Telegram channel mismatch")
    member=bot_call(token,"getChatMember",{"chat_id":CHANNEL,"user_id":bot["id"]})
    if member.get("status") not in ("administrator","creator"):raise RuntimeError("Bot is not admin")
    if member.get("status")=="administrator" and member.get("can_post_messages") is not True:
        raise RuntimeError("Bot lacks Post Messages")
    return chat["id"]

def endpoint():
    return "https://api.github.com/repos/"+REPO+"/contents/"+quote(PATH,safe="/")

def load(gh):
    try:
        obj=json_request(endpoint()+"?ref="+BRANCH,token=gh)
    except HTTPError as error:
        if error.code==404:return {"posts":{}},None
        raise
    return json.loads(base64.b64decode(obj["content"])),obj["sha"]

def save(gh,state,sha):
    payload={"message":"chore(nashani): checkpoint Turkey channel launch",
             "branch":BRANCH,"content":base64.b64encode(
                 (json.dumps(state,ensure_ascii=False,indent=2)+"\n").encode()).decode()}
    if sha:payload["sha"]=sha
    json_request(endpoint(),payload,token=gh,method="PUT")

def main():
    token=os.getenv("NASHANI_TELEGRAM_BOT_TOKEN","")
    gh=os.getenv("GITHUB_TOKEN","")
    dry=os.getenv("DRY_RUN","false").lower()=="true"
    if dry:
        for key,body in POSTS:print(key,"\n",body,"\n---")
        return
    if not gh:raise RuntimeError("GitHub token missing")
    chat=validate(token)
    state,sha=load(gh)
    for key,body in POSTS:
        if key in state.setdefault("posts",{}):
            print("Already reserved/published:",key)
            continue
        state["posts"][key]={"status":"sending_uncertain"}
        save(gh,state,sha)
        state,sha=load(gh)
        result=bot_call(token,"sendMessage",{
            "chat_id":chat,"text":body,"parse_mode":"HTML",
            "link_preview_options":{"is_disabled":True}})
        state["posts"][key]={"status":"published","message_id":result["message_id"]}
        save(gh,state,sha)
        state,sha=load(gh)
        print("Published",key,"message_id",result["message_id"])

if __name__=="__main__":
    try:main()
    except Exception as exc:
        print("Nashani Turkiye launch failed:",type(exc).__name__,str(exc)[:140],file=sys.stderr)
        sys.exit(1)

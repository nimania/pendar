#!/usr/bin/env python3
"""Send a reviewed 7x7 crossword widget to one consenting Telegram user.

Does not modify webhooks, updates, groups, channels or scheduled publishers.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import zlib

BOT = os.environ.get("NASHANI_TELEGRAM_BOT_TOKEN", "")
CODE = os.environ.get("JADVAL_COMMAND_CODE", "").strip()
CHAT = os.environ.get("JADVAL_RECIPIENT_CHAT_ID", "").strip()
SEND = os.environ.get("JADVAL_CONFIRM_SEND", "").lower() == "true"
WIDGET = "https://raw.githubusercontent.com/nimania/payamejadval/main/telegram/widget-7x7.html"

def stop(message):
    sys.exit(message)

def telegram(method, body=None):
    req = urllib.request.Request(
        "https://api.telegram.org/bot" + BOT + "/" + method,
        data=json.dumps(body or {}, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=22) as response:
            payload = json.load(response)
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        stop("Telegram operation failed: " + method + " (" + type(exc).__name__ + ")")
    if not payload.get("ok"):
        stop("Telegram rejected " + method + ": " + str(payload.get("description", "unknown")).replace(BOT, "[redacted]"))
    return payload["result"]

if not BOT:
    stop("Missing NASHANI_TELEGRAM_BOT_TOKEN secret.")
me = telegram("getMe")
if me.get("username", "").lower() != "neshanikermanbot":
    stop("Secret belongs to a different bot; refusing to send.")
with urllib.request.urlopen(WIDGET, timeout=15) as response:
    raw = response.read(32769)
if len(raw) > 32768:
    stop("Widget exceeds 32 KB")
if len(zlib.compress(raw, level=9)) > 4096:
    stop("Widget exceeds Telegram 4KB compressed limit")
html = raw.decode("utf-8")
if not SEND:
    print("Dry-run passed: expected bot identity, HTML size and zlib compression verified.")
    print("To send to a user: message the bot /jadval CODE, then run with CODE and confirm_send=true.")
    sys.exit(0)

if CHAT:
    if not re.fullmatch(r"[0-9]{4,18}", CHAT):
        stop("Invalid recipient_chat_id: numeric private chat id required.")
    target = int(CHAT)
else:
    if not re.fullmatch(r"[a-zA-Z0-9_-]{8,64}", CODE):
        stop("Specify an 8+ character code or a numeric recipient_chat_id.")
    info = telegram("getWebhookInfo")
    if info.get("url"):
        stop("Bot already uses a webhook. Cannot discover incoming commands without interfering. Provide explicit private chat ID.")
    updates = telegram("getUpdates", {"limit":100, "timeout":0})
    now = int(time.time())
    targets = set()
    for update in updates:
        msg = update.get("message") or {}
        sender = msg.get("from") or {}
        chat = msg.get("chat") or {}
        if (msg.get("text") == "/jadval " + CODE
            and chat.get("type") == "private"
            and sender.get("id") == chat.get("id")
            and 0 <= now-int(msg.get("date",0)) <= 1800):
            targets.add(chat.get("id"))
    if len(targets) != 1:
        stop("Expected exactly one matching private /jadval CODE message in the last 30 minutes; found " + str(len(targets)))
    target = next(iter(targets))

details = telegram("getChat", {"chat_id":target})
if details.get("type") != "private":
    stop("Refusing to send widget outside a private chat.")
telegram("sendWidget", {
    "chat_id": target, "html": html,
    "caption": "🧩 پیام جدول | جدول ۷×۷ دوستانه — داخل همین پیام حل کن!",
    "allow_queries": False, "is_shared": False
})
print("Crossword widget sent successfully to the verified private chat.")

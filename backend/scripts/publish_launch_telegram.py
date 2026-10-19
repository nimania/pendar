"""One-time, idempotent inaugural post to @pendario."""
import os
import sys
from datetime import datetime, timezone
from backend.scripts.publish_figures import Telegram, GitHubLedger, DeliveryUncertain

MESSAGE = """<b>پندار | خبر، بدون هیاهو</b>

اینجا خبرهایی را دنبال می‌کنیم که دانستنشان اهمیت دارد؛ با تمرکز بر ایران، تحولات جهان و موضوعاتی که بر زندگی ایرانیان اثر می‌گذارند.

در پندار، <b>خبر، ادعا و تحلیل</b> سه چیز متفاوت‌اند. منبع گفته‌ها را روشن می‌کنیم، خبرهای حساس را بدون شواهد کافی قطعی نمی‌نامیم و خطاهای تأییدشده را اصلاح می‌کنیم.

قرار نیست هر اتفاق کوچک یک «خبر فوری» باشد یا هر اختلاف‌نظر به هیاهو تبدیل شود. مهم‌تر از تعداد پست‌ها، ارزش خبری و دقت آن‌هاست.

🌐 <a href="https://pendar.io/">pendar.io</a>"""


def main():
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    repo = os.environ.get("GITHUB_REPOSITORY", "").strip()
    gh_token = os.environ.get("GH_TOKEN", "").strip()
    if not token:
        print("::error::Missing TELEGRAM_BOT_TOKEN; nothing sent")
        return 1
    if not repo or not gh_token:
        print("::error::Missing GitHub state credentials")
        return 1
    tg = Telegram(token)
    chat_id = tg.verify("janekalaam_bot", "@pendario")
    ledger = GitHubLedger(repo, gh_token, path="telegram/launch-state.json")
    state = ledger.load() or {}
    if state.get("status") in {"sending", "sent"}:
        print("Inaugural post already reserved or sent; never retry automatically.")
        return 0
    state = {"version": 1, "status": "sending", "reserved_at": datetime.now(timezone.utc).isoformat()}
    ledger.save(state)
    try:
        reply = tg.call("sendMessage", {
            "chat_id": chat_id, "text": MESSAGE, "parse_mode": "HTML",
            "disable_web_page_preview": True
        })
    except DeliveryUncertain:
        print("::error::Delivery uncertain. Inspect @pendario before manual recovery.")
        return 1
    except Exception:
        # Explicit Telegram refusal: keep the reserved state to prevent any duplicate.
        print("::error::Delivery failed; inspect channel and state before retrying.")
        return 1
    state.update(status="sent", message_id=reply.get("message_id"), sent_at=datetime.now(timezone.utc).isoformat())
    ledger.save(state)
    print("Inaugural message sent; Telegram message ID:", reply.get("message_id"))
    return 0


if __name__ == "__main__":
    sys.exit(main())

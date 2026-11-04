import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import runner


class NewsRadarTests(unittest.TestCase):
    def test_explicit_city_is_high_confidence(self):
        self.assertEqual(runner.city_relevance("شهرداری کرمان درباره خیابان‌های شهر گزارش داد"), "high")

    def test_other_county_is_review_only(self):
        self.assertEqual(runner.city_relevance("قطعی برق در شهرستان بافت استان کرمان"), "review")

    def test_unrelated_national_headline_is_rejected(self):
        self.assertEqual(runner.city_relevance("گفت‌وگوی وزرای خارجه چین و ترکیه"), "reject")

    def test_sensitive_claim_never_auto_ready(self):
        now = datetime(2026, 11, 4, 12, 0, tzinfo=timezone.utc)
        item = {
            "url": "https://t.me/kermane_no/888",
            "title": "انفجار در خیابان‌های شهر کرمان",
            "excerpt": "به گزارش منبع محلی، حادثه‌ای در شهر کرمان گزارش شده است.",
            "published_at": now.isoformat(),
            "source": "کرمان‌نو",
        }
        evaluated = runner.evaluate(item, now)
        self.assertEqual(evaluated["status"], "review")
        self.assertEqual(evaluated["risk"], "sensitive")

    def test_old_items_do_not_enter_queue(self):
        now = datetime(2026, 11, 4, 12, 0, tzinfo=timezone.utc)
        item = {"url": "https://t.me/x/1", "title": "شهرداری کرمان",
                "excerpt": "برنامه جدید برای شهر کرمان",
                "published_at": "2026-11-01T12:00:00+00:00",
                "source": "example"}
        self.assertIsNone(runner.evaluate(item, now))

    def test_near_duplicate_headlines(self):
        item = {"title": "آغاز مرمت بازار تاریخی شهر کرمان"}
        old = {"title": "آغاز مرمت بازار تاریخی شهر کرمان", "source": "الف"}
        self.assertIs(runner.duplicate(item, [old]), old)

    def test_html_is_escaped(self):
        item = {"title": "خبر <script> ناامن", "excerpt": "خبر <script> ناامن",
                "source": "خبرگزاری", "url": "https://t.me/example/1"}
        rendered = runner.telegram_message(item)
        self.assertNotIn("<script>", rendered)
        self.assertIn("&lt;script&gt;", rendered)

    def test_no_publish_without_explicit_channel(self):
        with self.assertRaises(RuntimeError):
            runner.send_to_telegram({}, "", "")

    def test_public_telegram_parser(self):
        sample = """<div class="tgme_widget_message" data-post="kermane_no/123">
          <div class="tgme_widget_message_text">شهرداری کرمان از بهسازی خیابان خبر داد</div>
          <a class="tgme_widget_message_date"><time datetime="2026-11-04T12:00:00+00:00"></time></a>
        </div>"""
        class DummyResponse:
            def __enter__(self):
                return self
            def __exit__(self, *_):
                return False
            def read(self, *_):
                return sample.encode("utf-8")
        with patch.object(runner, "urlopen", return_value=DummyResponse()):
            result = runner.source_posts({"handle": "kermane_no", "name": "کرمان نو"})
        self.assertEqual(result[0]["url"], "https://t.me/kermane_no/123")
        self.assertEqual(len(result), 1)


    def test_telegram_identity_and_permissions(self):
        response = [
            {"ok": True, "result": {"id": 1234, "username": "neshanikermanbot"}},
            {"ok": True, "result": {"username": "neshanikerman", "type": "channel"}},
            {"ok": True, "result": {"status": "administrator", "can_post_messages": True}},
        ]
        with patch.object(runner, "http_json", side_effect=response) as api:
            self.assertTrue(runner.verify_telegram_identity("secret", "@neshanikerman"))
            self.assertEqual(api.call_count, 3)

    def test_reject_wrong_bot_token(self):
        response = {"ok": True, "result": {"id": 1, "username": "notourbot"}}
        with patch.object(runner, "http_json", return_value=response) as api:
            with self.assertRaises(RuntimeError):
                runner.verify_telegram_identity("secret", "@neshanikerman")
            self.assertEqual(api.call_count, 1)

    def test_reject_missing_post_permission(self):
        response = [
            {"ok": True, "result": {"id": 1234, "username": "neshanikermanbot"}},
            {"ok": True, "result": {"username": "neshanikerman", "type": "channel"}},
            {"ok": True, "result": {"status": "administrator", "can_post_messages": False}},
        ]
        with patch.object(runner, "http_json", side_effect=response):
            with self.assertRaises(RuntimeError):
                runner.verify_telegram_identity("secret", "@neshanikerman")

    def test_reject_wrong_channel_without_api_request(self):
        with patch.object(runner, "http_json") as api:
            with self.assertRaises(RuntimeError):
                runner.verify_telegram_identity("secret", "@pendario")
            api.assert_not_called()

    def test_read_only_connection_check_exits_without_scraping(self):
        with patch.object(sys, "argv", ["runner.py", "--check-connection"]), \
             patch.dict(runner.os.environ, {"NASHANI_TELEGRAM_BOT_TOKEN": "secret", "NASHANI_CHANNEL_ID": "@neshanikerman"}), \
             patch.object(runner, "verify_telegram_identity", return_value=True) as verify, \
             patch.object(runner, "source_posts") as scrape:
            runner.main()
            verify.assert_called_once_with("secret", "@neshanikerman")
            scrape.assert_not_called()

if __name__ == "__main__":
    unittest.main()

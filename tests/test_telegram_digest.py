"""Digest tests run offline: no bot token, network, or backend dependencies."""
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

from backend.scripts.publish_digest import build_digest, digest_payload, publish_digest

NOW = datetime(2026, 10, 6, 12, 0, tzinfo=timezone.utc)


def story(sid, score, hours_ago=1, headline="سرخط آزمایشی", category="iran", sources=3):
    return {"id": sid, "headline_fa": headline, "category": category,
            "importance_score": score, "source_count": sources,
            "published_at": (NOW - timedelta(hours=hours_ago)).isoformat()}


def figures(*posts):
    return {"fields": {}, "figures": [{"name_fa": "ف", "posts": list(posts)}]}


def voice(handle, hours_ago=1, kind="analysis", summary="به باور او چنین است.",
          topic="اقتصاد", name="چهرهٔ آزمایشی"):
    return {"handle": handle, "name_fa": name, "kind": kind, "topic_fa": topic,
            "summary_fa": summary, "url": f"https://t.me/{handle}/1",
            "published_at": (NOW - timedelta(hours=hours_ago)).isoformat()}


class MemoryLedger:
    def __init__(self):
        self.state = None

    def load(self):
        return self.state

    def save(self, state):
        self.state = dict(state)


class BuildDigestTests(unittest.TestCase):
    def test_empty_window_returns_none(self):
        self.assertIsNone(build_digest(figures(), [], NOW, hours=8))
        # Items outside the window are excluded.
        self.assertIsNone(build_digest(figures(voice("a", hours_ago=20)),
                                       [story("s1", 9, hours_ago=20)], NOW, hours=8))

    def test_news_ranked_by_importance_and_capped(self):
        stories = [story(f"s{i}", score=i) for i in range(1, 9)]  # 8 stories
        text = build_digest(figures(), stories, NOW, hours=8)
        self.assertIn("مهم‌ترین خبرها", text)
        # The highest score (s8) appears; a low one beyond the cap does not.
        self.assertIn("/s/s8/", text)
        self.assertNotIn("/s/s1/", text)
        self.assertEqual(text.count("/s/s"), 5)  # MAX_NEWS

    def test_voices_one_per_figure_and_filtered(self):
        data = figures(
            voice("alpha", hours_ago=1),
            voice("alpha", hours_ago=2),           # same figure, deduped
            voice("beta", hours_ago=3, kind="relay"),   # wrong kind, dropped
            voice("gamma", hours_ago=4, summary=""),     # empty summary, dropped
            voice("delta", hours_ago=5),
        )
        text = build_digest(data, [], NOW, hours=8)
        self.assertEqual(text.count("#/figure/alpha"), 1)
        self.assertIn("#/figure/delta", text)
        self.assertNotIn("#/figure/beta", text)
        self.assertNotIn("#/figure/gamma", text)

    def test_html_is_escaped_and_payload_is_html_mode(self):
        text = build_digest(figures(), [story("s1", 9, headline="نفت <b> و «گاز» & برق")], NOW)
        self.assertIn("&lt;b&gt;", text)        # angle brackets escaped
        self.assertNotIn("<b> و", text)
        payload = digest_payload(text, "@pendario")
        self.assertEqual(payload["parse_mode"], "HTML")
        self.assertTrue(payload["disable_web_page_preview"])


class PublishDigestTests(unittest.TestCase):
    def setUp(self):
        printer = patch("builtins.print")
        printer.start()
        self.addCleanup(printer.stop)
        self.ledger = MemoryLedger()
        self.bot = Mock()

    def test_sends_when_due_and_records_timestamp(self):
        result = publish_digest(figures(voice("a")), [story("s1", 9)],
                                self.ledger, self.bot, "@pendario", now=NOW, hours=8)
        self.assertEqual(result["sent"], 1)
        self.bot.call.assert_called_once()
        self.assertEqual(self.bot.call.call_args.args[0], "sendMessage")
        self.assertIn("last_digest_at", self.ledger.state)

    def test_skips_within_interval(self):
        self.ledger.state = {"version": 1,
                             "last_digest_at": (NOW - timedelta(hours=3)).isoformat()}
        result = publish_digest(figures(voice("a")), [story("s1", 9)],
                                self.ledger, self.bot, "@pendario", now=NOW, hours=8)
        self.assertEqual(result["sent"], 0)
        self.bot.call.assert_not_called()

    def test_sends_again_after_interval_elapsed(self):
        self.ledger.state = {"version": 1,
                             "last_digest_at": (NOW - timedelta(hours=9)).isoformat()}
        result = publish_digest(figures(voice("a")), [story("s1", 9)],
                                self.ledger, self.bot, "@pendario", now=NOW, hours=8)
        self.assertEqual(result["sent"], 1)
        self.bot.call.assert_called_once()

    def test_empty_window_does_not_record_or_send(self):
        result = publish_digest(figures(), [], self.ledger, self.bot, "@pendario",
                                now=NOW, hours=8)
        self.assertEqual(result["sent"], 0)
        self.bot.call.assert_not_called()
        self.assertIsNone(self.ledger.state)

    def test_slot_reserved_before_send_so_failure_does_not_duplicate(self):
        self.bot.call.side_effect = RuntimeError("send failed")
        with self.assertRaises(RuntimeError):
            publish_digest(figures(voice("a")), [story("s1", 9)],
                           self.ledger, self.bot, "@pendario", now=NOW, hours=8)
        # Timestamp was recorded before the send attempt, so the next run waits.
        self.assertIn("last_digest_at", self.ledger.state)


if __name__ == "__main__":
    unittest.main()

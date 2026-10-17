"""Regression checks for the add-only Iran scenario candidate generator."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from scripts.build_iran_scenario_radar import build, classify


class ScenarioRadarTests(unittest.TestCase):
    def test_classifier_requires_iran_and_unambiguous_family(self):
        self.assertIsNone(classify("جنگ در اوکراین ادامه یافت"))
        self.assertEqual(classify("توافق ایران در مذاکرات هسته ای"), "deal")
        self.assertEqual(classify("تحریم ایران و کاهش ارزش ریال"), "attrition")
        self.assertIsNone(classify("جنگ ایران و توافق مذاکره"))

    def test_build_preserves_manual_ledger_and_deduplicates_updates(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / "site" / "data"
            data.mkdir(parents=True)
            seed = root / "seed.json"
            now = datetime.now(timezone.utc).replace(microsecond=0)
            published = now.isoformat()
            ts = int(now.timestamp() * 1000)
            authored = {"id": "seed-1", "date": now.date().isoformat(),
                        "ts": ts - 10, "family": "war", "text": "نقل تحلیل اولیه",
                        "direction": 1, "weight": 2, "by": "claude"}
            previous = {"id": "auto-old", "date": now.date().isoformat(),
                        "ts": ts - 20, "family": "regroup", "text": "نامزد قدیمی",
                        "direction": 0, "weight": 1, "by": "pendar-auto"}
            seed.write_text(json.dumps([authored], ensure_ascii=False), encoding="utf-8")
            (data / "iran-scenario-signals.json").write_text(
                json.dumps([previous], ensure_ascii=False), encoding="utf-8")
            stories = [
                {"id": "9883cb58-e3da-4f35-8684-3ec9a6b70a37",
                 "headline_fa": "ایران وارد مرحله تازه مذاکرات توافق شد",
                 "published_at": published, "source_names": ["خبرگزاری نمونه"]},
                {"id": "b4bc44ee-1111-2222-3333-a8a8a8a8a8a8",
                 "headline_fa": "جنگ اوکراین ادامه دارد", "published_at": published},
            ]
            figures = {"figures": [{"name_fa": "تحلیلگر نمونه", "posts": [
                {"id": "view1", "kind": "analysis", "published_at": published,
                 "summary_fa": "تحریم ایران و فرسایش اقتصادی", "url": "https://example.org/post/1"},
                {"id": "chatter1", "kind": "chatter", "published_at": published,
                 "summary_fa": "سرنگونی ایران", "url": "https://example.org/post/2"},
            ]}]}
            (data / "stories.json").write_text(json.dumps(stories, ensure_ascii=False))
            (data / "figures.json").write_text(json.dumps(figures, ensure_ascii=False))
            result = build(root / "site", seed, now=now)
            self.assertEqual(len(result), 4)
            self.assertEqual(len([x for x in result if x.get("by") == "pendar-auto"]), 3)
            self.assertTrue(all(x.get("direction") == 0 for x in result if x.get("by") == "pendar-auto"))
            self.assertEqual({x["id"] for x in build(root / "site", seed, now=now)},
                             {x["id"] for x in result})
            self.assertEqual(authored["direction"],
                             next(x for x in result if x["id"] == "seed-1")["direction"])
            meta = json.loads((data / "iran-scenario-meta.json").read_text())
            self.assertEqual(meta["auto_direction_policy"], "neutral_until_editorial_review")

    def test_stale_items_are_not_automatically_added(self):
        self.assertIsNone(classify("ریاست جمهوری آمریکا"))


if __name__ == "__main__":
    unittest.main()

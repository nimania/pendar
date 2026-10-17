"""Regression checks for the add-only Iran scenario candidate generator."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_iran_scenario_radar import build, classify, assess_signal, build_history, apply_daily_caps


class ScenarioRadarTests(unittest.TestCase):
    def test_classifier_requires_iran_and_unambiguous_family(self):
        self.assertIsNone(classify("جنگ در اوکراین ادامه یافت"))
        self.assertEqual(classify("توافق ایران در مذاکرات هسته ای"), "deal")
        self.assertEqual(classify("تحریم ایران و کاهش ارزش ریال"), "attrition")
        self.assertIsNone(classify("جنگ ایران و توافق"))

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
            self.assertEqual(meta["auto_direction_policy"], "conservative_rules_with_daily_caps_unverified")
            history = json.loads((data / "iran-scenario-history.json").read_text())
            self.assertTrue(history["points"])
            self.assertEqual(set(history["points"][-1]["scores"]), set(history["families"]))


    def test_directional_news_versus_attributed_predictions(self):
        self.assertEqual(assess_signal("حملات موشکی به ایران آغاز شد", "war", "story")[:3],
                         (1, 2, "reported_event"))
        self.assertEqual(assess_signal("حملات موشکی به ایران متوقف شد", "war", "story")[:3],
                         (-1, 2, "reported_event"))
        self.assertEqual(assess_signal("احتمال حملات موشکی به ایران مطرح شد", "war", "story")[0], 0)
        self.assertEqual(assess_signal("حمله ایران", "war", "story")[0], 0)
        self.assertEqual(assess_signal("جنگ ایران در آستانه وقوع است", "war", "figure")[:3],
                         (1, 1, "analyst_view"))
        self.assertEqual(assess_signal("جنگ ایران منتفی است", "war", "figure")[:3],
                         (-1, 1, "analyst_view"))
        self.assertEqual(assess_signal("جنگ ایران نزدیک است ولی بعید است", "war", "figure")[0], 0)

    def test_daily_scoring_cap_and_historical_points(self):
        from datetime import datetime, timezone
        day = "2026-10-17"
        records = [{
            "id": f"auto-{i}", "date": day, "ts": 1000+i,
            "family": "war", "by": "pendar-auto",
            "direction": 1, "weight": 2, "source_type": "story",
            "score_kind": "reported_event",
        } for i in range(6)]
        records.append({
            "id": "authored-1", "date": "2026-10-16", "ts": 20,
            "family": "attrition", "by": "claude", "direction": 1, "weight": 3,
        })
        apply_daily_caps(records)
        self.assertEqual(sum(x["direction"]*x["weight"] for x in records if x["family"]=="war"), 4)
        hist = build_history(records, datetime(2026, 10, 17, tzinfo=timezone.utc))
        self.assertEqual(len(hist["points"]), 2)
        self.assertEqual(hist["points"][-1]["scores"]["war"], 4)
        self.assertEqual(hist["points"][-1]["components"]["event"]["war"], 4)
        self.assertEqual(hist["points"][-1]["components"]["legacy"]["attrition"], 3)

    def test_negative_news_moves_a_family_down(self):
        self.assertEqual(assess_signal("توافق ایران لغو شد", "deal", "story")[:3],
                         (-1, 2, "reported_event"))
        self.assertEqual(assess_signal("نرخ تورم افزایش یافت و ایران با تحریم روبروست",
                                       "attrition", "story")[:3], (1, 2, "reported_event"))


    def test_provenance_and_attributed_speaker_with_real_original_links(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            site = root / "site"
            data = site / "data"
            detail_dir = data / "story"
            detail_dir.mkdir(parents=True)
            now = datetime.now(timezone.utc).replace(microsecond=0)
            story_id = "9883cb58-e3da-4f35-8684-3ec9a6b70a37"
            (data / "stories.json").write_text(json.dumps([{
                "id": story_id, "headline_fa": "حملات موشکی به ایران آغاز شد",
                "published_at": now.isoformat(), "source_names": ["خبرگزاری مثال"]
            }], ensure_ascii=False), encoding="utf-8")
            (detail_dir / (story_id + ".json")).write_text(json.dumps({
                "sources": [{"source_name": "خبرگزاری مثال",
                             "article_url": "https://example.org/original/123"}],
                "uncertainties": ["هنوز تایید مستقلی موجود نیست"],
                "person_statements": [{
                    "person_name_fa": "تحلیلگر آزمایشی", "role_fa": "پژوهشگر",
                    "statement_fa": "جنگ ایران در آستانه وقوع است",
                    "article_url": "https://example.org/analysis/456",
                    "published_at": now.isoformat()
                }]
            }, ensure_ascii=False), encoding="utf-8")
            (data / "figures.json").write_text(json.dumps({"figures": [{
                "name_fa": "آینده‌پژوه نمونه", "role_fa": "تحلیل‌گر",
                "handle": "future-researcher", "posts": [{
                    "id": "post1", "kind": "analysis", "published_at": now.isoformat(),
                    "summary_fa": "جنگ ایران منتفی است",
                    "url": "https://example.org/post/1"
                }]
            }]}, ensure_ascii=False), encoding="utf-8")
            seed = root / "seed.json"
            seed.write_text("[]", encoding="utf-8")
            items = build(site, seed, now=now)
            self.assertEqual(len(items), 3)
            story = next(x for x in items if x["source_type"] == "story")
            figure = next(x for x in items if x["source_type"] == "figure")
            statement = next(x for x in items if x["source_type"] == "statement")
            self.assertEqual((story["direction"], story["weight"]), (1, 2))
            self.assertEqual(story["source_doc_id"], story_id)
            self.assertEqual(story["source_links"][0]["url"], "/story/" + story_id + "/")
            self.assertIn("https://example.org/original/123",
                          [x["url"] for x in story["source_links"]])
            self.assertEqual((figure["direction"], figure["weight"]), (-1, 1))
            self.assertEqual(figure["speaker"], "آینده پژوه نمونه")
            self.assertEqual(figure["speaker_url"], "/@future-researcher")
            self.assertEqual((statement["direction"], statement["weight"]), (1, 1))
            self.assertEqual(statement["speaker"], "تحلیلگر آزمایشی")
            self.assertEqual(statement["source_links"][0]["url"], "https://example.org/analysis/456")
            snapshots = json.loads((data / "iran-scenario-snapshots.json").read_text(encoding="utf-8"))
            self.assertEqual(len(snapshots["snapshots"]), 1)
            self.assertEqual(snapshots["snapshots"][0]["scores"]["war"], 2)
            again = build(site, seed, now=now + timedelta(seconds=10))
            self.assertEqual(len(again), 3)
            snapshots = json.loads((data / "iran-scenario-snapshots.json").read_text(encoding="utf-8"))
            self.assertEqual(len(snapshots["snapshots"]), 1, "unchanged data must not create phantom updates")

    def test_unlinked_headline_cannot_generate_reported_event_points(self):
        from build_iran_scenario_radar import make_candidate, public_link
        now = datetime.now(timezone.utc).replace(microsecond=0)
        row = {"id": "9883cb58-e3da-4f35-8684-3ec9a6b70a37",
               "headline_fa": "حملات موشکی به ایران آغاز شد", "published_at": now.isoformat()}
        item = make_candidate(row, "story", now)
        self.assertEqual(item["direction"], 0)
        self.assertEqual(item["score_kind"], "unscored")
        self.assertEqual(public_link("javascript:alert(1)"), "")
        self.assertEqual(public_link("https://me:password@example.org/bad"), "")

    def test_stale_items_are_not_automatically_added(self):
        self.assertIsNone(classify("ریاست جمهوری آمریکا"))


if __name__ == "__main__":
    unittest.main()

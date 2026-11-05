"""Automatic Karname publication is source-grounded and never fabricates verdicts."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from scripts.build_karname_auto_radar import aggregate, build, safe_url  # noqa: E402


def candidate(*, id_="KC-1234567890abcdef12", who="شخصی در خبر",
              identity="indexed_news_person_requires_review",
              handle=None, status="pending_editorial_review", kind="figure_post",
              source="https://example.org/news/1",
              field="summary_fa", excerpt="اگر انتخابات برگزار شود، نتایج آن ممکن است در آینده تغییر کند."):
    return {
        "id": id_,
        "status": status,
        "speaker_name": who,
        "identity_status": identity,
        "speaker_handle": handle,
        "excerpt_exact_from_field": excerpt,
        "trigger_hint": {"kind": "conditional", "raw_condition": "اگر انتخابات برگزار شود",
                         "verified_due_at": None},
        "origins": [{
            "feed": kind, "project": "pendar", "record_id": "news-1",
            "text_field": field, "source_title": "منبع آزمون",
            "source_url": source, "editorial_published_at": "2026-11-06",
            "primary_source_verified": False,
        }],
    }


class AutoRadarTests(unittest.TestCase):
    def test_unverified_auto_publication_is_explicit(self):
        d = aggregate({"candidates": [candidate()]})
        self.assertEqual(d["summary"]["visible_observations"], 1)
        item = d["items"][0]
        self.assertIsNone(item["person"]["profile_handle"])
        self.assertIn("نام مرتبط با خبر", item["person"]["role"])
        self.assertIsNone(item["evaluation"])
        self.assertFalse(item["publication_approved"])
        self.assertFalse(item["source"]["primary_verified"])
        self.assertIsNone(item["trigger"]["verified_deadline"])
        self.assertEqual(item["source"]["link"], "https://example.org/news/1")
        self.assertIn("خلاصهٔ خبری", item["source"]["text_origin"])

    def test_canonical_identity_is_only_a_profile_link_not_primary_verification(self):
        d = aggregate({"candidates": [
            candidate(who="فرهنگ هلاکویی", identity="matched_canonical_handle",
                      handle="bahadaf", kind="editorial_view", field="quote_fa")
        ]})
        item = d["items"][0]
        self.assertEqual(item["person"]["profile_handle"], "bahadaf")
        self.assertFalse(item["person"]["identity_verified_from_primary"])
        self.assertIn("تطبیق با گفتار اصلی انجام نشده", item["source"]["text_origin"])

    def test_screened_out_not_exposed_and_no_results_scored(self):
        d = aggregate({"candidates": [
            candidate(id_="KC-1234567890abcdef12"),
            candidate(id_="KC-1234567890abcdef13", status="screened_out_by_current_filter"),
        ]})
        self.assertEqual(len(d["items"]), 1)
        self.assertEqual(d["summary"]["independently_verified_results"], 0)
        self.assertFalse(d["is_editorially_approved"])

    def test_guard_invalid_urls_and_ids(self):
        self.assertIsNone(safe_url("javascript:alert(1)"))
        self.assertIsNone(safe_url("https://example.org/a\" onclick=\"test"))
        self.assertEqual(safe_url("https://example.org/story"), "https://example.org/story")
        with self.assertRaises(ValueError):
            aggregate({"candidates": [candidate(), candidate()]})
        with self.assertRaises(ValueError):
            aggregate({"candidates": [candidate(id_="invalid")]})

    def test_generated_public_file_reproducible_from_queue(self):
        original = ROOT / "backend/data/karname-candidates.json"
        public = ROOT / "web-static/karname/auto-radar.json"
        self.assertEqual(build(original, public, check=True)["schema_version"], 1)
        ledger = json.loads((ROOT / "backend/data/karname.json").read_text(encoding="utf-8"))
        self.assertEqual(len(ledger["claims"]), 95)

    def test_deploy_flow_keeps_auto_radar_in_sync(self):
        workflow = (ROOT / ".github/workflows/karname-intake.yml").read_text(encoding="utf-8")
        self.assertIn("python backend/scripts/build_karname_auto_radar.py", workflow)
        self.assertIn("web-static/karname/auto-radar.json", workflow)
        self.assertIn("gh workflow run fast-deploy.yml --ref main", workflow)
        js = (ROOT / "web-static/karname/app.js").read_text(encoding="utf-8")
        html = (ROOT / "web-static/karname/index.html").read_text(encoding="utf-8")
        for field in ('data-tab="auto"', "رصد خودکار گفته‌ها"):
            self.assertIn(field, html)
        self.assertIn('fetch("/karname/auto-radar.json"', js)
        self.assertIn("function validAutoRadar(", js)
        self.assertIn("data-auto-person", js)
        self.assertIn("انتشار ماشینیِ شفاف", js)


if __name__ == "__main__":
    unittest.main()

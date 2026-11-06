"""No automatic claim scoring: source availability, quoted text and deadlines."""
import json
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from scripts.verify_karname_sources import (  # noqa: E402
    safe_public_https, verify_page, build, run,
)


class SourceVerificationTests(unittest.TestCase):
    def items(self):
        return {"items": [
            {"id": "KC-1234567890abcdef12", "observation_status": "auto_collected_unverified",
             "text_from_source": "تا پایان آینده، مذاکرات با توافق رسمی خاتمه خواهند یافت.",
             "source": {"link": "https://example.org/article/1"}},
            {"id": "KC-1234567890abcdef13", "observation_status": "auto_collected_unverified",
             "text_from_source": "انتخابات در ماه آینده برگزار خواهد شد.",
             "source": {"link": None}},
        ]}

    def ledger(self):
        return {
            "claims": [{"id": "K-1", "bucket": "old", "result": ""},
                       {"id": "K-2", "bucket": "future", "result": ""},
                       {"id": "K-3", "bucket": "event", "result": ""}],
            "buckets": [{"key": "old", "date": "2026-01-01"},
                        {"key": "future", "date": "2028-01-01"},
                        {"key": "event", "label": "اگر جنگ شود"}],
        }

    def test_url_restrictions_protect_private_hosts(self):
        for url in ("http://example.org/test", "https://localhost/item",
                    "https://127.0.0.1/item", "https://10.0.0.5/item",
                    "https://metadata.google.internal/latest",
                    "https://example.org:1234/test", "javascript:alert(1)",
                    "https://user:pass@example.org/item"):
            with self.subTest(url=url):
                self.assertFalse(safe_public_https(url, resolve=False))
        self.assertTrue(safe_public_https("https://example.org/item", resolve=False))

    def test_exact_matching_does_not_certify_person_or_event(self):
        item = self.items()["items"][0]
        self.assertEqual(verify_page(item, fetch=lambda u: "امروز: " + item["text_from_source"]),
                         "source_text_found")
        self.assertEqual(verify_page(item, fetch=lambda u: "خبر دیگری دربارهٔ مذاکرات"),
                         "source_accessible")
        self.assertEqual(verify_page(item, fetch=lambda u: (_ for _ in ()).throw(
            OSError("network blocked"))), "source_unavailable")

    def test_deadline_passed_is_not_a_wrong_prediction(self):
        d = build(self.items(), self.ledger(), now=datetime(2026, 11, 6, tzinfo=timezone.utc),
                  budget=1, fetch=lambda u: "متن صفحه")
        self.assertEqual(d["summary"]["observations"], 2)
        self.assertEqual(d["summary"]["outcomes_automatically_scored"], 0)
        self.assertEqual(d["summary"]["checked_this_run"], 1)
        self.assertEqual(d["official_due_review"]["K-1"]["triage_status"],
                         "deadline_passed_needs_evidence")
        self.assertIsNone(d["official_due_review"]["K-1"]["automated_outcome"])
        self.assertEqual(d["official_due_review"]["K-2"]["triage_status"], "scheduled_future")
        self.assertEqual(d["official_due_review"]["K-3"]["triage_status"],
                         "event_based_or_no_verified_deadline")
        self.assertTrue(all(x["speaker_verified"] is False for x in d["observations"].values()))

    def test_carries_old_evidence_when_budget_is_zero(self):
        radar = self.items()
        prior = build(radar, self.ledger(),
                      now=datetime(2026, 11, 6, tzinfo=timezone.utc),
                      budget=1, fetch=lambda u: radar["items"][0]["text_from_source"])
        next_run = build(radar, self.ledger(), previous=prior,
                         now=datetime(2026, 11, 7, tzinfo=timezone.utc), budget=0)
        id_ = radar["items"][0]["id"]
        self.assertEqual(next_run["observations"][id_], prior["observations"][id_])
        self.assertIsNone(next_run["official_due_review"]["K-1"]["automated_outcome"])

    def test_stale_ids_not_silently_accepted(self):
        radar = self.items()
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            path_r, path_l, out = (root / "radar.json", root / "ledger.json",
                                  root / "verification.json")
            path_r.write_text(json.dumps(radar), encoding="utf-8")
            path_l.write_text(json.dumps(self.ledger()), encoding="utf-8")
            with self.assertRaises(ValueError):
                run(path_r, path_l, out, budget=0, check=True)
            out.write_text(json.dumps({"observations": {}, "official_due_review": {}}),
                           encoding="utf-8")
            with self.assertRaises(ValueError):
                run(path_r, path_l, out, budget=0, check=True)

    def test_real_index_tracks_all_observations_and_95_official_ids(self):
        d = run(check=True)
        radar = json.loads((ROOT/"web-static/karname/auto-radar.json").read_text())
        ledger = json.loads((ROOT/"backend/data/karname.json").read_text())
        self.assertEqual(len(d["observations"]), len(radar["items"]))
        self.assertEqual(len(d["official_due_review"]), len(ledger["claims"]))
        self.assertEqual(d["summary"]["outcomes_automatically_scored"], 0)


if __name__ == "__main__":
    unittest.main()

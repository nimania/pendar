"""Karname intake tests: conservative attribution, provenance and no publication."""
from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from scripts.collect_karname_candidates import (  # noqa: E402
    build_queue, qualifies, run, trigger_hint, valid_url,
)

FIGURES = [
    SimpleNamespace(handle="abbas-souri", name_fa="عباس سوری",
                    aliases=("عباس سوري", "Abas Suri")),
    SimpleNamespace(handle="bahadaf", name_fa="فرهنگ هلاکویی", aliases=()),
]
PREDICTION = "تا پایان سال آینده نرخ دلار به دویست هزار تومان خواهد رسید."
CONDITIONAL = "اگر جنگ شروع شود، کشورهای منطقه نیز وارد درگیری خواهند شد."


def recap(id_, text, **extra):
    return {
        "id": id_, "name_fa": "عباس سوری",
        "speaker_handle": "abbas-souri",
        "recap_fa": text,
        "recorded_at": "2026-10-08T18:00:00Z",
        "source_name": "گفت‌وگوی ثبت‌شده",
        **extra,
    }


def view(id_, text, **extra):
    return {"profile": {"handle": "abbas-souri", "name_fa": "عباس سوری"},
            "posts": [{"id": id_, "quote_fa": text, "url": "", **extra}]}


class CandidateIntakeTests(unittest.TestCase):
    def test_concrete_future_claim_and_condition(self):
        self.assertIsNotNone(qualifies(PREDICTION))
        self.assertEqual(qualifies(CONDITIONAL)[0], "conditional_forecast")
        self.assertIsNone(qualifies("این پرونده دیدگاه‌ها و پیش‌بینی‌های او را "
                                    "از متن گفت‌وگو استخراج و موضوع‌بندی می‌کند."))
        self.assertIsNone(qualifies("پیش‌بینی نمی‌کنم، چون اطلاعات کافی در اختیار نداریم."))
        self.assertIsNone(qualifies("در آینده هویت ملی اهمیت فراوانی دارد، "
                                    "ولی هنوز کسی درباره مسیر آن توافق نکرده است."))

    def test_no_date_or_victory_is_invented(self):
        t = trigger_hint(PREDICTION, "unspecified")
        self.assertIsNone(t["verified_due_at"])
        self.assertIsNone(t["mentioned_iso_date"])
        self.assertTrue(t["review_required"])
        self.assertEqual(trigger_hint(CONDITIONAL, "conditional")["kind"], "conditional")

    def test_figure_alias_and_source_provenance(self):
        original = recap("source-1", PREDICTION, url="https://example.org/abc")
        q = build_queue([original], [], {"claims": [], "speakers": []}, figures=FIGURES)
        self.assertEqual(q["publication_policy"], "internal_review_queue_only_no_public_import")
        self.assertEqual(q["stats"]["total"], 1)
        c = q["candidates"][0]
        self.assertEqual(c["speaker_name"], "عباس سوری")
        self.assertEqual(c["speaker_handle"], "abbas-souri")
        self.assertEqual(c["status"], "pending_editorial_review")
        self.assertEqual(c["excerpt_exact_from_field"], PREDICTION)
        self.assertFalse(c["excerpt_is_original_speech_verified"])
        self.assertEqual(c["origins"][0]["source_url"], "https://example.org/abc")
        self.assertFalse(c["origins"][0]["primary_speech_date_verified"])
        self.assertIsNone(c["trigger_hint"]["verified_due_at"])
        self.assertFalse(q["mirrored_jan_kalam_skipped"] is False)

    def test_distinct_sources_same_speaker_and_text_do_not_duplicate(self):
        q = build_queue([recap("recap-a", PREDICTION)],
                        [view("view-a", PREDICTION)],
                        {"claims": [], "speakers": []}, figures=FIGURES)
        self.assertEqual(len(q["candidates"]), 1)
        self.assertEqual({o["record_id"] for o in q["candidates"][0]["origins"]},
                         {"recap-a", "view-a"})

    def test_panel_discussion_is_not_falsely_attributed_to_first_person(self):
        r = recap("panel-1", PREDICTION,
                  speaker_handles=["abbas-souri", "other-speaker"])
        q = build_queue([r], [], {"claims": [], "speakers": []}, figures=FIGURES)
        c = q["candidates"][0]
        self.assertIsNone(c["speaker_handle"])
        self.assertEqual(c["identity_status"], "multi_speaker_requires_review")
        self.assertEqual(c["speaker_candidates"], ["abbas-souri", "other-speaker"])

    def test_review_status_and_evidence_survive_incremental_runs(self):
        q1 = build_queue([recap("r1", PREDICTION)], [],
                         {"claims": [], "speakers": []}, figures=FIGURES)
        q1["candidates"][0]["status"] = "needs_primary_source"
        q1["candidates"][0]["editorial_decision"] = {
            "reviewer": "editor", "reason": "video link unavailable"}
        q2 = build_queue([recap("r1", PREDICTION), recap("r2", CONDITIONAL)], [],
                         {"claims": [], "speakers": []}, previous=q1, figures=FIGURES)
        self.assertEqual(len(q2["candidates"]), 2)
        carried = next(c for c in q2["candidates"] if c["id"] == q1["candidates"][0]["id"])
        self.assertEqual(carried["status"], "needs_primary_source")
        self.assertEqual(carried["editorial_decision"]["reviewer"], "editor")
        q3 = build_queue([recap("r1", PREDICTION), recap("r2", CONDITIONAL)], [],
                         {"claims": [], "speakers": []}, previous=q2, figures=FIGURES)
        self.assertEqual(q2, q3)

    def test_existing_ledger_referenced_but_never_mutated(self):
        ledger = {"claims": [{"id": "K-001", "speakers": ["abbas-souri"],
                              "text": PREDICTION}],
                  "speakers": [{"key": "abbas-souri", "handle": "abbas-souri"}]}
        initial = copy.deepcopy(ledger)
        queue = build_queue([recap("r1", PREDICTION)], [], ledger, figures=FIGURES)
        self.assertEqual(queue["candidates"][0]["related_ledger_claim_ids_for_review"], ["K-001"])
        self.assertEqual(ledger, initial)

    def test_untrusted_url_is_not_linked(self):
        self.assertIsNone(valid_url("javascript:alert(1)"))
        self.assertIsNone(valid_url("http://example.org"))
        self.assertEqual(valid_url("https://example.org/a"), "https://example.org/a")

    def test_bad_queue_is_not_silently_destroyed(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name, contents in [
                ("recaps.json", json.dumps([recap("r1", PREDICTION)], ensure_ascii=False)),
                ("views.json", "[]"),
                ("ledger.json", '{"claims":[],"speakers":[]}'),
                ("queue.json", '{"candidates":"broken"}'),
            ]:
                (root / name).write_text(contents, encoding="utf-8")
            with self.assertRaises(ValueError):
                run(root / "recaps.json", root / "views.json",
                    root / "ledger.json", root / "queue.json")
            self.assertIn("broken", (root / "queue.json").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()

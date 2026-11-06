"""Regression tests for integrated discovery: every ID included; no invented outcomes."""
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from scripts.build_karname_unified import normalized, build  # noqa: E402


def read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


class UnifiedKarnameTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger = read("backend/data/karname.json")
        cls.queue = read("backend/data/karname-candidates.json")
        cls.radar = read("web-static/karname/auto-radar.json")
        cls.index = read("web-static/karname/unified-index.json")

    def test_index_reproducible_from_three_separate_sources(self):
        self.assertEqual(normalized(self.ledger, self.queue, self.radar), self.index)
        self.assertEqual(build(check=True), self.index)
        n = self.index["counts"]
        self.assertEqual(n["total"], n["documented"] +
                         n["automatic_unverified"] + n["screened_from_public_claims"] +
                         n["other_review_states"])
        self.assertEqual(len(self.index["entries"]), n["total"])
        self.assertEqual(n["documented"], len(self.ledger["claims"]))
        self.assertEqual(n["automatic_unverified"], len(self.radar["items"]))
        self.assertEqual(n["screened_from_public_claims"], sum(
            c.get("status") == "screened_out_by_current_filter"
            for c in self.queue["candidates"]))
        self.assertEqual(len({e["id"] for e in self.index["entries"]}), n["total"])

    def test_every_candidate_exactly_once_including_screened(self):
        incoming = {c["id"] for c in self.queue["candidates"]}
        imported = {e["id"] for e in self.index["entries"]
                    if e["layer"] != "historical_ledger"}
        self.assertEqual(incoming, imported)
        self.assertEqual({c["id"] for c in self.ledger["claims"]},
                         {e["id"] for e in self.index["entries"]
                          if e["layer"] == "historical_ledger"})

    def test_quarantined_data_cannot_imply_person_said_it(self):
        for item in self.index["entries"]:
            if item["layer"] != "quality_audit":
                continue
            with self.subTest(entry=item["id"]):
                self.assertEqual(item["speaker_labels"], [])
                self.assertEqual(item["speaker_keys"], [])
                self.assertEqual(item["identity_verification_level"], "not_attributed")
                self.assertFalse(item["has_result_source"])
                self.assertNotIn("source_url", item)
                self.assertEqual(item["status"] in
                                 {"screened_out", "other_not_publicly_attributed"}, True)

    def test_machine_candidates_have_no_verified_outcome_or_deadline(self):
        for item in self.index["entries"]:
            if item["layer"] != "automatic_observation":
                continue
            with self.subTest(entry=item["id"]):
                self.assertFalse(item["has_result_source"])
                self.assertFalse(item["time_is_verified_deadline"])
                self.assertEqual(item["identity_verification_level"],
                                 "not_verified_from_primary")
                self.assertEqual(item["topics"], [])
                self.assertEqual(item["status"], "unverified")

    def test_queue_cannot_silently_lose_or_duplicate_an_entry(self):
        q = copy.deepcopy(self.queue)
        q["candidates"].append(copy.deepcopy(q["candidates"][0]))
        with self.assertRaises(ValueError):
            normalized(self.ledger, q, self.radar)
        q = copy.deepcopy(self.queue)
        q["candidates"] = [c for c in q["candidates"]
                           if c["id"] != self.radar["items"][0]["id"]]
        with self.assertRaises(ValueError):
            normalized(self.ledger, q, self.radar)

    def test_index_rejects_fictitious_graded_machine_observations(self):
        feed = copy.deepcopy(self.radar)
        feed["items"][0]["evaluation"] = "correct"
        with self.assertRaises(ValueError):
            normalized(self.ledger, self.queue, feed)

    def test_build_rejects_stale_index_without_overwriting(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            old = root / "index.json"
            old.write_text('{"wrong":true}', encoding="utf-8")
            with self.assertRaises(ValueError):
                build(output=old, check=True)
            self.assertEqual(old.read_text(), '{"wrong":true}')

    def test_existing_documented_records_and_scores_not_changed(self):
        claims = {c["id"]: c for c in self.ledger["claims"]}
        historical = [e for e in self.index["entries"]
                      if e["layer"] == "historical_ledger"]
        for item in historical:
            self.assertIn(item["id"], claims)
            self.assertEqual(item["has_result_source"],
                             bool(claims[item["id"]].get("result_source")))


if __name__ == "__main__":
    unittest.main()

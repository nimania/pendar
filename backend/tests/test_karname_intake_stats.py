"""Public aggregates expose intake progress without publishing unreviewed claims."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from scripts.build_karname_intake_stats import aggregate, build


class IntakePublicStatsTests(unittest.TestCase):
    def candidate(self, status="pending_editorial_review", **other):
        return {"id": other.pop("id", "KC-001"), "status": status, **other}

    def queue(self):
        claims = [
            self.candidate("pending_editorial_review", id="KC-A", manual_review_required=True,
                           excerpt_exact_from_field="ادعای خصوصی که نباید در آمارهٔ عمومی منتشر شود"),
            self.candidate("pending_editorial_review", id="KC-B"),
            self.candidate("screened_out_by_current_filter", id="KC-C"),
        ]
        return {"candidates": claims, "stats": {
            "total": 3, "pending": 2, "screened": 1, "reviewed": 0,
            "figure_profiles_scanned": 519, "figure_posts_scanned": 797,
            "source_spans_scanned": 2223
        }, "figure_snapshot_available": True}

    def test_counted_and_no_excerpts_or_identifying_content(self):
        report = aggregate(self.queue())
        self.assertEqual(report["counts"]["extracted_candidates"], 3)
        self.assertEqual(report["counts"]["pending_review"], 2)
        self.assertEqual(report["counts"]["screened_out"], 1)
        self.assertEqual(report["counts"]["manual_review_requested"], 1)
        self.assertEqual(report["coverage"]["figure_profiles_scanned"], 519)
        self.assertNotIn("ادعای خصوصی", json.dumps(report, ensure_ascii=False))
        self.assertNotIn("KC-A", json.dumps(report, ensure_ascii=False))
        self.assertFalse(report["is_editorially_approved"])

    def test_invalid_counts_and_duplicate_ids_rejected(self):
        q = self.queue()
        q["stats"]["total"] = 100
        with self.assertRaises(ValueError): aggregate(q)
        q = self.queue()
        q["candidates"][1]["id"] = "KC-A"
        with self.assertRaises(ValueError): aggregate(q)
        q = self.queue()
        q["stats"]["figure_profiles_scanned"] = -7
        with self.assertRaises(ValueError): aggregate(q)

    def test_output_stable_and_checked_against_source(self):
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "queue.json"
            public = Path(folder) / "intake-stats.json"
            source.write_text(json.dumps(self.queue(), ensure_ascii=False), encoding="utf-8")
            first = build(source, public)
            self.assertEqual(first, build(source, public, check=True))
            first_json = public.read_text(encoding="utf-8")
            self.assertEqual(first_json, public.read_text(encoding="utf-8"))
            updated = self.queue()
            updated["candidates"].append(self.candidate(id="KC-D"))
            updated["stats"]["total"] = 4
            updated["stats"]["pending"] = 3
            source.write_text(json.dumps(updated, ensure_ascii=False), encoding="utf-8")
            with self.assertRaises(ValueError): build(source, public, check=True)

    def test_repo_snapshot_matches_live_queue_without_altering_ledger(self):
        queue_path = ROOT / "backend/data/karname-candidates.json"
        public_path = ROOT / "web-static/karname/intake-stats.json"
        self.assertEqual(build(queue_path, public_path, check=True)["schema_version"], 1)
        ledger = json.loads((ROOT / "backend/data/karname.json").read_text(encoding="utf-8"))
        self.assertEqual(len(ledger["claims"]), 95)


if __name__ == "__main__":
    unittest.main()

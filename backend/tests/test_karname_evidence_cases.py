"""Evidence docket integrity: evidence is not a speaker verdict."""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


class EvidenceDocketTests(unittest.TestCase):
    def test_evidence_cases_are_linked_and_never_auto_scored(self):
        docket = json.loads((ROOT / "web-static/karname/evidence-cases.json").read_text(encoding="utf-8"))
        ledger = json.loads((ROOT / "backend/data/karname.json").read_text(encoding="utf-8"))
        claim_ids = {x["id"] for x in ledger["claims"]}
        source_ids = {x["id"] for x in docket["sources"]}
        self.assertEqual(docket["schema_version"], 1)
        self.assertTrue(docket["cases"])
        for case in docket["cases"]:
            self.assertIn(case["id"], claim_ids)
            self.assertIsNone(case["score"])
            self.assertEqual(case["primary_statement_status"], "missing")
            self.assertTrue(set(case["source_ids"]).issubset(source_ids))
            self.assertIn(case["adjudication_status"], {
                "event_evidence_collected_pending_primary_statement",
                "open_requires_final_seat_count_and_primary_statement",
                "open_requires_contextual_primary_statement",
                "open_requires_claim_type_review",
            })

    def test_dashboard_exposes_evidence_tab_and_no_fake_score(self):
        html = (ROOT / "web-static/karname/index.html").read_text(encoding="utf-8")
        app = (ROOT / "web-static/karname/app.js").read_text(encoding="utf-8")
        self.assertIn('data-tab="evidence"', html)
        self.assertIn('fetch("/karname/evidence-cases.json"', app)
        self.assertIn("امتیاز نهایی:", app)


if __name__ == "__main__":
    unittest.main()

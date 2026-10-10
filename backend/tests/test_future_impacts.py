"""Regression checks for future-impact evidence extraction."""
import json
import tempfile
import unittest
from pathlib import Path
from backend.scripts.build_future_impacts import build

class FutureImpactTests(unittest.TestCase):
    def test_evidence_without_invented_forecast(self):
        with tempfile.TemporaryDirectory() as folder:
            data=Path(folder); (data/"story").mkdir()
            story={"id":"test-new-story","what_happened_fa":"خبر آزمایشی",
                   "facts":["گزارش یک منبع"],"uncertainties":["دامنه رویداد روشن نیست"],
                   "sources":[{"source_name":"منبع آزمایشی","article_url":"https://example.com/news"}]}
            (data/"story"/"test-new-story.json").write_text(json.dumps(story,ensure_ascii=False),encoding="utf8")
            self.assertEqual(build(data),1)
            item=json.loads((data/"story"/"test-new-story.json").read_text(encoding="utf8"))["future_impact"]
            self.assertEqual(item["status"],"pending_editorial_review")
            self.assertIsNone(item["causal_mechanism"])
            self.assertEqual(item["impact_direction"],"not_assessed")
            self.assertEqual(item["review_history"],[])

if __name__=="__main__": unittest.main()

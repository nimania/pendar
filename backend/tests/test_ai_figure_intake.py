"""Focused offline checks for AI intake and explicit editorial approvals."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]

def load(name, rel):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

collector = load("ai_collect", "backend/scripts/collect_ai_figure_sources.py")
review = load("ai_review", "backend/scripts/review_ai_figure_intake.py")

class FigureIntakeTests(unittest.TestCase):
    def test_relevance_tagging(self):
        self.assertTrue(collector.relevant_ai("کاربرد مدل زبانی در آموزش"))
        self.assertTrue(collector.relevant_ai("Recent changes to Claude agents"))
        self.assertFalse(collector.relevant_ai("دستور تهیه نان و رستوران"))

    def test_source_allowlist(self):
        with self.assertRaises(ValueError):
            collector.collect({"url": "https://example.com/other", "figure": "x"})

    def test_approval_requires_source_verification(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            figures = base / "figures.json"
            intake = base / "intake.json"
            decisions = base / "decisions.json"
            output = base / "preview.json"
            figures.write_text(json.dumps([{"profile": {"handle": "test", "name_fa": "آزمایش"},
                                            "posts": []}]), encoding="utf-8")
            intake.write_text(json.dumps({"pending": [
                {"id": "abc", "figure": "test", "url": "https://t.me/sample/42",
                 "published_at": "2026-10-10T00:00:00Z", "source": "تلگرام",
                 "ai_relevance": "candidate"}]}), encoding="utf-8")
            decision = {"id": "abc", "status": "approved", "reviewer": "editor",
                        "topic_fa": "هوش مصنوعی", "summary_fa": "متن مستند " * 25}
            decisions.write_text(json.dumps({"decisions": [decision]}), encoding="utf-8")
            with patch.object(review, "FIGURES", figures):
                with patch("sys.argv", ["review", "--intake", str(intake),
                                        "--decisions", str(decisions), "--output", str(output)]):
                    review.main()
                self.assertEqual(json.loads(output.read_text())["ready"], [])
                decision["source_verified"] = True
                decisions.write_text(json.dumps({"decisions": [decision]}), encoding="utf-8")
                with patch("sys.argv", ["review", "--intake", str(intake),
                                        "--decisions", str(decisions), "--output", str(output)]):
                    review.main()
                post = json.loads(output.read_text())["ready"][0]
                self.assertIsNone(post["published_at"])
                self.assertEqual(post["date_review_status"], "date_not_verified")
                self.assertEqual(json.loads(figures.read_text())[0]["posts"], [])

if __name__ == "__main__":
    unittest.main()

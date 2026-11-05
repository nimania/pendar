"""Regression tests for the independently published Karname scoreboard."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from scripts.publish_karname_data import publish, validate  # noqa: E402


class KarnamePublicationTests(unittest.TestCase):
    def test_canonical_and_alias_page_exist(self):
        canonical = (ROOT / "web-static/karname/index.html").read_text(encoding="utf-8")
        alias = (ROOT / "web-static/karnameh/index.html").read_text(encoding="utf-8")
        self.assertIn('href="https://pendar.io/karname/"', canonical)
        self.assertIn('href="https://pendar.io/karname/"', alias)
        self.assertIn('location.replace("/karname/"+location.search+location.hash)', alias)
        self.assertIn('src="/karname/app.js"', canonical)

    def test_initial_import_is_truthful_and_unscored(self):
        path = ROOT / "backend/data/karname.json"
        data = validate(json.loads(path.read_text(encoding="utf-8")))
        self.assertEqual(data["dataset_scope"], "initial_partial_import")
        self.assertFalse(data["is_complete"])
        self.assertEqual(len(data["claims"]), 9)
        self.assertTrue(all(claim["result"] is None for claim in data["claims"]))
        by_id = {claim["id"]: claim for claim in data["claims"]}
        self.assertEqual(by_id["SOURI-20261101-02"]["speakers"], ["benjamin-souri"])
        self.assertEqual(by_id["SOURI-20261101-08"]["type_class"], "نقل گزارش")
        self.assertEqual(by_id["SOURI-20261101-09"]["type_class"], "نقل گزارش")
        self.assertIn("۹ مدخل", data["provenance"]["disclosure"])

    def test_pilot_notice_visible_in_app_code(self):
        code = (ROOT / "web-static/karname/app.js").read_text(encoding="utf-8")
        self.assertIn('data.is_complete===false', code)
        self.assertIn('data.provenance?.disclosure', code)

    def test_missing_ledger_does_not_create_fake_data(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            result = publish(root / "site", root / "missing.json")
            self.assertEqual(result, "missing")
            self.assertFalse((root / "site/data/karname.json").exists())

    def test_valid_dataset_published(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source.json"
            source.write_text(json.dumps({"claims": [
                {"id": "K-1", "text": "Test claim", "speakers": ["example"]}
            ], "speakers": [{"key": "example", "name": "Example"}]}, ensure_ascii=False), encoding="utf-8")
            result = publish(root / "site", source)
            self.assertEqual(result, "new")
            data = json.loads((root / "site/data/karname.json").read_text(encoding="utf-8"))
            self.assertEqual(len(data["claims"]), 1)

    def test_invalid_fresh_dataset_fails_without_overwriting_prior(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            prior = root / "prior/data"
            prior.mkdir(parents=True)
            good = {"claims": [], "speakers": []}
            (prior / "karname.json").write_text(json.dumps(good), encoding="utf-8")
            source = root / "source.json"
            source.write_text('{"claims": [{}, {}], "speakers": []}', encoding="utf-8")
            with self.assertRaises(ValueError):
                publish(root / "site", source, root / "prior")
            self.assertFalse((root / "site/data/karname.json").exists())

    def test_reuse_valid_prior_archive(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            prior = root / "prior/data"
            prior.mkdir(parents=True)
            (prior / "karname.json").write_text('{"claims":[],"speakers":[]}', encoding="utf-8")
            self.assertEqual(publish(root / "site", root / "missing.json", root / "prior"), "previous")

    def test_reject_duplicate_ids_and_unbound_pairs(self):
        with self.assertRaises(ValueError):
            validate({"claims": [{"id": "K-1"}, {"id": "K-1"}], "speakers": []})
        with self.assertRaises(ValueError):
            validate({"claims": [], "speakers": [], "pairs": [{"a": "K-99", "b": "K-100"}]})


if __name__ == "__main__":
    unittest.main()

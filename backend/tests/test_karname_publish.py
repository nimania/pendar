"""Regression tests for the canonical Claude Karname import and static website."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))
from scripts.publish_karname_data import publish, validate  # noqa: E402
from scripts.build_karname import build, extract  # noqa: E402


class KarnamePublicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.public = validate(json.loads(
            (ROOT / "backend/data/karname.json").read_text(encoding="utf-8")))
        cls.original = json.loads(
            (ROOT / "karname/imports/claude-original-80-20261105.json").read_text(encoding="utf-8"))
        cls.history = json.loads(
            (ROOT / "karname/imports/pendar-reconstructed-18-20261105.json").read_text(encoding="utf-8"))

    def test_canonical_and_alias_page_exist(self):
        canonical = (ROOT / "web-static/karname/index.html").read_text(encoding="utf-8")
        alias = (ROOT / "web-static/karnameh/index.html").read_text(encoding="utf-8")
        self.assertIn('href="https://pendar.io/karname/"', canonical)
        self.assertIn('href="https://pendar.io/karname/"', alias)
        self.assertIn('location.replace("/karname/"+location.search+location.hash)', alias)
        self.assertIn('src="/karname/app.js"', canonical)

    def test_original_claude_snapshot_preserved_without_edits(self):
        original, data = self.original, self.public
        self.assertEqual(len(original["claims"]), 80)
        self.assertEqual(sum(c["kind"] == "K" for c in original["claims"]), 55)
        self.assertEqual(sum(c["kind"] == "L" for c in original["claims"]), 25)
        self.assertEqual(len(original["speakers"]), 13)
        self.assertEqual(len(original["pairs"]), 7)
        self.assertEqual(len(original["recaps"]), 30)
        self.assertEqual(data["pairs"], original["pairs"])
        self.assertEqual(data["recaps"], original["recaps"])
        indexed = {c["id"]: c for c in data["claims"]}
        for claim in original["claims"]:
            with self.subTest(original_claim=claim["id"]):
                self.assertIn(claim["id"], indexed)
                for key, value in claim.items():
                    self.assertEqual(indexed[claim["id"]][key], value)

    def test_import_retains_history_and_has_no_invented_scores(self):
        d = self.public
        self.assertFalse(d["is_complete"])
        self.assertEqual(d["dataset_scope"], "uploaded_claude_snapshot_and_supplements")
        self.assertEqual(len(d["claims"]), 95)
        self.assertEqual(len(d["speakers"]), 17)
        self.assertEqual(len({c["id"] for c in d["claims"]}), 95)
        self.assertEqual(len(self.history["claims"]), 18)
        self.assertTrue(all(not c.get("result") for c in d["claims"]))
        self.assertEqual(sum(c["id"].startswith("SOURI-") for c in d["claims"]), 9)
        self.assertEqual(sum(c["id"].startswith("PDR-") for c in d["claims"]), 6)
        people = {p["key"]: p for p in d["speakers"]}
        self.assertEqual(people["abbas-souri"]["name"], "عباس سوری")
        self.assertEqual(sum("abbas-souri" in c["speakers"] for c in d["claims"]), 6)
        self.assertEqual(len(d["provenance"]["archived_potential_overlaps"]), 3)
        for c in d["claims"]:
            self.assertTrue(all(k in people for k in c["speakers"]))
        self.assertTrue(all(p["a"] in {c["id"] for c in d["claims"]}
                            and p["b"] in {c["id"] for c in d["claims"]}
                            for p in d["pairs"]))

    def test_canonical_ledger_is_authoritative_and_reproducible(self):
        ledger = ROOT / "karname/daftar.md"
        self.assertEqual(extract(ledger.read_text(encoding="utf-8")), self.public)
        self.assertEqual(build(ledger, ROOT / "backend/data/karname.json", check=True), self.public)

    def test_source_claims_are_traced_to_existing_recap_evidence(self):
        recaps = json.loads(
            (ROOT / "backend/data/editorial-recaps.json").read_text(encoding="utf-8"))
        by_id = {r["id"]: r for r in recaps}
        supplement = [c for c in self.public["claims"]
                      if c.get("source_type") == "secondary_editorial_recap"]
        self.assertEqual(len(supplement), 6)
        for claim in supplement:
            with self.subTest(claim=claim["id"]):
                source = by_id[claim["source_record_id"]]
                self.assertIn(claim["source_anchor"], source["recap_fa"])
                self.assertFalse(claim["source_primary_verified"])
                self.assertIn("مستقلاً تأیید نشده", claim["said_date_basis"])

    def test_scenarios_and_duels_have_defined_components(self):
        d = self.public
        family_ids = {f["key"] for f in d["scenario_families"]}
        self.assertEqual(len(family_ids), 7)
        self.assertEqual(len(d["pairs"]), 7)
        buckets = {b["key"] for b in d["buckets"]}
        self.assertTrue(all(
            x["family"] in family_ids for claim in d["claims"]
            for x in claim.get("scenarios", [])))
        self.assertTrue(all(c["kind"] == "L" or c["bucket"] in buckets
                            for c in d["claims"]))

    def test_ledger_does_not_silently_drop_unarchived_claims(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            ledger = root / "daftar.md"
            target = root / "data.json"
            target.write_text('{"claims":[{"id":"keep-me"}],"speakers":[]}', encoding="utf-8")
            ledger.write_text(chr(96) * 3 + "json\n" +
                              '{"claims":[],"speakers":[],"is_complete":false}' +
                              "\n" + chr(96) * 3, encoding="utf-8")
            with self.assertRaises(ValueError):
                build(ledger, target)

    def test_figure_portraits_and_canonical_navigation(self):
        code = (ROOT / "web-static/karname/app.js").read_text(encoding="utf-8")
        css = (ROOT / "web-static/karname/style.css").read_text(encoding="utf-8")
        portraits = json.loads(
            (ROOT / "web-static/data/pendar-figure-portraits.json").read_text(encoding="utf-8"))
        self.assertIn("function profileHandle(s)", code)
        self.assertIn("function avatarMarkup(s)", code)
        self.assertIn("function contributorLinks(c)", code)
        self.assertIn("function personHref(s)", code)
        self.assertIn('"/data/pendar-figure-portraits.json"', code)
        self.assertIn("html+=contributorLinks(c)", code)
        self.assertIn("همهٔ سخنان این چهره در پندار", code)
        self.assertIn("a.claim-person:hover", css)
        self.assertEqual(portraits["abbas-souri"], "/figures/abbas-souri-user.png")
        self.assertTrue((ROOT / "web-static/figures/abbas-souri-user.png").is_file())
        self.assertTrue(any(p.get("key") == "abbas-souri" for p in self.public["speakers"]))

    def test_pilot_notice_visible_and_share_links_present(self):
        code = (ROOT / "web-static/karname/app.js").read_text(encoding="utf-8")
        self.assertIn('data.is_complete===false', code)
        self.assertIn('data.provenance?.disclosure', code)
        self.assertIn('https://t.me/share/url?', code)

    def test_publisher_missing_source_never_invents_data(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            result = publish(root / "site", root / "missing.json")
            self.assertEqual(result, "missing")
            self.assertFalse((root / "site/data/karname.json").exists())

    def test_publisher_accepts_valid_and_rejects_invalid_sources(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source = root / "source.json"
            source.write_text('{"claims":[{"id":"K-1","text":"Test","speakers":["e"]}],'
                              '"speakers":[{"key":"e","name":"Example"}]}', encoding="utf-8")
            self.assertEqual(publish(root / "site", source), "new")
            self.assertEqual(len(json.loads(
                (root / "site/data/karname.json").read_text(encoding="utf-8"))["claims"]), 1)
            source.write_text('{"claims":[{},{}],"speakers":[]}', encoding="utf-8")
            with self.assertRaises(ValueError):
                publish(root / "site2", source)
            with self.assertRaises(ValueError):
                validate({"claims": [{"id": "K-1"}, {"id": "K-1"}], "speakers": []})
            with self.assertRaises(ValueError):
                validate({"claims": [], "speakers": [], "pairs": [{"a": "K-99", "b": "K-100"}]})


if __name__ == "__main__":
    unittest.main()

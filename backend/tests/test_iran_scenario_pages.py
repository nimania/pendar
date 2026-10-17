"""Contract tests for permanent nested Iran scenario pages and their evidence reader."""
from __future__ import annotations

import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_iran_scenario_pages import build, CATALOG, READER


class IranScenarioPageTests(unittest.TestCase):
    def test_every_taxonomy_entry_has_unique_crawlable_page(self):
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        with TemporaryDirectory() as folder:
            root = Path(folder)
            result = build(root)
            self.assertEqual(result["families"], 6)
            self.assertGreaterEqual(result["subscenarios"], 20)
            self.assertEqual(result["pages"], 6 + len(catalog["scenarios"]))
            self.assertEqual(len(set(result["urls"])), result["pages"])
            self.assertTrue((root / "data/iran-scenario-catalog.json").is_file())
            self.assertTrue((root / "radar/iran-scenarios/scenario/reader.js").is_file())
            for family in catalog["families"]:
                fp = root / "radar" / "iran-scenarios" / family["key"] / "index.html"
                markup = fp.read_text(encoding="utf-8")
                self.assertIn(family["title"], markup)
                self.assertIn('rel="canonical"', markup)
                self.assertIn("scenario/reader.js", markup)
                self.assertIn("سناریوهای جزئی", markup)
            for scenario in catalog["scenarios"]:
                fp = (root / "radar" / "iran-scenarios" / scenario["family"] /
                      scenario["slug"] / "index.html")
                markup = fp.read_text(encoding="utf-8")
                self.assertIn(scenario["title"], markup)
                self.assertIn(scenario["proponent"]["name"], markup)
                self.assertIn("/@" + scenario["proponent"]["handle"] + "/", markup)
                self.assertIn("/radar/iran-scenarios/" + scenario["family"] + "/", markup)

    def test_repeated_generation_does_not_duplicate_sitemaps(self):
        with TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "sitemap-1.xml").write_text(
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
                encoding="utf-8")
            build(root)
            first = (root / "sitemap-1.xml").read_text(encoding="utf-8")
            build(root)
            second = (root / "sitemap-1.xml").read_text(encoding="utf-8")
            self.assertEqual(first, second)
            self.assertIn("return-to-fire/", second)

    def test_reader_distinguishes_related_content_and_retains_original_links(self):
        reader = READER.read_text(encoding="utf-8")
        self.assertIn("ارتباط موضوعی", reader)
        self.assertIn("نه تأیید", reader)
        self.assertIn('row.source_links', reader)
        self.assertIn("speakerHref", reader)
        self.assertIn("iran-scenario-live-config.json", reader)
        self.assertIn("scenario-content", reader)


if __name__ == "__main__":
    unittest.main()

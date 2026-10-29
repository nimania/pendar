import gzip
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("news_migration", Path(__file__).parents[1] / "scripts/publish_jankalam_news.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
NEWS = "11111111-1111-1111-1111-111111111111"
REPORT = "22222222-2222-2222-2222-222222222222"
OLD_REPORT = "33333333-3333-3333-3333-333333333333"


class NewsMigrationTests(unittest.TestCase):
    def make_site(self, root):
        site = Path(root)
        (site / "data/story").mkdir(parents=True)
        rows = [{"id": NEWS, "headline_fa": "خبر تجمیعی"},
                {"id": REPORT, "headline_fa": "گزارش", "editorial_report": {"paragraphs": [{"text_fa": "متن تألیفی"}]}},
                {"id": OLD_REPORT, "headline_fa": "گزارش قدیمی"}]
        (site / "data/stories.json").write_text(json.dumps(rows[:2]))
        (site / "data/editorial-archive.json").write_text(json.dumps({"reports": [{"id": OLD_REPORT}]}))
        (site / "data/story-permalinks.json").write_text(json.dumps({"id_to_slug": {NEWS: "news-alias", REPORT: "report-alias"}}))
        for row in rows:
            (site / "data/story" / (row["id"] + ".json")).write_text(json.dumps(row))
            folder = site / "story" / row["id"]
            folder.mkdir(parents=True)
            (folder / "index.html").write_text("ORIGINAL-" + row["id"])
        for slug in ("news-alias", "report-alias"):
            folder = site / "story" / slug
            folder.mkdir(parents=True)
            (folder / "index.html").write_text("ORIGINAL-" + slug)
        for route in ("reports", "trends", "event/editorial-example", "event/event-" + NEWS):
            folder = site / route
            folder.mkdir(parents=True)
            (folder / "index.html").write_text("KEEP-" + route)
        (site / "sitemap.xml").write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
            + ''.join('<url><loc>https://pendar.io/' + p + '/</loc></url>' for p in ("story/" + NEWS, "story/" + REPORT, "reports"))
            + '</urlset>')
        return site

    def test_moves_news_and_aliases_but_preserves_every_authored_report(self):
        with tempfile.TemporaryDirectory() as temp:
            site = self.make_site(temp)
            result = MODULE.migrate(site)
            self.assertEqual(result["news"], 1)
            self.assertEqual(result["protected_reports"], 2)
            for slug in (NEWS, "news-alias"):
                self.assertIn("?story=" + NEWS, (site / "story" / slug / "index.html").read_text())
            for slug in (REPORT, OLD_REPORT, "report-alias"):
                self.assertEqual((site / "story" / slug / "index.html").read_text(), "ORIGINAL-" + slug)
            for path in ("reports", "trends", "event/editorial-example"):
                self.assertEqual((site / path / "index.html").read_text(), "KEEP-" + path)
            self.assertIn("#/event/event-" + NEWS, (site / "event" / ("event-" + NEWS) / "index.html").read_text())
            with gzip.open(site / "data/news-export.json.gz", "rt") as file:
                exported = json.load(file)
            self.assertEqual(set(exported["stories"]), {NEWS})
            self.assertEqual(set(exported["editorial"]), {REPORT, OLD_REPORT})
            sitemap = (site / "sitemap.xml").read_text()
            self.assertNotIn(NEWS, sitemap)
            self.assertIn(REPORT, sitemap)
            # Collectors and authored report JSON are never removed.
            self.assertTrue((site / "data/story" / (REPORT + ".json")).is_file())
            self.assertEqual(MODULE.migrate(site), result)

    def test_missing_news_detail_blocks_redirect_publication(self):
        with tempfile.TemporaryDirectory() as temp:
            site = self.make_site(temp)
            (site / "data/story" / (NEWS + ".json")).unlink()
            with self.assertRaisesRegex(ValueError, "Missing published news details"):
                MODULE.migrate(site)
            self.assertEqual((site / "story" / NEWS / "index.html").read_text(), "ORIGINAL-" + NEWS)


if __name__ == "__main__":
    unittest.main()

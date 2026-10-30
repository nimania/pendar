"""Only complete Pendar-authored reports may replace generic story HTML."""
import json
import tempfile
import unittest
from pathlib import Path

from backend.scripts.prerender_editorial_story_shells import repair
from backend.scripts.publish_editorial_story_sitemap import validate_story

SID = "22222222-2222-4222-8222-222222222222"
NEWS = "33333333-3333-4333-8333-333333333333"
BASE = "https://pendar.io"
SHELL = (
    '<!doctype html><html lang="fa"><head><title>پندار</title>'
    '<meta name="description" content="پندار">'
    '<link rel="canonical" href="https://pendar.io/"></head>'
    '<body><main class="wrap"><p>News JS app shell</p></main></body></html>'
)


def authored_report():
    part = "این بند از گزارش با بررسی مستقیم داده‌ها، منابع منتشرشده و جزئیات زمینه‌ای تدوین شده است. "
    return {
        "id": SID,
        "headline_fa": "گزارش تألیفی مستقل درباره تحولات تازه",
        "published_at": "2026-10-30T12:00:00Z",
        "summary_fa": part * 2,
        "editorial_report": {
            "status": "ai_draft",
            "title_fa": "گزارش مستقل تحولات سیاسی و پیشینه موضوع",
            "lead_fa": part * 2,
            "paragraphs": [{"text_fa": part * 2} for _ in range(4)],
        },
    }


class EditorialPrerenderTests(unittest.TestCase):
    def setup_site(self, tmp, target=None, detail=True):
        site = Path(tmp)
        (site / "index.html").write_text(SHELL, encoding="utf-8")
        (site / "data/story").mkdir(parents=True)
        url = BASE + "/story/" + (target or SID) + "/"
        (site / "data/news-destinations.json").write_text(
            json.dumps({"editorial": {SID: url}}), encoding="utf-8")
        if detail:
            (site / "data/story" / (SID + ".json")).write_text(
                json.dumps(authored_report(), ensure_ascii=False), encoding="utf-8")
        dest = site / "story" / (target or SID)
        dest.mkdir(parents=True)
        (dest / "index.html").write_text(SHELL, encoding="utf-8")
        return site, url

    def test_repairs_full_report_generic_homepage_canonical(self):
        with tempfile.TemporaryDirectory() as tmp:
            site, url = self.setup_site(tmp)
            result = repair(site)
            self.assertEqual(result["repaired"], 1)
            self.assertIsNone(validate_story(site, url))
            content = (site / "story" / SID / "index.html").read_text()
            self.assertIn('id="seo-static"', content)
            self.assertIn("گزارش مستقل تحولات", content)
            self.assertNotIn('href="https://pendar.io/"', content)
            self.assertEqual(repair(site)["repaired"], 0)

    def test_preserves_preferred_slug_and_uuid_alias(self):
        with tempfile.TemporaryDirectory() as tmp:
            site, url = self.setup_site(tmp, "authored-story-slug")
            self.assertEqual(repair(site)["repaired"], 1)
            self.assertIsNone(validate_story(site, url))
            uuid_html = (site / "story" / SID / "index.html").read_text()
            self.assertIn('<link rel="canonical" href="' + url + '">', uuid_html)

    def test_does_not_manufacture_content_from_missing_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            site, url = self.setup_site(tmp, detail=False)
            self.assertEqual(repair(site)["repaired"], 0)
            self.assertEqual((site / "story" / SID / "index.html").read_text(), SHELL)

    def test_does_not_override_intentional_noindex(self):
        with tempfile.TemporaryDirectory() as tmp:
            site, url = self.setup_site(tmp)
            path = site / "story" / SID / "index.html"
            path.write_text(SHELL.replace(
                "</head>", '<meta name="robots" content="noindex,follow"></head>'))
            self.assertEqual(repair(site)["repaired"], 0)
            self.assertIn("noindex", path.read_text())

    def test_does_not_override_existing_other_story_canonical(self):
        with tempfile.TemporaryDirectory() as tmp:
            site, url = self.setup_site(tmp)
            path = site / "story" / SID / "index.html"
            path.write_text(SHELL.replace(
                'href="https://pendar.io/"',
                'href="' + BASE + "/story/" + NEWS + '/"'))
            self.assertEqual(repair(site)["repaired"], 0)


if __name__ == "__main__":
    unittest.main()

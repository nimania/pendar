"""Regression tests for bilingual Radar author identification and portrait."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "package_radar_daily.py"
spec = importlib.util.spec_from_file_location("package_radar_daily", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class TestRadarAuthor(unittest.TestCase):
    def test_author_visible_in_both_languages(self):
        dossier = {
            "date": "2026-10-24", "report_id": "example-2026-10-24",
            "slug": "example", "headline_fa": "عنوان نمونه",
            "summary_fa": "نمونه", "article_fa": "متن نمونه",
            "headline_en": "Example headline", "summary_en": "Example",
            "article_en": "Example analysis",
            "sources": [{"title": "Example", "url": "https://example.org/x",
                         "published_at": "2026-10-24T08:00:00Z"}]
        }
        for lang, name in (("fa", module.AUTHOR_NAME_FA), ("en", module.AUTHOR_NAME_EN)):
            with self.subTest(language=lang):
                html = module.article_html(dossier, lang)
                self.assertIn(name, html)
                self.assertIn('rel="author"', html)
                self.assertIn(module.AUTHOR_PROFILE, html)
                self.assertIn(module.AUTHOR_AVATAR, html)
                self.assertIn('<meta name="author"', html)


if __name__ == "__main__":
    unittest.main()

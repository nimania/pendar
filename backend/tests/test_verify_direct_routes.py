"""Regression: retired Headlines route must not block a healthy Pages release."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from publish_jankalam_news import BASE, redirect_page
from verify_direct_routes import validate, valid_migrated_headlines_redirect


class DirectRouteMigrationTests(unittest.TestCase):
    def test_accepts_only_well_formed_news_redirect(self):
        page = redirect_page(BASE)
        self.assertTrue(valid_migrated_headlines_redirect(page))
        for missing in ('name="robots" content="noindex,follow"',
                        'rel="canonical"',
                        'http-equiv="refresh"',
                        '<a href='):
            with self.subTest(missing=missing):
                self.assertFalse(valid_migrated_headlines_redirect(page.replace(missing, "broken")))

    def test_redirect_is_valid_only_at_headlines_route(self):
        with tempfile.TemporaryDirectory() as temporary:
            site = Path(temporary)
            shell = ('<html><head><base href="/"></head><body>' +
                     ('A' * 1200) + '</body></html>')
            (site / "index.html").write_text(shell, encoding="utf-8")
            for route in ("reports", "diner", "future", "headlines",
                          "figures", "books", "movies", "press"):
                target = site / route / "index.html"
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text(shell, encoding="utf-8")
            (site / "headlines/index.html").write_text(redirect_page(BASE), encoding="utf-8")
            (site / "data").mkdir()
            (site / "data/pendar-editorial-authors.json").write_text('{"authors":[]}', encoding="utf-8")
            (site / "naval").mkdir()
            (site / "naval/index.html").write_text("PENDAR · NAVAL OBSERVER", encoding="utf-8")
            (site / "naval/events.json").write_text("[]", encoding="utf-8")
            (site / "404.html").write_text(shell, encoding="utf-8")
            for module in ("diner.js", "future.js"):
                (site / module).write_text("// valid test module", encoding="utf-8")
            self.assertEqual(validate(site), [])
            (site / "press/index.html").write_text(redirect_page(BASE), encoding="utf-8")
            self.assertIn("Empty or truncated direct-route shell: /press/", validate(site))


if __name__ == "__main__":
    unittest.main()

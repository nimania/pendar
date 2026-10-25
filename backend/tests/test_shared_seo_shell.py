"""Verify the thin SEO shell still delivers readable HTML and an intact SPA."""
import json
import tempfile
import unittest
from pathlib import Path

from backend.scripts.share_seo_shell import share_template, SHELL_SCRIPT


class SeoSharedShellTests(unittest.TestCase):
    def test_preserves_dom_order_and_shared_browser_code(self):
        original = (
            '<!doctype html><html><head>'
            '<script>document.documentElement.classList.add("js-enabled")</script>'
            '<style>h1{color:inherit}</style>'
            '</head><body><main class="wrap"><div id="home-view">Home</div>'
            '<div id="story-view">Story</div></main>'
            '<script defer src="/app.js"></script></body></html>'
        )
        with tempfile.TemporaryDirectory() as folder:
            site = Path(folder)
            result, marker = share_template(site, original)
            self.assertEqual(marker, SHELL_SCRIPT)
            self.assertIn(marker, result)
            self.assertNotIn('id="home-view"', result)
            self.assertIn('src="/seo-shared-inline-1.js"', result)
            self.assertIn('href="/seo-shared-style-1.css"', result)
            self.assertIn('<script defer src="/app.js"></script>', result)
            self.assertTrue(result.index("seo-shared-inline-1.js") <
                            result.index("seo-shared-style-1.css") <
                            result.index("seo-app-shell.js") <
                            result.index("app.js"))
            shell = (site/"seo-app-shell.js").read_text(encoding="utf-8")
            self.assertTrue(shell.startswith("document.write("))
            markup = json.loads(shell[len("document.write("):-3])
            self.assertEqual(markup, '<main class="wrap"><div id="home-view">Home</div><div id="story-view">Story</div></main>')
            twice, _ = share_template(site, result)
            self.assertEqual(twice, result)

    def test_missing_main_fails_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaisesRegex(ValueError, "Missing SPA main"):
                share_template(Path(folder), "<html><body>nothing</body></html>")


if __name__ == "__main__":
    unittest.main()

"""Keep figure-route cache refresh and identity SEO safe."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from refresh_figure_shells import run

NEW_SHELL = '''<!doctype html><html><head><title>پندار</title>
<link rel="stylesheet" href="heritage-figures.css?v=20261018-1">
</head><body><main class="wrap"><section id="figures-view"></section></main>
<script defer src="figures-profile.js?v=new"></script></body></html>'''
OLD_PERSON = '''<!doctype html><html><head><title>شخصیت | پندار</title>
<link rel="canonical" href="https://pendar.io/@example-person/">
<script id="seo-schema" type="application/ld+json">{"@type":"Person"}</script>
</head><body><section id="seo-static"><h1>زندگی‌نامهٔ مستند</h1></section><!-- seo-end -->
<main class="wrap"><section id="figures-view"></section></main>
<script defer src="figures-profile.js?v=old"></script></body></html>'''


class FigureShellTest(unittest.TestCase):
    def test_old_person_seo_is_kept_and_nonperson_identity_untouched(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "index.html").write_text(NEW_SHELL, encoding="utf-8")
            data = root / "data"
            data.mkdir()
            (data / "figures.json").write_text(json.dumps({
                "figures": [{"handle": "example-person", "name_fa": "نام نمونه"}]
            }), encoding="utf-8")
            old_person = root / "@example-person" / "index.html"
            old_person.parent.mkdir()
            old_person.write_text(OLD_PERSON, encoding="utf-8")
            other = root / "@media-outlet" / "index.html"
            other.parent.mkdir()
            other.write_text("DO NOT MODIFY", encoding="utf-8")
            figure = root / "figure" / "example-person" / "index.html"
            figure.parent.mkdir(parents=True)
            figure.write_text(OLD_PERSON, encoding="utf-8")
            changed, protected = run(root)
            self.assertGreaterEqual(changed, 4)
            self.assertEqual(protected, 2)
            content = old_person.read_text(encoding="utf-8")
            self.assertIn("heritage-figures.css?v=20261018-1", content)
            self.assertIn("figures-profile.js?v=new", content)
            self.assertIn("زندگی‌نامهٔ مستند", content)
            self.assertIn('rel="canonical"', content)
            self.assertIn('id="seo-schema"', content)
            self.assertEqual(content.count('id="seo-static"'), 1)
            self.assertEqual(other.read_text(encoding="utf-8"), "DO NOT MODIFY")
            self.assertTrue((root / "figures" / "index.html").is_file())
            self.assertTrue((root / "figures" / "directory" / "index.html").is_file())


if __name__ == "__main__":
    unittest.main()

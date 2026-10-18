"""Static writer aliases are stable, meaningful, and backwards-compatible."""
import json
import tempfile
from pathlib import Path
import unittest
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from build_writer_pages import generate

class WritersRoutesTest(unittest.TestCase):
    def test_real_roster_has_unique_safe_slugs(self):
        roster=json.loads((Path(__file__).resolve().parents[2]/"web-static/data/pendar-editorial-authors.json").read_text(encoding="utf-8"))
        slugs=[a["writer_slug"] for a in roster["authors"]]
        self.assertEqual(len(slugs),7)
        self.assertEqual(len(set(slugs)),7)
        self.assertTrue(all(s.isascii() for s in slugs))

    def test_new_urls_work_without_removing_old_paths(self):
        root=Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as tmp:
            site=Path(tmp)
            (site/"data").mkdir()
            (site/"data/pendar-editorial-authors.json").write_text(
                (root/"web-static/data/pendar-editorial-authors.json").read_text(encoding="utf-8"),encoding="utf-8")
            (site/"index.html").write_text(
                (root/"web-static/index.html").read_text(encoding="utf-8"),encoding="utf-8")
            legacy=site/"editorial-author/diplomacy/index.html"
            legacy.parent.mkdir(parents=True)
            legacy.write_text("LEGACY",encoding="utf-8")
            self.assertEqual(generate(site),7)
            new=site/"writers/arman-shayegan/index.html"
            contents=new.read_text(encoding="utf-8")
            self.assertIn("<title>آرمان شایگان | تحریریه پندار</title>",contents)
            self.assertIn('href="https://pendar.io/writers/arman-shayegan/"',contents)
            self.assertIn("editorial-authors.js?v=",contents)
            self.assertIn("router.js?v=",contents)
            self.assertEqual(legacy.read_text(encoding="utf-8"),"LEGACY")
            self.assertLess(new.stat().st_size,230000)

if __name__=="__main__":
    unittest.main()

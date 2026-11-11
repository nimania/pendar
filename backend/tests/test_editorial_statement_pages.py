"""Regression tests for reviewed, crawlable /statement/ Pages routes."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from publish_editorial_statement_pages import NS, publish


class EditorialStatementPageTests(unittest.TestCase):
    def make_site(self, root):
        site = Path(root)
        (site / "data").mkdir()
        (site / "data/figures.json").write_text(json.dumps({
            "figures": [{"handle": "ahmadzeidabad", "posts": [
                {"id": "editorial-zeidabadi-shabehjang-eragh-20261020"}
            ]}]
        }), encoding="utf-8")
        (site / "sitemap.xml").write_text(
            '<?xml version="1.0"?><sitemapindex xmlns="' + NS + '">'
            '<sitemap><loc>https://pendar.io/sitemap-1.xml</loc></sitemap>'
            '</sitemapindex>', encoding="utf-8")
        (site / "sitemap-1.xml").write_text(
            '<?xml version="1.0"?><urlset xmlns="' + NS + '">'
            '<url><loc>https://pendar.io/statement/retired-post/</loc></url>'
            '<url><loc>https://pendar.io/reports/</loc></url>'
            '</urlset>', encoding="utf-8")
        source = site / "recaps.json"
        source.write_text(json.dumps([{
            "id": "editorial-zeidabadi-shabehjang-eragh-20261020",
            "speaker_handle": "ahmadzeidabad",
            "name_fa": "احمد زیدآبادی",
            "topic_fa": "تحلیل و گفتگو",
            "source_name": "پیام ویدیویی",
            "summary_fa": "بازخوانی مستند دیدگاه گوینده",
            "recap_fa": "این یک بازخوانی اختصاصی و قابل خواندن است. " * 13 + "</script>",
            "recorded_at": "2026-10-20T12:00:00Z"
        }, {
            "id": "editorial-unpublished-20261111",
            "name_fa": "نمونه",
            "topic_fa": "پیش نویس",
            "recap_fa": "منتشر نشده است. " * 30
        }], ensure_ascii=False), encoding="utf-8")
        return site, source

    def test_published_recap_is_indexable_and_unpublished_is_hidden(self):
        with tempfile.TemporaryDirectory() as temporary:
            site, source = self.make_site(temporary)
            result = publish(site, source)
            self.assertEqual(result["created"], 1)
            self.assertEqual(result["skipped_unpublished"], ["editorial-unpublished-20261111"])
            self.assertEqual(result["removed_missing_statement_sitemap_urls"], 1)
            target = site / "statement/editorial-zeidabadi-shabehjang-eragh-20261020/index.html"
            content = target.read_text(encoding="utf-8")
            url = "https://pendar.io/statement/editorial-zeidabadi-shabehjang-eragh-20261020/"
            self.assertIn(f'<link rel="canonical" href="{url}">', content)
            self.assertIn('<meta name="robots" content="index,follow', content)
            self.assertIn('"@type": "Article"', content)
            self.assertIn("بازخوانی اختصاصی", content)
            self.assertIn("&lt;/script&gt;", content)
            self.assertIn('href="/@ahmadzeidabad/"', content)
            self.assertFalse((site / "statement/editorial-unpublished-20261111").exists())
            ns = {"sm": NS}
            sitemap = ET.parse(site / "sitemap-editorial-statements.xml")
            paths = [n.text for n in sitemap.findall(".//sm:loc", ns)]
            self.assertEqual(paths, [url])
            old = ET.parse(site / "sitemap-1.xml")
            self.assertEqual([n.text for n in old.findall(".//sm:loc", ns)],
                             ["https://pendar.io/reports/"])
            self.assertIn("sitemap-editorial-statements.xml",
                          (site / "sitemap.xml").read_text(encoding="utf-8"))
            self.assertEqual(publish(site, source)["created"], 1)
            index = ET.parse(site / "sitemap.xml")
            self.assertEqual(len(index.findall(".//sm:sitemap", ns)), 2)

    def test_unsafe_id_fails_closed(self):
        with tempfile.TemporaryDirectory() as temporary:
            site, source = self.make_site(temporary)
            source.write_text(json.dumps([{
                "id": "../../outside", "recap_fa": "safe " * 100
            }]), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Unsafe editorial recap id"):
                publish(site, source)


if __name__ == "__main__":
    unittest.main()

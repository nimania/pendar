"""Ensure deployed sitemap never advertises trimmed, noindex or aliased pages."""
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

from backend.scripts.reconcile_published_sitemaps import reconcile, NS

Q = "{" + NS + "}"

def node(parent, kind, value):
    child = ET.SubElement(parent, Q+kind)
    child.text = value
    return child


class SitemapReconciliationTests(unittest.TestCase):
    def test_prunes_only_invalid_urls_and_keeps_live_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = Path(tmp)
            urls = []
            for i in range(105):
                path = f"/story/test-{i}/"
                url = "https://pendar.io"+path
                folder = site/path.lstrip("/")
                folder.mkdir(parents=True)
                (folder/"index.html").write_text(
                    f'<html><head><link rel="canonical" href="{url}">'
                    '<meta name="robots" content="index,follow"></head>'
                    '<body><article>Real news</article></body></html>',
                    encoding="utf-8"
                )
                urls.append(url)
            absent = "https://pendar.io/master-movie/nonexistent/"
            noindex = "https://pendar.io/story/noindex/"
            folder = site/"story"/"noindex"
            folder.mkdir(parents=True)
            (folder/"index.html").write_text(
                f'<link rel="canonical" href="{noindex}">'
                '<meta name="robots" content="noindex,follow">',
                encoding="utf-8"
            )
            index = ET.Element(Q+"sitemapindex")
            site_entry = ET.SubElement(index,Q+"sitemap")
            node(site_entry,"loc","https://pendar.io/sitemap-1.xml")
            ET.ElementTree(index).write(site/"sitemap.xml", encoding="utf-8")
            page_map = ET.Element(Q+"urlset")
            for u in urls + [absent, noindex, urls[0]]:
                entry = ET.SubElement(page_map,Q+"url")
                node(entry, "loc", u)
            ET.ElementTree(page_map).write(site/"sitemap-1.xml",encoding="utf-8")
            (site/"data").mkdir()
            stats = reconcile(site)
            self.assertEqual(stats["kept"],105)
            self.assertEqual(stats["missing_or_noncanonical"],2)
            self.assertEqual(stats["duplicates"],1)
            result=ET.parse(site/"sitemap-1.xml").getroot()
            self.assertEqual(len(result.findall(Q+"url")),105)
            self.assertEqual(len(ET.parse(site/"sitemap.xml").getroot()),1)

if __name__ == "__main__":
    unittest.main()

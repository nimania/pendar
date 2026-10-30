"""Sitemap eligibility must follow editorial ownership and actual HTML, not URL count."""
import json
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

from backend.scripts.publish_editorial_story_sitemap import (
    NS, ORIGIN, NAME, build, validate_story,
)

Q = "{" + NS + "}"
GOOD = "22222222-2222-4222-8222-222222222222"
SHORT = "33333333-3333-4333-8333-333333333333"
NEWS = "44444444-4444-4444-8444-444444444444"
SLUG = "authored-report-example"


def page(url, *, paragraphs=True, robots="index,follow", canonical=None, schema=True, refresh=False):
    text = ("این گزارش تألیفی با اتکا به منابع و بررسی پیشینه موضوع نوشته شده "
            "و جزئیات مستقل و توضیح‌های قابل ارزیابی درباره رویداد و پیامدهای آن دارد. ")
    content = "".join("<p>" + text + "</p>" for _ in range(4)) if paragraphs else "<p>خبر کوتاه</p>"
    structured = (
        '<script id="seo-schema" type="application/ld+json">'
        + json.dumps({"@graph": [{"@type": "Article", "url": url}]})
        + "</script>"
    ) if schema else ""
    return (
        '<!doctype html><html><head><title>گزارش مستقل و تألیفی پندار درباره یک رویداد</title>'
        '<link rel="canonical" href="' + (canonical or url) + '">'
        '<meta name="robots" content="' + robots + '">'
        + ('<meta http-equiv="refresh" content="0;url=/">' if refresh else '')
        + structured +
        '</head><body><section id="seo-static" class="wrap">'
        '<h1>گزارش تألیفی مستقل درباره موضوع</h1>'
        + content + '</section><!-- seo-end --></body></html>'
    )


def url(segment):
    return ORIGIN + "/story/" + segment + "/"


def write_page(site, segment, content):
    path = site / "story" / segment
    path.mkdir(parents=True, exist_ok=True)
    (path / "index.html").write_text(content, encoding="utf-8")


def write_sitemap(path, urls):
    root = ET.Element(Q + "urlset")
    for value in urls:
        ET.SubElement(ET.SubElement(root, Q + "url"), Q + "loc").text = value
    ET.ElementTree(root).write(path, encoding="utf-8")


def sitemap_urls(path):
    root = ET.parse(path).getroot()
    return [x.findtext(Q + "loc") for x in root.findall(Q + "url")]


class AuthoredStorySitemapTests(unittest.TestCase):
    def setup_site(self, tmp):
        site = Path(tmp)
        (site / "data").mkdir()
        (site / "data/news-destinations.json").write_text(
            json.dumps({"editorial": {GOOD: url(SLUG), SHORT: url(SHORT)}}),
            encoding="utf-8",
        )
        write_page(site, SLUG, page(url(SLUG)))
        write_page(site, SHORT, page(url(SHORT), paragraphs=False))
        write_page(site, NEWS, page(url(NEWS)))
        write_sitemap(site / "sitemap-1.xml", [url(SLUG), url(SHORT), url(NEWS)])
        write_sitemap(site / NAME, [url(SHORT)])
        root = ET.Element(Q + "sitemapindex")
        for name in ("sitemap-1.xml", NAME):
            ET.SubElement(ET.SubElement(root, Q + "sitemap"), Q + "loc").text = ORIGIN + "/" + name
        ET.ElementTree(root).write(site / "sitemap.xml", encoding="utf-8")
        return site

    def test_dedicated_sitemap_only_has_real_editorial_pages(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = self.setup_site(tmp)
            report = build(site)
            self.assertEqual(report["indexable"], 1)
            self.assertEqual(report["excluded_by_reason"]["insufficient_article_text"], 1)
            self.assertEqual(sitemap_urls(site / NAME), [url(SLUG)])
            self.assertEqual(sitemap_urls(site / "sitemap-1.xml"), [])
            self.assertEqual(build(site)["indexable"], 1)
            entries = ET.parse(site / "sitemap.xml").getroot().findall(Q + "sitemap")
            self.assertEqual(sum(x.findtext(Q + "loc") == ORIGIN + "/" + NAME for x in entries), 1)
            self.assertTrue((site / "data/story-sitemap-audit.json").exists())

    def test_rejects_broken_html_and_redirects(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = self.setup_site(tmp)
            cases = [
                (page(url(SLUG), canonical=url(NEWS)), "not_self_canonical"),
                (page(url(SLUG), robots="noindex,follow"), "not_explicitly_indexable"),
                (page(url(SLUG), schema=False), "missing_article_schema"),
                (page(url(SLUG), refresh=True), "redirect"),
                ('<html><head><title>پندار</title></head><body></body></html>', "not_self_canonical"),
            ]
            for markup, expected in cases:
                with self.subTest(reason=expected):
                    write_page(site, SLUG, markup)
                    self.assertEqual(validate_story(site, url(SLUG)), expected)

    def test_fast_deploy_top_level_article_jsonld_is_accepted(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = self.setup_site(tmp)
            content = page(url(SLUG))
            content = content.replace(
                json.dumps({"@graph": [{"@type": "Article", "url": url(SLUG)}]}),
                json.dumps({"@type": "Article", "url": url(SLUG)}),
            )
            write_page(site, SLUG, content)
            self.assertIsNone(validate_story(site, url(SLUG)))
            self.assertEqual(build(site)["indexable"], 1)

    def test_recovers_only_real_matching_canonical_alias(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = self.setup_site(tmp)
            # A retained authored UUID points to its original readable
            # permalink; both serve the exact same prerendered report.
            wrong = url(GOOD)
            write_page(site, GOOD, page(wrong, canonical=url(SLUG)))
            result = build(site)
            self.assertEqual(result["recovered_by_reason"]["verified_matching_canonical_alias"], 1)
            self.assertEqual(result["indexable"], 1)
            self.assertEqual(sitemap_urls(site / NAME), [url(SLUG)])

    def test_does_not_promote_unrelated_canonical_target(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = self.setup_site(tmp)
            # A self-canonical news page is not evidence that it is the
            # matching authored report; never promote a different article.
            news = page(url(NEWS)).replace("گزارش تألیفی مستقل درباره موضوع", "موضوع دیگری از خبرهای عمومی")
            write_page(site, NEWS, news)
            write_page(site, GOOD, page(url(GOOD), canonical=url(NEWS)))
            result = build(site)
            self.assertEqual(result["indexable"], 1)
            self.assertEqual(result["excluded_by_reason"]["not_self_canonical"], 1)
            self.assertEqual(sitemap_urls(site / NAME), [url(SLUG)])

    def test_refuses_empty_or_uninitialized_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = self.setup_site(tmp)
            write_page(site, SLUG, page(url(SLUG), paragraphs=False))
            with self.assertRaisesRegex(RuntimeError, "Zero independently readable"):
                build(site)
            # On failure, do not replace the old sitemap with an empty file.
            self.assertEqual(sitemap_urls(site / NAME), [url(SHORT)])

        with tempfile.TemporaryDirectory() as tmp:
            site = Path(tmp)
            with self.assertRaisesRegex(RuntimeError, "news-destinations"):
                build(site)


if __name__ == "__main__":
    unittest.main()

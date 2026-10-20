"""Offline regression checks for scoped Google Trends SEO and homepage cards."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from trends_seo import head_meta, stable_key, update_sitemap
from publish_google_trends import run


class TrendPresentationTests(unittest.TestCase):
    def test_stable_keyword_identity(self):
        self.assertEqual(stable_key("كارشناسي ارشد"), stable_key("کارشناسی ارشد"))
        self.assertNotEqual(stable_key("کارشناسی ارشد"), stable_key("آزمون دکتری"))

    def test_canonical_and_rich_social_fields(self):
        markup=head_meta("موضوع مشخص", "توضیح فارسی مستند", "/trends/report/abcdef0123456789/",
                         image="/assets/trends/abcdef0123456789.png",kind="Article",
                         published="2026-10-20T09:00:00+00:00",keyword="آزمون")
        self.assertIn('rel="canonical" href="https://pendar.io/trends/report/abcdef0123456789/"',markup)
        self.assertIn('property="og:image"',markup)
        self.assertIn('application/ld+json',markup)
        self.assertIn('"@type": "Article"',markup)
        self.assertIn("max-image-preview:large",markup)
        self.assertNotIn('<meta name="keywords"',markup)

    def test_brief_is_not_article_and_noindex(self):
        markup=head_meta("موضوع", "متن کوتاه", "/trends/topic/abcdef0123456789/",
                         kind="WebPage",robots="noindex,follow")
        self.assertIn("noindex,follow",markup)
        self.assertNotIn('"@type": "Article"',markup)

    def test_unlicensed_cover_is_never_generated(self):
        from trends_magazine import credited_photo
        self.assertIsNone(credited_photo({"image_url": "/assets/trends/fake.png"}))
        self.assertIsNone(credited_photo({"image_url": "https://publisher.com/pic.jpg"}))

    def test_site_public_output_never_leaks_review_draft(self):
        with tempfile.TemporaryDirectory() as root:
            site=Path(root)/"site"
            site.mkdir()
            (site/"index.html").write_text('<html><body><main>خانه پندار</main></body></html>',encoding="utf-8")
            key="abcdef0123456789"
            sources=[
                {"id":"s1","domain":"example.com","url":"https://example.com/news","headline":"خبر اول","publisher":"نمونه الف"},
                {"id":"s2","domain":"example.org","url":"https://example.org/news","headline":"خبر دوم","publisher":"نمونه ب"},
            ]
            report={"title_fa":"جزئیات جدید پیش فروش بلیت","lead_fa":"متن فارسی مستند برای آزمایش",
                    "lead_citation_ids":["s1"],"paragraphs":[{"text_fa":"جزئیات مطابق منبع نخست","citation_ids":["s1"]},{"text_fa":"جزئیات مطابق منبع دوم","citation_ids":["s2"]}]}
            data={"status":"ok","briefs":[{"trend_keyword":"بلیت قطار","title_fa":"جست‌وجوی بلیت قطار",
                    "lead_fa":"اطلاعات مرتبط با جست‌وجو", "related_news":[{"publisher":"الف","headline":"بلیت قطار","url":"https://example.com/news"}]}],
                "research_reports":[
                    {"id":key,"risk_review_required":False,"research_status":"eligible_low_risk",
                     "trend_keyword":"بلیت قطار","sources":sources,"report":report,"generated_at":"2026-10-20T09:00:00Z"},
                    {"id":"0123456789abcdef","risk_review_required":True,"research_status":"requires_human_review",
                     "trend_keyword":"موضوع حساس","sources":sources,"report":report}],
                "unmatched_trends":[{"sensitive":"private"}],"research_metrics":{"drafts":2}}
            inp=Path(root)/"input.json"
            inp.write_text(json.dumps(data,ensure_ascii=False),encoding="utf-8")
            run(site,inp)
            public=json.loads((site/"data/google-trends-iran.json").read_text(encoding="utf-8"))
            self.assertEqual(public["published_report_count"],1)
            self.assertNotIn("research_reports",public)
            self.assertEqual(len(public["reports"]),1)
            self.assertIn("image_url",public["reports"][0])
            self.assertTrue((site/"trends/report"/key/"index.html").is_file())
            self.assertFalse((site/"trends/report/0123456789abcdef/index.html").exists())
            html=(site/"trends/report"/key/"index.html").read_text(encoding="utf-8")
            self.assertNotIn('property="og:image"',html)
            self.assertIn("magazine-article-paper",html)
            self.assertIn("story-author-byline",html)
            self.assertNotIn("ارتباط این موضوع با Google Trends به‌معنای تأیید",html)
            self.assertIn('rel="canonical"',html)
            self.assertIn('application/ld+json',html)
            self.assertIn("بلیت قطار",html)
            self.assertTrue((site/"sitemap-trends.xml").is_file())

if __name__ == "__main__":unittest.main()

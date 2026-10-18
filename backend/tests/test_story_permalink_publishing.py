"""Safety contracts for published readable article URLs and existing UUID routes."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from publish_story_permalinks import run,slugify

A="01234567-89ab-4cde-8123-456789abcdef"
B="12345678-9abc-4def-8234-56789abcdef0"
ORIGIN="https://pendar.io"
HTML='''<!doctype html><head>
<link rel="canonical" href="https://pendar.io/story/ID/">
<meta property="og:url" content="https://pendar.io/story/ID/">
<script type="application/ld+json" id="seo-schema">{"@graph":[{"@type":"Article","url":"https://pendar.io/story/ID/"},{"@type":"BreadcrumbList","itemListElement":[{"item":"https://pendar.io/story/ID/"}]}]}</script>
</head><body><section id="seo-static"><h1>عنوان معتبر</h1><p>متن اصیل گزارش</p></section><!-- seo-end --></body>'''


class StoryPermalinkTest(unittest.TestCase):
    def site(self,path):
        root=Path(path)
        data=root/"data"
        data.mkdir()
        (data/"stories.json").write_text(json.dumps([
            {"id":A,"headline_fa":"ایران هرمز مذاکرات","published_at":"2026-10-18T15:00:00"},
            {"id":B,"headline_fa":"آمریکا انتخابات دولت","published_at":"2026-10-17T15:00:00"},
        ],ensure_ascii=False),encoding="utf-8")
        for sid in (A,B):
            story_dir=root/"story"/sid
            story_dir.mkdir(parents=True)
            url=ORIGIN+"/story/"+sid+"/"
            (story_dir/"index.html").write_text(HTML.replace("ID",sid),encoding="utf-8")
            (story_dir/"seo.json").write_text(json.dumps({
                "canonical":url,"tags":{"og:url":url},
                "schema":{"@graph":[{"@type":"Article","url":url},{"@type":"BreadcrumbList","itemListElement":[{"item":url}]}]}
            }),encoding="utf-8")
        (root/"sitemap-1.xml").write_text("<urlset><url><loc>"+ORIGIN+"/story/"+A+"/</loc></url></urlset>",encoding="utf-8")
        return root

    def test_english_readable_title(self):
        self.assertEqual(slugify("ایران هرمز مذاکرات"),"iran-hormuz-negotiations")
        self.assertEqual(slugify("ترامپ و اسرائیل: جنگ یا آتش‌بس؟"),"trump-israel-war-ceasefire")

    def test_static_alias_keeps_article_and_uuid(self):
        with tempfile.TemporaryDirectory() as td:
            site=self.site(td)
            manifest=run(site,limit=2)
            pretty=site/"story"/"iran-hormuz-negotiations"/"index.html"
            self.assertTrue(pretty.is_file())
            self.assertIn("متن اصیل گزارش",pretty.read_text(encoding="utf-8"))
            self.assertIn(ORIGIN+"/story/iran-hormuz-negotiations/",pretty.read_text(encoding="utf-8"))
            old=site/"story"/A/"index.html"
            self.assertTrue(old.is_file())
            self.assertIn("متن اصیل گزارش",old.read_text(encoding="utf-8"))
            self.assertIn(ORIGIN+"/story/iran-hormuz-negotiations/",old.read_text(encoding="utf-8"))
            self.assertNotIn("https://pendar.io/story/"+A+"/</loc>",(site/"sitemap-1.xml").read_text(encoding="utf-8"))
            self.assertEqual(manifest["slug_to_id"]["iran-hormuz-negotiations"],A)
            self.assertIn('window.pendarStoryURL=',(site/"data/story-permalinks.js").read_text(encoding="utf-8"))
            self.assertEqual(json.loads((old.parent/"seo.json").read_text(encoding="utf-8"))["canonical"],
                             ORIGIN+"/story/iran-hormuz-negotiations/")

    def test_published_slug_is_stable_after_title_change(self):
        with tempfile.TemporaryDirectory() as td:
            site=self.site(td)
            original=run(site,limit=2)
            news=site/"data/stories.json"
            changed=json.loads(news.read_text(encoding="utf-8"))
            changed[0]["headline_fa"]="عنوان تازه درباره سیاست"
            news.write_text(json.dumps(changed,ensure_ascii=False),encoding="utf-8")
            refreshed=run(site,limit=2)
            self.assertEqual(refreshed["id_to_slug"],original["id_to_slug"])
            self.assertTrue((site/"story"/"iran-hormuz-negotiations"/"index.html").is_file())

    def test_recent_article_gets_real_seo_html_instead_of_homepage_placeholder(self):
        with tempfile.TemporaryDirectory() as td:
            site=self.site(td)
            target=site/"story"/A/"index.html"
            target.write_text('<!doctype html><head><title>پندار</title></head>'
                              '<body><main class="wrap"></main></body>',encoding="utf-8")
            detail=site/"data"/"story"
            detail.mkdir(parents=True)
            (detail/(A+".json")).write_text(json.dumps({
                "id":A,"headline_fa":"ایران هرمز مذاکرات",
                "summary_fa":"خبرگزاری‌ها از دور جدید مذاکرات درباره مسیرهای عبور و مرور منطقه خبر داده‌اند و مقام‌های مرتبط توضیحاتی ارائه کرده‌اند.",
                "what_happened_fa":"این تحولات در زمینه گفت‌وگوهای قبلی مطرح شده و درباره زمان و نتیجه نهایی توافق هنوز اطلاعات قطعی منتشر نشده است.",
                "why_it_matters_fa":"تصمیم درباره رفت‌وآمد کشتی‌ها بر بازار انرژی و فعالیت‌های اقتصادی منطقه اثر می‌گذارد.",
                "sources":[{"article_url":"https://example.org/report","source_name":"منبع آزمایشی"}],
            },ensure_ascii=False),encoding="utf-8")
            result=run(site,limit=1)
            self.assertEqual(len(result["id_to_slug"]),1)
            page=(site/"story"/"iran-hormuz-negotiations"/"index.html").read_text(encoding="utf-8")
            self.assertIn('id="seo-static"',page)
            self.assertIn("اثر می‌گذارد",page)
            self.assertIn("https://example.org/report",page)
            self.assertIn('"canonical" href="https://pendar.io/story/iran-hormuz-negotiations/"',page)
            self.assertTrue((site/"sitemap-readable-stories.xml").is_file() is False or
                            "iran-hormuz-negotiations" in
                            (site/"sitemap-readable-stories.xml").read_text(encoding="utf-8"))

    def test_never_removes_original_or_unsupported_legacy_routes(self):
        with tempfile.TemporaryDirectory() as td:
            site=self.site(td)
            missing=site/"story"/B/"index.html"
            missing.unlink()
            result=run(site,limit=2)
            self.assertNotIn(B,result["id_to_slug"])
            self.assertTrue((site/"story"/A/"index.html").is_file())


if __name__ == "__main__":
    unittest.main()

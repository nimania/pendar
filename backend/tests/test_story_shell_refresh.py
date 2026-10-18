"""Tests for non-destructive refreshing of cached article route HTML."""
import sys
from pathlib import Path
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from refresh_story_shells import refresh_shell, compact_story_shell, SHARED_HOME_STYLE_IDS, run

ARTICLE_ID = "b4efb62f-9240-4e90-ba4f-4664e608fa97"

FRESH_SHELL = '''<!doctype html><html><head>
<title>پندار امروز</title>
<meta name="description" content="خانه پندار">
<link rel="stylesheet" href="heritage-article.css?v=new-ui">
</head><body>
<main class="wrap"><section id="detail-view"></section></main>
<script defer src="story-detail.js?v=new-ui"></script>
</body></html>'''

OLD_SEO_STORY = '''<!doctype html><html><head><base href="/">
<title>یک خبر معتبر | پندار</title>
<meta name="description" content="چکیدهٔ همان خبر">
<link rel="canonical" href="https://pendar.io/story/''' + ARTICLE_ID + '''/">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:title" content="یک خبر معتبر | پندار">
<script type="application/ld+json" id="seo-schema">{"@type":"Article","headline":"یک خبر معتبر"}</script>
</head><body>
<section id="seo-static" class="wrap"><nav>پندار</nav><h1>یک خبر معتبر</h1>
<p>متن کامل و اختصاصی همان مقاله برای جست‌وجو</p></section><!-- seo-end -->
<main class="wrap"><section id="detail-view"></section></main>
<script defer src="story-detail.js?v=old-ui"></script>
</body></html>'''


class StoryShellRefreshTest(unittest.TestCase):
    def test_keeps_every_story_seo_asset(self):
        output = refresh_shell(FRESH_SHELL, OLD_SEO_STORY)
        self.assertIn('heritage-article.css?v=new-ui', output)
        self.assertIn('story-detail.js?v=new-ui', output)
        self.assertNotIn('story-detail.js?v=old-ui', output)
        self.assertIn('یک خبر معتبر | پندار', output)
        self.assertIn('چکیدهٔ همان خبر', output)
        self.assertIn('rel="canonical"', output)
        self.assertIn('og:title', output)
        self.assertIn('id="seo-schema"', output)
        self.assertIn('متن کامل و اختصاصی همان مقاله', output)
        self.assertIn('html.js-enabled #seo-static', output)
        self.assertEqual(output.count('id="seo-static"'), 1)
        self.assertEqual(output.count('id="seo-schema"'), 1)

    def test_new_app_shell_only(self):
        output = refresh_shell(FRESH_SHELL, FRESH_SHELL.replace("new-ui", "old-ui"))
        self.assertIn('heritage-article.css?v=new-ui', output)
        self.assertNotIn('seo-static', output)
        self.assertEqual(output.count('<base href="/">'), 1)

    def test_compact_real_shell_saves_at_least_nine_kb_per_article(self):
        shell = (Path(__file__).resolve().parents[2] / "web-static" / "index.html").read_text(encoding="utf-8")
        compacted = compact_story_shell(shell)
        delta = len(shell.encode("utf-8")) - len(compacted.encode("utf-8"))
        self.assertGreaterEqual(delta, 8000, "Direct article pages should not repeat bulky homepage CSS")
        for style_id in SHARED_HOME_STYLE_IDS:
            self.assertNotIn('<style id="' + style_id + '">', compacted)
        self.assertIn('id="detail-view"', compacted)
        self.assertIn('story-detail.js?v=', compacted)
        self.assertIn('heritage-article.css?v=', compacted)
        self.assertNotIn('id="story-editorial-critical"', compacted)
        shared = (Path(__file__).resolve().parents[2] / "web-static" / "heritage-article.css").read_text(encoding="utf-8")
        self.assertIn("/* story-editorial-critical */", shared)
        self.assertIn("#detail-view .story-editorial", shared)
        self.assertIn("#detail-view", shared)

    def test_refresh_preserves_explicit_article_html_between_tags(self):
        story = OLD_SEO_STORY.replace(
            'متن کامل و اختصاصی همان مقاله برای جست‌وجو',
            'سطر اول\nسطر دوم از همان گزارش و متن پیش‌رندرشده'
        )
        refreshed = refresh_shell(FRESH_SHELL, story)
        self.assertIn('سطر اول\nسطر دوم از همان گزارش و متن پیش‌رندرشده', refreshed)
        self.assertEqual(refreshed.count('id="seo-static"'), 1)

    def test_refreshes_existing_entry_on_disk(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "index.html").write_text(FRESH_SHELL, encoding="utf-8")
            shared = Path(__file__).resolve().parents[2] / "web-static" / "heritage-article.css"
            (root / "heritage-article.css").write_text(shared.read_text(encoding="utf-8"), encoding="utf-8")
            target = root / "story" / ARTICLE_ID / "index.html"
            target.parent.mkdir(parents=True)
            target.write_text(OLD_SEO_STORY, encoding="utf-8")
            count, seo = run(root)
            self.assertEqual((count, seo), (1, 1))
            result = target.read_text(encoding="utf-8")
            self.assertIn('story-detail.js?v=new-ui', result)
            self.assertIn('index,follow', result)
            self.assertIn('id="seo-schema"', result)


if __name__ == "__main__":
    unittest.main()

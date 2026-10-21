"""Keep search-oriented trends in the lower headline panel and an uncluttered editorial cover."""
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
JS=ROOT/"web-static"/"heritage-preview.js"
HTML=ROOT/"web-static"/"heritage-preview.html"
CSS=ROOT/"web-static"/"heritage-preview.css"

class TrendHomepageTest(unittest.TestCase):
    def test_editorial_frontpage_is_default_and_search_trends_have_a_rail_tab(self):
        html=HTML.read_text(encoding="utf-8")
        self.assertNotIn('id="feature-heading-title"',html)
        self.assertNotIn('class="feature-category-tabs"',html)
        self.assertIn('id="feature-politics-panel" role="region" aria-label="گزارش‌های برگزیدهٔ صفحهٔ اول">',html)
        self.assertIn('class="quick-pulse"',html)
        self.assertIn('id="feature-front-page"',html)
        self.assertIn('id="feature-hero"',html)
        self.assertNotIn('id="feature-trends-panel"',html)
        self.assertNotIn('id="feature-tab-trends"',html)
        self.assertIn('data-rail-group="headlines"',html)
        self.assertIn('data-rail-tab="fresh"',html)
        self.assertIn('data-rail-tab="hot"',html)
        self.assertIn('data-rail-tab="trends">ترند</button>',html)
        self.assertIn('data-rail-panel="trends" hidden',html)
        self.assertIn('id="rail-headlines-trends"',html)
        self.assertIn('href="/trends/">آرشیو ترندهای امروز',html)

    def test_only_eligible_published_trends_enter_compact_rail(self):
        js=JS.read_text(encoding="utf-8")
        section=js[js.index("function renderSearchTrendsInRail()"):js.index("async function renderHome()")]
        self.assertIn('fetchJson("/data/google-trends-iran.json")',section)
        self.assertIn('payload&&payload.reports',section)
        self.assertIn('payload&&payload.briefs',section)
        self.assertIn('reports.concat(topics)',section)
        self.assertIn('selected.length>=5',section)
        self.assertIn('seen.has(url)',section)
        self.assertIn('validLink(row.url)',section)
        self.assertIn('esc(row.title)',section)
        self.assertIn('put("rail-headlines-trends"',section)
        self.assertIn('put("rail-figures-trends"',section)
        self.assertNotIn('feature-trend-card',section)
        self.assertNotIn('checkImage(url)',section)
        self.assertIn('renderSearchTrendsInRail();',js)
        self.assertNotIn('renderSearchTrendTab();',js)

    def test_existing_headline_and_figure_tabs_remain(self):
        js=JS.read_text(encoding="utf-8")
        html=HTML.read_text(encoding="utf-8")
        self.assertIn('fillFive("rail-headlines-fresh",sorted);',js)
        self.assertIn('fillFive("rail-headlines-hot",rankedWithSignal(importance));',js)
        self.assertIn('data-rail-group="figures"',html)
        self.assertIn('id="rail-figures-updated"',html)
        self.assertIn('id="rail-figures-talkative"',html)

    def test_compact_trends_and_unchanged_photo_cover(self):
        css=CSS.read_text(encoding="utf-8")
        self.assertIn('.rail-five .rail-trend-row{display:flex;',css)
        self.assertIn('.rail-five .rail-trend-marker{',css)
        self.assertIn('.feature-picture img{display:block;',css)

if __name__=="__main__":
    unittest.main()

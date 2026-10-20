"""Guard the homepage trend photo/list layout and figure rail from regressions."""
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
JS=ROOT/"web-static"/"heritage-preview.js"
HTML=ROOT/"web-static"/"heritage-preview.html"
CSS=ROOT/"web-static"/"heritage-preview.css"

class TrendHomepageTest(unittest.TestCase):
    def test_trends_remain_first_default_tab(self):
        html=HTML.read_text(encoding="utf-8")
        first=html.index('id="feature-tab-trends"')
        second=html.index('id="feature-tab-politics"')
        self.assertLess(first,second)
        self.assertIn('id="feature-trends-panel" role="tabpanel" aria-labelledby="feature-tab-trends">',html)
        self.assertIn('id="feature-politics-panel" role="tabpanel" aria-labelledby="feature-tab-politics" hidden',html)
    def test_missing_photos_go_to_list_not_large_blank_cards(self):
        js=JS.read_text(encoding="utf-8")
        section=js[js.index("function renderSearchTrendTab()"):js.index("async function renderHome()")]
        self.assertIn('checkImage(url)',section)
        self.assertIn('photographic.push(r)',section)
        self.assertIn('else remaining.push(r)',section)
        self.assertIn('ادامهٔ ترندهای امروز',section)
        self.assertIn('feature-trend-list-row',section)
        self.assertNotIn("trend-lead text-only",section)
        self.assertIn('grid.querySelectorAll(".feature-trend-card img")',section)
    def test_figures_section_untouched(self):
        html=HTML.read_text(encoding="utf-8")
        self.assertIn('data-rail-group="figures"',html)
        self.assertIn('id="rail-figures-updated"',html)
        self.assertIn('id="rail-figures-talkative"',html)
    def test_photos_have_fixed_aspect_ratio(self):
        css=CSS.read_text(encoding="utf-8")
        self.assertIn('.feature-trend-card.has-photo .feature-trend-picture{width:100%;height:auto;aspect-ratio:16/9;',css)
        self.assertIn('.feature-trend-continuation{grid-column:1/-1;',css)

if __name__=="__main__":
    unittest.main()

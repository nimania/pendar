"""Regression coverage for retroactive article cleanup and cross-section linking."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))

from trends_enrichment import smart_destinations
from trends_magazine import byline, public_prose, history_graph, report_body
from trends_context import render_context
from trends_topics import classify

class TrendsEnrichmentTests(unittest.TestCase):
    def test_existing_reports_link_to_pendar_sections(self):
        with tempfile.TemporaryDirectory() as temp:
            market=smart_destinations(temp,{"trend_keyword":"تتر","report":{"title_fa":"نوسان قیمت تتر"}})
            self.assertTrue(any(x["url"]=="/market/" for x in market))
            weather=smart_destinations(temp,{"trend_keyword":"آلودگی هوا","report":{"title_fa":"هشدار کیفیت هوا"}})
            self.assertTrue(any(x["url"]=="/weather/" for x in weather))
            city=smart_destinations(temp,{"trend_keyword":"اشکان خورشیدی","report":{
                "title_fa":"اشکان خورشیدی معاون ورزشی خیبر خرم‌آباد شد",
                "paragraphs":[{"text_fa":"این باشگاه در خرم‌آباد استان لرستان فعالیت می‌کند."}]}})
            self.assertTrue(any(x["url"]=="/places/city/khorramabad/" for x in city))
            self.assertTrue(any(x["url"]=="/places/province/lorestan/" for x in city))

    def test_named_author_and_unobtrusive_sources(self):
        writer=byline({"trend_keyword":"اشکان خورشیدی","report":{"title_fa":"معاون ورزشی خیبر"}})
        self.assertNotEqual(writer["id"],"desk")
        self.assertNotEqual(writer["display_name_fa"],"تحریریهٔ پندار")
        self.assertEqual(public_prose("خبر جدید (s1) در تهران [s2] تایید شد"),
                         "خبر جدید در تهران تایید شد")
        self.assertEqual(public_prose("s1 خبر s2"),"خبر")

    def test_graph_explains_missing_data_without_inventing_curve(self):
        missing=history_graph([],"abcdef0123456789","اشکان خورشیدی")
        self.assertIn("trends.google.com",missing)
        self.assertNotIn("<polyline",missing)

    def test_article_does_not_expose_internal_citation_ids_or_formula_title(self):
        row={"id":"abcdef0123456789","trend_keyword":"خبر فوتبالی",
             "report":{"title_fa":"اشکان خورشیدی معاون ورزشی شد",
                 "lead_fa":"خبر رسمی (s1) منتشر شد",
                 "lead_citation_ids":["s1"],
                 "trend_context":{"text_fa":"متنی برای جست‌وجو","citation_ids":["s1","s2"]},
                 "paragraphs":[{"text_fa":"توضیح خبر [s2] تکمیل شد","citation_ids":["s2"]}]},
             "sources":[
                 {"id":"s1","url":"https://example.com/a","publisher":"رسانه یک","headline":"خبر"},
                 {"id":"s2","url":"https://example.org/b","publisher":"رسانه دو","headline":"پیگیری"}]}
        with tempfile.TemporaryDirectory() as temp:
            html=report_body(row,temp,[],[])
        self.assertNotIn("زمینهٔ احتمالی افزایش جست‌وجو",html)
        self.assertNotIn("s1",html)
        self.assertNotIn("s2",html)
        self.assertIn("زیر ذره‌بین پندار",html)
        self.assertIn("رسانه یک",html)

    def test_native_profile_links_existing_news(self):
        with tempfile.TemporaryDirectory() as temp:
            site=Path(temp)
            (site/"data").mkdir()
            (site/"index.html").write_text("<!doctype html><html><head></head><body>Pendar</body></html>",encoding="utf-8")
            (site/"data"/"figures.json").write_text('{"figures":[]}',encoding="utf-8")
            person=classify(site,"اشکان خورشیدی",{})
            articles=[{"url":"/trends/report/abcdef0123456789/","title":"اشکان خورشیدی معاون ورزشی شد",
                "trend_keyword":"اشکان خورشیدی","lead_fa":"اشکان خورشیدی و خیبر خرم‌آباد","published_at":"2026-10-20"}]
            created=render_context(site,person,[],articles)
            self.assertTrue(created)
            people=json.loads((site/"data"/"figures.json").read_text(encoding="utf-8"))["figures"]
            self.assertEqual(people[0]["handle"],"ashkan-khorshidi")
            self.assertEqual(people[0]["trend_reports"][0]["url"],articles[0]["url"])
            self.assertTrue((site/"@ashkan-khorshidi/index.html").exists())

if __name__=="__main__":unittest.main()

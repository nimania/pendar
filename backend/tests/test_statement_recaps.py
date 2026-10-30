"""Offline safeguards for five-hour voice recaps (no model or network calls)."""
import datetime as dt
import json
import tempfile
import unittest
from pathlib import Path

from scripts.publish_statement_recaps import (
    UTC, SLOT_SECONDS, gather, desk, stamp, author_for, validate, publish
)


class StatementRecapTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.site = Path(self.temporary.name)
        (self.site/"data").mkdir()
        self.roster = [{"id":f"author-{i}", "display_name_fa":f"دبیر {i}",
                        "handle":f"writer-{i}"} for i in range(7)]
        (self.site/"data"/"pendar-editorial-authors.json").write_text(
            json.dumps({"authors":self.roster},ensure_ascii=False),encoding="utf-8")
        self.now=dt.datetime(2026,10,30,13,45,tzinfo=UTC)
        slot=int(self.now.timestamp()//SLOT_SECONDS)-1
        self.start=dt.datetime.fromtimestamp(slot*SLOT_SECONDS, UTC)
        self.end=self.start+dt.timedelta(seconds=SLOT_SECONDS)

    def tearDown(self):
        self.temporary.cleanup()

    def test_profile_links_and_migrated_news_destinations(self):
        from scripts.publish_statement_recaps import (
            news_destination, attach_internal_links, link_people_in_text, report_page
        )
        sid="11111111-1111-4111-8111-111111111111"
        eid="22222222-2222-4222-8222-222222222222"
        manifest={"news_ids":[sid],
                  "editorial":{eid:"https://pendar.io/story/editorial-feature/"}}
        self.assertEqual(news_destination(sid,manifest),
            "https://nimania.github.io/jan-kalam/?story="+sid)
        self.assertEqual(news_destination(eid,manifest),
            "https://pendar.io/story/editorial-feature/")
        sources=[{"source_id":"s1","person":"دونالد ترامپ","handle":"donald-trump",
                  "post_id":"news:post-1","story_id":sid,"post_kind":"news_statement",
                  "text":"اظهارنظر جدید دونالد ترامپ درباره وضعیت منطقه ثبت شده است.",
                  "url":"https://example.org/source","time":self.now.isoformat()}]
        attach_internal_links(sources,manifest)
        self.assertEqual(sources[0]["person_url"],"/@donald-trump/")
        self.assertEqual(sources[0]["statement_url"],"/statement/news%3Apost-1/")
        self.assertIn("jan-kalam/?story=",sources[0]["internal_url"])
        self.assertIn('href="/@donald-trump/"',
            link_people_in_text("دونالد ترامپ درباره سیاست منطقه گفت",sources))
        report={"id":"99629-news","kind":"news","url":"/reports/voices/99629-news/",
                "generated_at":self.now.isoformat(),"title_fa":"گفته‌های دونالد ترامپ در خبرها",
                "lead_fa":"دونالد ترامپ درباره مسائل منطقه و تغییرات تازه اظهارنظر کرده است.",
                "window_start":self.start.isoformat(),"window_end":self.end.isoformat(),
                "author_handle":"author-1","author_name":"نویسنده نمونه",
                "sources":sources,
                "paragraphs":[{"text_fa":"دونالد ترامپ در این اظهارنظر درباره تحولات منطقه صحبت کرده است.",
                               "source_ids":["s1"]}]}
        page=report_page(report)
        self.assertIn('href="/@donald-trump/"',page)
        self.assertIn("جان‌کلام",page)
        self.assertIn("https://example.org/source",page)
        self.assertIn("/statement/news%3Apost-1/",page)

    def test_light_deploy_keeps_published_recap_data(self):
        from scripts.prepare_priority_site import keep_data_file
        self.assertTrue(keep_data_file("voice-recaps.json"))

    def test_role_classification_matches_front_page(self):
        self.assertEqual(desk({"name_fa":"مهدی تدینی","role_fa":"تاریخ‌نگار"}),"opinions")
        self.assertEqual(desk({"name_fa":"دونالد ترامپ","role_fa":"سیاستمدار"}),"news")
        self.assertEqual(desk({"name_fa":"دیگری","role_fa":"تحلیلگر سیاسی"}),"opinions")
        self.assertEqual(desk({"name_fa":"دیگری","role_fa":"وزیر خارجه"}),"news")
        self.assertEqual(desk({"name_fa":"دیگری","handle":"news-123"}),"news")

    def test_exact_window_and_dedup(self):
        iso=lambda t:t.isoformat()
        base={"id":"x1","summary_fa":"یک اظهارنظر بلند در مورد مسائل عمومی و تاثیر سیاست‌های اخیر",
              "published_at":iso(self.start+dt.timedelta(seconds=5)),
              "url":"https://example.com/post"}
        figure={"name_fa":"دونالد ترامپ","handle":"trump","role_fa":"رئیس جمهور","posts":[base,dict(base)]}
        rows=gather({"figures":[figure]},self.start,self.end,"news")
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]["source_id"],"s1")
        figure["posts"].append(dict(base,id="x2",published_at=iso(self.end)))
        self.assertEqual(len(gather({"figures":[figure]},self.start,self.end,"news")),1)

    def test_model_discovery_avoids_obsolete_configured_name(self):
        from scripts.publish_statement_recaps import model_candidates
        gemini=model_candidates("gemini","obsolete-model",
                                ["gemini-2.5-flash-lite","gemini-2.5-flash"])
        self.assertEqual(gemini[0],"gemini-2.5-flash")
        self.assertNotIn("obsolete-model",gemini)
        newest=model_candidates("gemini","old-model",
                                ["gemini-2.5-flash","gemini-3.5-flash","gemini-3.1-flash-lite"])
        self.assertEqual(newest[0],"gemini-3.5-flash")
        anthropic=model_candidates("anthropic","stale-claude",
                                   ["claude-haiku-4-5","claude-sonnet-4-5"])
        self.assertEqual(anthropic[0],"claude-sonnet-4-5")

    def test_stable_author(self):
        selected=author_for(1234,"news",self.roster)
        self.assertEqual(selected,author_for(1234,"news",self.roster))
        ids={author_for(i,"opinions",self.roster)["id"] for i in range(100)}
        self.assertEqual(len(ids),7)

    def test_validation_refuses_unknown_citations(self):
        source=[{"source_id":"s1"}]
        doc={"title_fa":"تیتر گزارش پنج‌ساعته امروز",
             "lead_fa":"این لید خلاصه‌ای مستند از اظهارنظرهای ثبت‌شده در دورهٔ پنج‌ساعته است و فقط به همان داده‌ها اتکا می‌کند.",
             "paragraphs":[{"text_fa":"این یک پاراگراف مستند است که توضیحی روشن درباره اظهارنظر گوینده ارائه می‌کند.",
                            "source_ids":["s1"]} for _ in range(2)]}
        self.assertIsNotNone(validate(doc,source))
        doc["paragraphs"][0]["source_ids"]=["not-in-sources"]
        self.assertIsNone(validate(doc,source))

    def test_publish_pages_and_do_not_duplicate(self):
        body="این شخص درباره نقش دیپلماسی و احتمال توافق در منطقه اظهارنظر کرده و آن را ضروری دانسته است."
        figures={"generated_at":self.now.isoformat(),
                 "figures":[
                     {"handle":"news-one","name_fa":"وزیر نمونه","role_fa":"وزیر",
                      "posts":[{"id":"n1","summary_fa":body,"published_at":(self.start+dt.timedelta(hours=2)).isoformat(),
                                "url":"https://news.example/1"}]},
                     {"handle":"opinion-one","name_fa":"مفسر نمونه","role_fa":"تحلیلگر",
                      "posts":[{"id":"o1","summary_fa":body,"published_at":(self.start+dt.timedelta(hours=3)).isoformat(),
                                "url":"https://news.example/2"}]}
                 ]}
        (self.site/"data"/"figures.json").write_text(json.dumps(figures,ensure_ascii=False),encoding="utf-8")
        calls=[]
        def fake(kind,start,end,sources):
            calls.append(kind)
            ids=[x["source_id"] for x in sources]
            return {"title_fa":"گزارش پنج‌ساعته گفته‌های جدید",
                    "lead_fa":"در این بازه گروهی از چهره‌های عمومی درباره تحولات اخیر اظهارنظر کرده‌اند و این گزارش به روایت ثبت‌شده آنان محدود است.",
                    "paragraphs":[{"text_fa":"گوینده مورد بحث به موضوع مهمی اشاره کرده و این دیدگاه باید به نام خود او ثبت شود.",
                                   "source_ids":ids} for _ in range(2)]}
        created=publish(self.site,now=self.now,generate_fn=fake)
        self.assertEqual(len(created),2)
        self.assertTrue((self.site/"reports"/"voices"/"index.html").is_file())
        self.assertTrue((self.site/"sitemap-voices.xml").is_file())
        data=json.loads((self.site/"data"/"voice-recaps.json").read_text(encoding="utf-8"))
        self.assertEqual(len(data["reports"]),2)
        for row in data["reports"]:
            page=(self.site/row["url"].lstrip("/")/"index.html").read_text(encoding="utf-8")
            self.assertIn("تمام گفته‌های این دوره",page)
            self.assertIn(row["author_name"],page)
            self.assertIn("https://news.example/",page)
            self.assertIn('rel="canonical"',page)
        self.assertEqual(publish(self.site,now=self.now,generate_fn=fake),[])
        self.assertEqual(len(calls),2)

    def test_insufficient_collector_freshness_blocks_publishing(self):
        dataset={"generated_at":(self.end-dt.timedelta(hours=1)).isoformat(),"figures":[]}
        (self.site/"data"/"figures.json").write_text(json.dumps(dataset),encoding="utf-8")
        self.assertEqual(publish(self.site,now=self.now,generate_fn=lambda *_:None),[])
        self.assertTrue((self.site/"reports"/"voices"/"index.html").is_file())


if __name__=="__main__":
    unittest.main()

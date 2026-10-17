"""Grounding contracts for the Pendar editorial history/report builder."""
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_editorial_reports import (
    related_news, source_refs, valid_report, build,
)

NOW="2026-10-17T12:00:00+00:00"
OLD="2026-10-08T12:00:00+00:00"
ID="b4efb62f-9240-4e90-ba4f-4664e608fa97"
OTHER="e691ff86-0f4a-4f31-86f8-b4e8c411cc09"
OFF="df1e7ace-2215-48ca-bc25-d49612ed144d"
STORY={"id":ID,"headline_fa":"گزارش برخورد نفتکش با مین دریایی در تنگه هرمز",
       "summary_fa":"گزارش تازه درباره عبور نفتکش و برخورد احتمالی با مین دریایی در تنگه هرمز",
       "published_at":NOW,"category":"world"}
PRIOR={"id":OTHER,"headline_fa":"هشدار درباره عبور نفتکش و مین دریایی در تنگه هرمز",
       "summary_fa":"بررسی سابقه عبور نفتکش از تنگه هرمز و خطر مین دریایی",
       "published_at":OLD,"category":"world"}
UNRELATED={"id":OFF,"headline_fa":"قطع برق و گاز در کهگیلویه و بویراحمد",
           "summary_fa":"بررسی قطعی برق در مدارس و منازل این استان",
           "published_at":OLD,"category":"world"}


class EditorialReportTests(unittest.TestCase):
    def test_strong_history_only(self):
        c=related_news(STORY,[STORY,PRIOR,UNRELATED])
        self.assertEqual([v["id"] for v in c["background"]],[OTHER])
        self.assertFalse(c["later"])

    def test_near_duplicate_rejected(self):
        same=dict(PRIOR,published_at="2026-10-17T11:30:00+00:00")
        self.assertFalse(related_news(STORY,[same])["background"])

    def test_no_unrelated_sources(self):
        story=dict(STORY,
                   what_happened_fa="نفتکش در تنگه هرمز با مین دریایی برخورد کرده است",
                   sources=[
                     {"article_url":"https://news.example/hormuz","original_headline":"برخورد نفتکش با مین در هرمز","source_name":"الف"},
                     {"article_url":"https://news.example/power","original_headline":"قطع برق مدارس در کهگیلویه","source_name":"ب"},
                     {"article_url":"javascript:alert(1)","original_headline":"نفتکش هرمز","source_name":"ج"}])
        refs=source_refs(story)
        self.assertEqual([x["url"] for x in refs],["https://news.example/hormuz"])

    def test_reject_invented_citations(self):
        refs=[{"id":"s1","url":"https://news.example/real"}]
        context={"background":[]}
        paras=[{"text_fa":"این یک متن نمونهٔ نسبتا بلند برای بازنویسی مستند در چهارچوب قوانین نگارش است. "*5,
                "citation_ids":["s1"]} for _ in range(3)]
        good={"title_fa":"سپاه درباره حادثه نفتکش در تنگه هرمز گزارش داد",
              "lead_fa":"نیروی دریایی سپاه خبر وقوع رویدادی در تنگه هرمز را اعلام کرده و جزئیات آن مستقل بررسی نشده است.",
              "paragraphs":paras}
        self.assertIsNotNone(valid_report(good,refs,context))
        bad=dict(good,paragraphs=[dict(paras[0],citation_ids=["s9"])]+paras[1:])
        self.assertIsNone(valid_report(bad,refs,context))

    def test_archive_enriched_without_ai(self):
        class Mock:
            name="mock"
            def generate(self,**kw):raise AssertionError("must not call mock model")
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/"story").mkdir()
            (root/"stories.json").write_text(json.dumps([STORY],ensure_ascii=False),encoding="utf-8")
            (root/"press-source-stories.json").write_text(json.dumps({"الف":[PRIOR]},ensure_ascii=False),encoding="utf-8")
            for row in [STORY,PRIOR]:
                (root/"story"/(row["id"]+".json")).write_text(json.dumps(row,ensure_ascii=False),encoding="utf-8")
            result=build(root,provider=Mock(),cache_path="",max_generate=4)
            self.assertEqual(result["enriched"],2)
            updated=json.loads((root/"story"/(ID+".json")).read_text())
            self.assertEqual(updated["editorial_context"]["background"][0]["id"],OTHER)
            self.assertNotIn("editorial_report",updated)


if __name__ == "__main__":unittest.main()

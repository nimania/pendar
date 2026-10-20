"""Offline safeguards for the trend research and publication gates."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts import research_google_trends_iran as m


class Stub:
    def __init__(self, value):
        self.value = value
    def generate(self, **kwargs):
        class Result: pass
        r = Result()
        r.data = self.value
        return r


def example():
    return {
        "publish": True,
        "title_fa": "بررسی جزئیات این رویداد",
        "lead_fa": "جزئیات این رخداد در چند گزارش رسانه‌ای منتشر شده و منابع گوناگون به ابعاد متفاوت آن پرداخته‌اند.",
        "lead_citation_ids": ["s1"],
        "paragraphs": [
            {"text_fa": "در گزارش منتشرشده جزئیات این موضوع با دقت بررسی شده است و روایت رسانه نخست به داده‌های ارائه‌شده در گزارش خودش محدود می‌ماند.", "citation_ids": ["s1"]},
            {"text_fa": "منبع دوم به جنبه متفاوتی پرداخته است و اطلاعات آن از نظر انتساب به همان رسانه محدود می‌ماند تا رویدادی قطعی از یک جست‌وجو نتیجه نشود.", "citation_ids": ["s2"]},
            {"text_fa": "در نتیجه برای تحلیل موضوع باید میان ادعای منبع، زمینه خبر و پرسش‌های هنوز بی‌پاسخ تفاوت روشنی قائل بود و از قطعیت اضافی دوری کرد.", "citation_ids": ["s1"]},
            {"text_fa": "گزارش‌هایی که این جست‌وجو با آن‌ها همراه شده است تنها بیانگر پوشش رسانه‌هاست و این پوشش به‌خودی‌خود علت افزایش جست‌وجو را توضیح نمی‌دهد.", "citation_ids": ["s2"]},
            {"text_fa": "در جمع‌بندی دو رسانه جزئیات گوناگونی را بیان کرده‌اند و برای آگاهی دقیق‌تر لازم است متن اصلی، زمان انتشار و منبع هر گزاره در دسترس باشد.", "citation_ids": ["s1", "s2"]},
            {"text_fa": "بنابراین بررسی بعدی باید حول شواهد منتشرشده و اختلاف روایت‌ها باشد و نباید به‌جای آنها از حدس یا روایت‌های فاقد پشتوانه استفاده کند.", "citation_ids": ["s1"]}
        ]
    }


class ResearchTest(unittest.TestCase):
    def setUp(self):
        self.sources = [
            {"id": "s1", "url": "https://example.com/one", "publisher": "A", "domain": "example.com", "body": "متن"},
            {"id": "s2", "url": "https://example.org/two", "publisher": "B", "domain": "example.org", "body": "متن"},
        ]

    def test_rejects_fake_source_id(self):
        value = example()
        value["paragraphs"][0]["citation_ids"] = ["s99"]
        self.assertIsNone(m.validate_report(value, self.sources))

    def test_citations_require_independent_ids(self):
        value = example()
        value["lead_citation_ids"] = ["s1"]
        for paragraph in value["paragraphs"]:
            paragraph["citation_ids"] = ["s1"]
        self.assertIsNone(m.validate_report(value, self.sources))

    def test_safe_urls(self):
        for url in ("http://example.org", "https://127.0.0.1/private", "https://localhost/secret", "file:///etc/passwd"):
            self.assertFalse(m.safe_url(url))
        self.assertTrue(m.safe_url("https://example.org/news"))

    def test_sensitive_requires_review(self):
        brief = {"trend_keyword": "حمله آمریکا به ایران", "related_news": []}
        with patch.object(m, "sources_for", return_value=self.sources):
            result = m.research(brief, Stub(example()))
        self.assertEqual(result["research_status"], "requires_human_review")

    def test_neutral_eligible(self):
        brief = {"trend_keyword": "فوتبال", "related_news": []}
        with patch.object(m, "sources_for", return_value=self.sources):
            result = m.research(brief, Stub(example()))
        self.assertEqual(result["research_status"], "eligible_low_risk")

    def test_preserves_deduplication(self):
        brief = {"trend_keyword": "فوتبال", "related_news": []}
        old = {"research_reports": [{"id": m.stable_id("فوتبال"), "trend_keyword": "فوتبال", "research_status": "requires_human_review"}]}
        data = {"status": "ok", "briefs": [brief]}
        with patch.object(m, "research") as called:
            result = m.run(data, old, provider=None)
        called.assert_not_called()
        self.assertEqual(result["research_metrics"]["attempted"], 0)

    def test_low_source_count_no_generation(self):
        with patch.object(m, "sources_for", return_value=self.sources[:1]):
            result = m.research({"trend_keyword": "فوتبال", "related_news": []}, Stub(example()))
        self.assertEqual(result["research_status"], "insufficient_independent_fulltext")

if __name__ == "__main__":
    unittest.main()

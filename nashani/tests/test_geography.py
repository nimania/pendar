import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import geography


class KermanGeographyTests(unittest.TestCase):
    def test_all_kerman_cities_and_province(self):
        for text in (
            "شهرداری کرمان از آغاز عملیات عمرانی خبر داد",
            "در استان کرمان راه‌ها بازگشایی شدند",
            "شهرستان جیرفت گزارش خسارت داد",
            "سیرجان میزبان نمایشگاه صنایع شد",
            "رفسنجان از ساخت بیمارستان خبر داد",
            "آتش‌نشانی زرند اعلامیه صادر کرد",
            "اجرای پروژه در شهربابک آغاز شد",
            "روستاهای بم از خدمات تازه برخوردار شدند",
            "محور شهر بافت تا کرمان بازگشایی شد",
            "فرمانداری انار درباره وضعیت آب توضیح داد",
            "بازسازی محور بم و زاهدان آغاز شد",
            "جاده جیرفت به بندرعباس بهسازی می‌شود",
            "راه‌آهن کرمان یزد توسعه می‌یابد",
            "در فهرج و نرماشیر خدمات درمانی برقرار شد",
            "مس سرچشمه تولید را افزایش داد",
        ):
            with self.subTest(text=text):
                self.assertIsNotNone(geography.geo_relevance(text))

    def test_nonlocal_and_neighboring_province_only(self):
        for text in (
            "وام دانشجویی سراسر کشور اعلام شد",
            "افزایش قیمت شیر در کل کشور",
            "وزیر درباره سیاست خارجی ایران سخن گفت",
            "بندرعباس میزبان رویداد ورزشی شد",
            "سیل در استان هرمزگان رخ داد",
            "راه‌های استان یزد باز شدند",
            "استان سیستان و بلوچستان با بارش مواجه شد",
            "خبر تازه از کرمانشاه و غرب کشور",
            "شهرداری کرمانشاه پروژه‌ای افتتاح کرد",
            "بافت فرسوده تهران بازسازی شد",
            "قیمت انار در بازار تهران تغییر کرد",
            "در کرمانشاهی‌ها شور و نشاط ایجاد شد",
            "همجوار یزد، استان فارس میزبان جشنواره است",
            "",
        ):
            with self.subTest(text=text):
                self.assertIsNone(geography.geo_relevance(text))

    def test_qualified_ambiguous_names(self):
        self.assertEqual(geography.geo_relevance("شهرستان بافت بارندگی داشت"), "kerman")
        self.assertEqual(geography.geo_relevance("شهر انار پروژه افتتاح کرد"), "kerman")
        self.assertIsNone(geography.geo_relevance("انار ممتاز وارد بازار شد"))
        self.assertIsNone(geography.geo_relevance("بافت تاریخی شیراز بازسازی شد"))

    def test_source_identity_does_not_make_a_national_article_local(self):
        post = {"title": "وام عمومی دانشجویان در سراسر ایران",
                "excerpt": "آغاز ثبت‌نام برای دانشجویان تمام کشور.",
                "source": "کرمان‌نو",
                "source_handle": "kermane_no"}
        self.assertIsNone(geography.is_local_news(post))

    def test_all_sources_have_strict_gate(self):
        config = json.loads((Path(__file__).resolve().parents[1] / "sources.json").read_text(encoding="utf-8"))
        self.assertEqual(len(config["sources"]), 8)
        self.assertTrue(all(row.get("geography_filter") == "strict" for row in config["sources"]))
        self.assertTrue(all(row.get("coverage") == "kerman_geography" for row in config["sources"]))


if __name__ == "__main__":
    unittest.main()

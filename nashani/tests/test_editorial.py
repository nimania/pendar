import sys
import unittest
from pathlib import Path

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import editorial


class EditorialTests(unittest.TestCase):
    def test_photo_from_public_telegram_preview(self):
        html = """<div class="tgme_widget_message" data-post="kermane_no/51">
        <a class="tgme_widget_message_photo_wrap"
           style="background-image: url('https://cdn4.telesco.pe/file/abc.jpg')"></a>
        </div>"""
        post = BeautifulSoup(html, "html.parser")
        self.assertEqual(editorial.extract_media(post),
                         {"kind": "photo", "url": "https://cdn4.telesco.pe/file/abc.jpg"})

    def test_video_from_public_telegram_preview(self):
        html = """<div class="tgme_widget_message" data-post="kermane_no/52">
        <div class="tgme_widget_message_video_player">
          <video src="https://cdn1.telesco.pe/file/clip.mp4"></video>
        </div></div>"""
        post = BeautifulSoup(html, "html.parser")
        self.assertEqual(editorial.extract_media(post)["kind"], "video")

    def test_arbitrary_external_media_rejected(self):
        self.assertFalse(editorial.media_url_allowed("http://localhost/secret.png"))
        self.assertFalse(editorial.media_url_allowed("https://telesco.pe.attacker.org/unsafe.jpg"))
        self.assertFalse(editorial.media_url_allowed("file:///private/clip.mp4"))
        self.assertFalse(editorial.media_url_allowed("https://example.com/photo.jpg"))

    def test_caption_has_visual_heading_and_2_clean_bullets(self):
        item = {
            "title": "🔶 درخواست اختصاص ۲۰ میلیارد تومان برای رادیو شهری جیرفت",
            "paragraphs": [
                "🔶 درخواست اختصاص ۲۰ میلیارد تومان برای رادیو شهری جیرفت",
                "🔹 نماینده جیرفت و عنبرآباد در مجلس خواستار اختصاص اعتبار شد.",
                "🔹 او بر تکمیل استخر نیمه‌تمام این شهرستان هم تأکید کرد.",
                "🔺 ادامه خبر https://t.me/kermane_no/58",
                "@kermane_no",
            ],
            "source": "کرمان‌نو",
        }
        rendered = editorial.compose_caption(item)
        self.assertTrue(rendered.startswith("🔶 <b>"))
        self.assertIn("🔹 به گزارش کرمان نو، نماینده", rendered)
        self.assertIn("🔹 او بر تکمیل", rendered)
        self.assertNotIn("https://", rendered)
        self.assertNotIn("@kermane_no", rendered)
        self.assertNotIn("…", rendered)
        self.assertLessEqual(len(rendered), editorial.MAX_CAPTION)

    def test_all_outlets_receive_source_name_hashtags(self):
        examples = [
            ("کرمان‌نو", "کرمان_نو", "#کرمان_نو"),
            ("اخبار کرمان", "اخبار_کرمان", "#اخبار_کرمان"),
            ("qh_qv", "qh_qv", "#qh_qv"),
            ("فردای کرمان", None, "#فردای_کرمان"),
            ("ایرنا کرمان", None, "#ایرنا_کرمان"),
        ]
        for name, explicit, hashtag in examples:
            with self.subTest(outlet=name):
                item = {
                    "title": "شهرداری کرمان طرح جدید را اعلام کرد",
                    "paragraphs": ["شورای شهر کرمان امروز طرح جدید را تصویب کرد."],
                    "source": name,
                }
                if explicit:
                    item["source_hashtag"] = explicit
                caption = editorial.compose_caption(item)
                self.assertIn(hashtag, caption)
                self.assertIn("به گزارش ", caption)
                self.assertNotIn("https://", caption)

    def test_persian_source_hashtag_with_punctuation(self):
        self.assertEqual(
            editorial.source_hashtag({"source": "کرمان‌نو / خبر"}),
            "#کرمان_نو_خبر",
        )

    def test_long_sentence_not_cut_midway(self):
        item = {
            "title": "خبر تازه درباره شهر کرمان",
            "paragraphs": ["خبر تازه درباره شهر کرمان",
                           "مدیر مسئول اعلام کرد که برنامه افزایش خدمات شهری آغاز شده است. "
                           "پس از آن اطلاع‌رسانی بیشتری در اختیار شهروندان قرار خواهد گرفت."],
            "source": "فردای کرمان",
        }
        rendered = editorial.compose_caption(item)
        self.assertTrue("آغاز شده است." in rendered)
        self.assertFalse(rendered.endswith("…"))

    def test_promotional_footers_removed(self):
        self.assertEqual(editorial.clean_news_line("🔺 ادامه خبر: https://example.com/x"), "")
        self.assertEqual(editorial.clean_news_line("🔹 شهرداری کرمان برنامه تازه‌ای اعلام کرد"),
                         "شهرداری کرمان برنامه تازه‌ای اعلام کرد")


if __name__ == "__main__":
    unittest.main()

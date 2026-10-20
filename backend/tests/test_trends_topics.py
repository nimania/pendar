"""Regression coverage for typed monitored topics, typo filtering and photo provenance."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))

from trends_topics import classify,clean_title,write_context_page,canonical_label,related_people
from trends_media import select_photo,verify_and_install
from trends_magazine import credited_photo

class TrendTopicsTests(unittest.TestCase):
    def test_isolated_typo_only(self):
        self.assertEqual(clean_title("ط طرح های جدید تامین اجتماعی"),"طرح های جدید تامین اجتماعی")
        self.assertEqual(clean_title("طرح های ط جدید تامین اجتماعی"),"طرح های جدید تامین اجتماعی")
        self.assertEqual(clean_title("وضعیت طهران و تهران"),"وضعیت طهران و تهران")
        self.assertEqual(clean_title("مناطق و شهرها"),"مناطق و شهرها")

    def test_ahmadinejad_alias(self):
        with tempfile.TemporaryDirectory() as site:
            item=classify(site,"محمود احمدینژاد",{})
            self.assertEqual(item["kind"],"person")
            self.assertEqual(item["name"],"محمود احمدی‌نژاد")
            self.assertEqual(item["url"],"/@mahmoud-ahmadinejad/")

    def test_classification(self):
        with tempfile.TemporaryDirectory() as site:
            self.assertEqual(classify(site,"عراق",{})["url"],"/places/country/iraq/")
            self.assertEqual(classify(site,"تهران",{})["kind"],"province")
            self.assertEqual(classify(site,"رامین راستاد",{})["kind"],"person")
            self.assertEqual(classify(site,"حمله آمریکا به ایران",{})["kind"],"event")

    def test_existing_person_profile_preferred(self):
        index={"رامین راستاد":{"handle":"existing-ramin","name_fa":"رامین راستاد"}}
        with tempfile.TemporaryDirectory() as site:
            person=classify(site,"رامین راستاد",index)
            self.assertEqual(person["url"],"/@existing-ramin/")
            self.assertTrue(person["existing"])

    def test_context_page_without_fake_photo(self):
        with tempfile.TemporaryDirectory() as site:
            p=classify(site,"احمد آرام",{})
            write_context_page(site,p)
            page=Path(site)/"@ahmad-aram"/"index.html"
            self.assertTrue(page.is_file())
            html=page.read_text(encoding="utf-8")
            self.assertIn("noindex,follow",html)
            self.assertIn("Q5956408",html)
            self.assertNotIn("og:image",html)

    def test_photo_catalog_is_precise(self):
        self.assertEqual(select_photo("پیش‌فروش بلیت قطار")["id"],"tehran-railway")
        self.assertEqual(select_photo("سرخیو راموس در ختافه")["id"],"sergio-ramos")
        self.assertEqual(select_photo("طرح‌های جدید تامین اجتماعی")["id"],"social-security")
        self.assertIsNone(select_photo("عملیات نظامی در عراق"))
        self.assertIsNone(credited_photo({"image_url":"/assets/trends/photos/unknown.webp","image_credit":"No"}))

if __name__=="__main__":unittest.main()

"""Regression checks for identity, durable covers and honest commerce merging."""
import copy
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1] / 'scripts'
sys.path.insert(0, str(SCRIPTS))
from book_catalog import apply_curation, discovery_links
from enrich_books_torob import _choose_product


class BookCatalogTests(unittest.TestCase):
    def test_same_title_needs_an_identity_hint(self):
        book = {'title_fa': 'زیتون و انجیر', 'creators': [{'name_fa': 'توماس مان'}, {'name_fa': 'محمود حدادی'}]}
        wrong = {'name_fa': 'کتاب زیتون و انجیر نویسنده دیگری', 'available': True}
        correct = {'name_fa': 'زیتون و انجیر ترجمه محمود حدادی'}
        self.assertIsNone(_choose_product(book, [wrong]))
        self.assertEqual(_choose_product(book, [wrong, correct]), correct)

    def test_creator_cannot_rescue_wrong_title(self):
        self.assertIsNone(_choose_product({'title_fa': 'ملال گریز', 'creators': [{'name_fa': 'حمیدرضا پیشوایی'}]}, [{'name_fa': 'ملال نویسنده حمیدرضا پیشوایی'}]))

    def test_curation_wins_over_cached_watermarked_cover(self):
        book = {'slug': 'namehaye-irani', 'title_fa': 'نامه‌های ایرانی', 'cover_url': 'assets/books/namehaye-irani.jpg'}
        apply_curation(book)
        self.assertTrue(book['cover']['verified_clean'])
        self.assertEqual(book['cover_url'], 'assets/books/namehaye-irani-clean-v2.jpg')

    def test_discovery_does_not_claim_inventory(self):
        links = discovery_links({'title_fa': 'عنوان تست'})
        self.assertEqual(len(links), 7)
        self.assertTrue(all(not l['exact'] and l['price'] is None and l['availability'] == 'unknown' for l in links))

    def test_dedupe_keeps_distinct_formats_and_rejects_unsafe_urls(self):
        book = {'title_fa': 'کتاب', 'purchase_links': [{'store': 'ف', 'url': 'https://example.org/ebook', 'format': 'ebook', 'exact': True}, {'store': 'ف', 'url': 'https://example.org/audio', 'format': 'audio', 'exact': True}, {'url': 'javascript:alert(1)', 'exact': True}]}
        apply_curation(book, {})
        apply_curation(book, {})
        self.assertEqual(len(book['purchase_links']), 2)

    def test_new_price_does_not_redate_old_seller_snapshot(self):
        # Price summary is refreshed, but seller list can only retain its own date.
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            source = {'books': [{'slug': 'namehaye-irani', 'torob': {'matched': True, 'checked_at': '2026-10-04', 'offers_checked_at': '2026-10-01', 'price_toman': 200, 'offers': [{'shop_name': 'الف', 'price_toman': 100}]}}]}
            target = {'books': [{'slug': 'namehaye-irani', 'title_fa': 'نامه‌های ایرانی', 'torob': {'matched': True, 'checked_at': '2026-10-03', 'price_toman': 150}}]}
            for name, data in [('source', source), ('target', target)]:
                (root / name).write_text(json.dumps(data))
            subprocess.run([sys.executable, str(SCRIPTS / 'merge_book_commerce.py'), '--source', str(root / 'source'), '--target', str(root / 'target')], check=True, capture_output=True)
            result = json.loads((root / 'target').read_text())['books'][0]
            self.assertEqual(result['torob']['price_toman'], 200)
            self.assertEqual(result['torob']['offers_checked_at'], '2026-10-01')
            self.assertTrue(result['cover']['verified_clean'])


if __name__ == '__main__':
    unittest.main()

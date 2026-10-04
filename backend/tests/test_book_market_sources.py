"""Verify upstream error envelopes and avoid false edition/price claims."""
import json
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from book_market_sources import decode_rpc, digikala, fidibo, classified_group, classified_batches, classified_details
from collect_book_radar import collect


class MarketSourcesTests(unittest.TestCase):
    source = {'id': 's', 'name_fa': 'فروشگاه', 'url': 'https://fidibo.com/ebooks'}

    def test_json_and_sse_mcp_errors_do_not_become_empty_success(self):
        value = {'result': {'content': [{'type': 'text', 'text': '{"items":[]}'}]}}
        self.assertEqual(decode_rpc(json.dumps(value)), {'items': []})
        self.assertEqual(decode_rpc('event: message\ndata: '+json.dumps(value)+'\n\n'), {'items': []})
        for response in ({'error': {'code': -1}}, {'result': {'isError': True}}):
            with self.assertRaises(ValueError):
                decode_rpc(json.dumps(response))

    def test_digikala_separates_author_translator_publisher_and_excludes_bundle(self):
        card = {'title': 'کتاب زندگی اثر نویسنده ترجمه مترجم نشر ناشر', 'url': 'https://www.digikala.com/product/dkp-1/name', 'price_toman': 230000, 'in_stock': False}
        bundle = dict(card, title='مجموعه کتاب زندگی اثر نویسنده 3 جلدی')
        rows = digikala({'bestseller': {'query_used': 'کتاب', 'items': [card, bundle]}}, self.source)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['author'], 'نویسنده')
        self.assertEqual(rows[0]['creators'][1]['role_fa'], 'مترجم')
        self.assertEqual(rows[0]['publisher']['name_fa'], 'ناشر')
        self.assertEqual(rows[0]['currency'], 'IRT')
        self.assertEqual(rows[0]['availability'], 'out_of_stock')
        self.assertEqual(rows[0]['cover_url'], '')
        card['title'] = 'کتاب زندگی اثر نویسنده ترجمۀ مترجم نشر ناشر'
        self.assertEqual(digikala({'bestseller': {'query_used': 'کتاب', 'items': [card]}}, self.source)[0]['author'], 'نویسنده')

    def test_fidibo_narrator_subtitle_is_not_used_as_author(self):
        b = {'title': 'اثر', 'subtitle': 'نویسنده', 'narrator': 'گوینده', 'content_type': 'audiobook', 'action': {'web_url': '/book/1-name'}, 'footerText': 'نام مترجم', 'footerTextAction': {'web_url': '/publishers/1-ناشر'}}
        context = {'list': [{'component': 'HL_BOOKS_FULL', 'title': 'تازه‌های متنی', 'items': [b, dict(b, subtitle='گوینده')]}]}
        rows = fidibo('<script>window.homeContext = '+json.dumps(context)+'; window.isSSR=true;</script>', self.source)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['author'], 'نویسنده')
        self.assertEqual(rows[0]['publisher']['name_fa'], 'ناشر')
        self.assertEqual(rows[0]['creators'][1]['role_fa'], 'گوینده')

    def test_divar_placeholder_negotiable_and_missing_prices_never_compare(self):
        card = {'token': 'abc', 'url': 'https://divar.ir/v/abc', 'title': 'کتاب', 'price_toman': 200000, 'city': 'تهران'}
        data = {'items': [card, dict(card, price_is_placeholder=True), dict(card, negotiable=True), dict(card, price_toman=None)]}
        group = classified_group(data, 'کتاب', datetime.now(timezone.utc))
        self.assertEqual([r['asking_price_toman'] for r in group['items']], [200000, None, None, None])
        self.assertTrue(all(r['condition'] == 'unknown' for r in group['items']))
        with self.assertRaises(ValueError):
            classified_group({'filters_not_applied': {'category': 'book'}, 'items': []}, 'کتاب', datetime.now(timezone.utc))

    def test_divar_loosely_related_service_results_are_excluded(self):
        data = {'items': [{'url': 'https://divar.ir/v/abc', 'title': 'کتابخانه شخصی خرید و فروش در منزل', 'price_toman': 1000000000}, {'url': 'https://divar.ir/v/def', 'title': 'کتاب های رمان قدیمی', 'price_toman': 200000}]}
        group = classified_group(data, 'رمان', datetime.now(timezone.utc))
        self.assertEqual(len(group['items']), 1)
        self.assertEqual(group['items'][0]['title_fa'], 'کتاب های رمان قدیمی')

    def test_national_search_batches_and_partial_failure_keep_original_dates(self):
        now = datetime(2026, 10, 4, 8, tzinfo=timezone.utc)
        previous_date = '2026-10-03T08:00:00+00:00'
        calls = []
        class Client:
            def call(self, name, args):
                calls.append(args['cities'])
                if args['cities'] == ['5']:
                    raise ValueError('offline')
                return {'items': []}
        previous = {'groups': [{'query': 'رمان', 'batches': [{'cities': ['5'], 'observed_at': previous_date, 'items': [{'url': 'https://divar.ir/v/old', 'observed_at': previous_date}]}]}]}
        groups, failures = classified_batches(Client(), ['رمان'], [str(i) for i in range(6)], now, previous)
        self.assertEqual([len(c) for c in calls], [5, 1])
        self.assertEqual(failures, 1)
        self.assertEqual(groups[0]['items'][0]['observed_at'], previous_date)
        with self.assertRaises(ValueError):
            classified_group({'unknown_cities': ['unknown']}, 'رمان', now)

    def test_preview_keeps_only_official_images_and_no_contact_or_coordinates(self):
        value = {'url': 'https://divar.ir/v/abc', 'title': 'رمان', 'description': 'شرح', 'images': ['https://s100.divarcdn.com/a.webp', 'https://evil.test/x'], 'contact': 'private', 'location': [35, 51]}
        row = classified_details(value, datetime.now(timezone.utc))
        self.assertEqual(row['images'], ['https://s100.divarcdn.com/a.webp'])
        self.assertNotIn('contact', row)
        self.assertNotIn('location', row)

    def test_classifieds_never_create_books_or_scores_and_failure_preserves_date(self):
        import tempfile
        now = datetime(2026, 10, 4, 8, tzinfo=timezone.utc)
        old = '2026-10-03T08:00:00+00:00'
        payload = {'books': [], 'radar': {'classifieds': {'observed_at': old, 'groups': []}}}
        source = {'id': 'divar', 'name_fa': 'دیوار', 'adapter': 'divar', 'kind': 'classifieds', 'url': 'https://divar.ir', 'endpoint': 'unused', 'cities': ['tehran'], 'queries': ['رمان']}
        with tempfile.NamedTemporaryFile(mode='w+') as f:
            json.dump({'رمان': {'items': [{'url': 'https://divar.ir/v/abc', 'title': 'رمان', 'price_toman': 123}]}}, f); f.flush()
            collect(payload, {'sources': [source]}, now=now, local={'divar': f.name})
            self.assertEqual(payload['books'], [])
            self.assertEqual(payload['radar']['history'], [])
            date = payload['radar']['classifieds']['observed_at']
            f.seek(0); f.truncate(); f.write('invalid'); f.flush()
            collect(payload, {'sources': [source]}, now=now, local={'divar': f.name})
            self.assertEqual(payload['radar']['sources'][0]['status'], 'unavailable')
            self.assertEqual(payload['radar']['classifieds']['observed_at'], date)


if __name__ == '__main__':
    unittest.main()

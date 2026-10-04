"""Evidence/identity/freshness tests, independent of store availability."""
import copy
import json
import sys
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from book_radar import identity, daily_history, indicators, attach_radar, person_profile_allowed


class RadarTests(unittest.TestCase):
    now = datetime(2026, 10, 4, 8, tzinfo=timezone.utc)

    def row(self, **kwargs):
        return dict(slug='b', source_id='s', source_name='فروشگاه', kind='bestseller', format='ebook', position=4, observed_at=self.now.isoformat(), **kwargs)

    def test_title_requires_same_author(self):
        self.assertNotEqual(identity('یک عنوان', 'الف'), identity('یک عنوان', 'ب'))
        self.assertEqual(identity('كتاب يك', 'نام'), identity('کتاب یک', 'نام'))

    def test_existing_person_page_exclusions_apply_to_creators(self):
        for name in ('سید علی خامنه‌ای', 'سیدعلی خامنه ای', 'روح‌الله خمینی', 'رضا پهلوی'):
            self.assertFalse(person_profile_allowed(name))
        self.assertTrue(person_profile_allowed('حسین مسرور'))

    def test_repeated_collection_cannot_create_growth(self):
        earlier = self.row(); earlier['observed_at'] = (self.now-timedelta(hours=1)).isoformat()
        rows = daily_history([earlier], [self.row()], self.now)
        self.assertEqual(len(rows), 1)
        self.assertEqual(indicators('b', rows, self.now)['weekly_changes'], [])

    def test_audio_and_ebook_do_not_double_provider_weight(self):
        a = self.row(); b = self.row(); b['format'] = 'audio'
        one = indicators('b', [a], self.now)
        two = indicators('b', [a, b], self.now)
        self.assertEqual(one['score'], two['score'])
        self.assertEqual(two['source_count'], 1)

    def test_only_comparable_weekly_list_positions_count(self):
        old = self.row(); old.update(position=9, observed_at=(self.now-timedelta(days=7)).isoformat())
        changes = indicators('b', [old, self.row()], self.now)['weekly_changes']
        self.assertEqual(changes[0]['change'], 5)
        old['source_id'] = 'other'
        self.assertEqual(indicators('b', [old, self.row()], self.now)['weekly_changes'], [])

    def test_stale_or_future_snapshot_cannot_score(self):
        old = self.row(); old['observed_at'] = (self.now-timedelta(days=3)).isoformat()
        future = self.row(); future['observed_at'] = (self.now+timedelta(days=1)).isoformat()
        self.assertEqual(indicators('b', [old], self.now)['score'], 0)
        self.assertEqual(daily_history([], [future], self.now), [])

    def test_news_rebuild_keeps_independent_books_and_graph(self):
        source = {'radar': {'updated_at': self.now.isoformat()}, 'books': [{'slug': 'r', 'radar': {'score': 3}, 'title_fa': 'کشف', 'creators': [{'slug': 'a', 'name_fa': 'نویسنده', 'role_fa': 'نویسنده'}], 'editions': [{'publisher': {'slug': 'p', 'name_fa': 'ناشر'}}]}]}
        target = {'books': [{'slug': 'manual', 'title_fa': 'جلد تمیز', 'cover_url': 'assets/books/clean.jpg'}]}
        attach_radar(target, source); attach_radar(target, source)
        self.assertEqual(len(target['books']), 2)
        self.assertEqual(target['books'][0]['cover_url'], 'assets/books/clean.jpg')
        self.assertEqual(target['people'][0]['book_slugs'], ['r'])
        self.assertEqual(target['publishers'][0]['book_slugs'], ['r'])


if __name__ == '__main__':
    unittest.main()

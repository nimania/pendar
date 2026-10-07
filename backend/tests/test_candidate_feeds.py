import importlib.util
from pathlib import Path
import unittest
from datetime import datetime, timezone

spec = importlib.util.spec_from_file_location('feeds', Path(__file__).resolve().parents[1] / 'scripts/collect_candidate_feeds.py')
feeds = importlib.util.module_from_spec(spec); spec.loader.exec_module(feeds)

class CandidateFeedsTests(unittest.TestCase):
    def test_translation_cache_and_original_headline(self):
        class Provider:
            calls = 0
            def generate(self, **kwargs):
                self.calls += 1
                return type('Result', (), {'data': {'titles': [{'id': 0, 'title_fa': 'مارشال دربارهٔ تعرفه‌ها سخن گفت'}]}})()
        provider = Provider()
        people = {'marshall': {'news': [{'title': 'Marshall discusses tariffs'}], 'official': []}}
        feeds.translate_titles(people, provider)
        row = people['marshall']['news'][0]
        self.assertEqual(row['title_original'], 'Marshall discusses tariffs')
        self.assertEqual(row['title_fa'], 'مارشال دربارهٔ تعرفه‌ها سخن گفت')
        feeds.translate_titles(people, provider)
        self.assertEqual(provider.calls, 1)
        merged = feeds.merge_rows([dict(row, id='1', published_at=datetime.now(timezone.utc).isoformat())], [dict(row, id='1', published_at=datetime.now(timezone.utc).isoformat())])
        self.assertEqual(merged[0]['title_fa'], row['title_fa'])

    def test_full_name_and_context(self):
        p = {'aliases': ['Mike Rogers'], 'context': ['Michigan'], 'require_context': True}
        self.assertTrue(feeds.matches('Michigan Senate candidate Mike Rogers', p))
        self.assertFalse(feeds.matches('Alabama Congressman Mike Rogers', p))
        self.assertFalse(feeds.matches('Michigan candidate Mike Rogersson', p))

    def test_invalid_dates_and_unsafe_links_are_excluded(self):
        p = {'aliases': ['Roy Cooper']}
        body = '<rss><channel><item><title>Roy Cooper</title><link>javascript:alert(1)</link><pubDate>Wed, 07 Oct 2026 12:00:00 GMT</pubDate></item><item><title>Roy Cooper</title><link>https://example.com/a</link><pubDate>bad</pubDate></item></channel></rss>'
        self.assertEqual(feeds.parse_feed(body, p), [])

    def test_failed_refresh_keeps_original_timestamp_and_deduplicates(self):
        now = datetime.now(timezone.utc).isoformat()
        old = {'id': '1', 'title': 'Roy Cooper speech - AP', 'published_at': now}
        duplicate = {'id': '2', 'title': 'Roy Cooper speech - Another outlet', 'published_at': now}
        self.assertEqual(feeds.merge_rows([old], []), [old])
        self.assertEqual(len(feeds.merge_rows([old], [duplicate])), 1)

    def test_official_atom_is_not_a_news_mention(self):
        body = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>A message to voters</title><link href="https://youtube.com/watch?v=test"/><published>2026-10-07T12:00:00Z</published></entry></feed>'
        p = {'aliases': ['Roy Cooper']}
        self.assertEqual(feeds.parse_feed(body, p), [])
        self.assertEqual(feeds.parse_feed(body, p, True)[0]['kind'], 'official')

if __name__ == '__main__': unittest.main()

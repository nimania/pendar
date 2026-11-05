import unittest
from datetime import datetime, timezone
from unittest.mock import patch

from bs4 import BeautifulSoup

from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from web_sources import (
    article_excerpt, get_html, is_allowed_article, jalali_to_gregorian,
    parse_article_time, published_at, website_posts,
)
import runner


class WebsiteDateTests(unittest.TestCase):
    def test_known_jalali_date_conversion(self):
        self.assertEqual(jalali_to_gregorian(1405, 8, 7), (2026, 10, 29))
        self.assertEqual(jalali_to_gregorian(1405, 8, 14), (2026, 11, 5))
        self.assertEqual(parse_article_time("7 آبان 1405 19:05").isoformat(),
                         "2026-10-29T15:35:00+00:00")
        self.assertEqual(parse_article_time("۱۳ آبان ۱۴۰۵ ۲۲:۴۰").isoformat(),
                         "2026-11-04T19:10:00+00:00")

    def test_requires_article_level_timestamp_not_listing_clock(self):
        page = BeautifulSoup("""
          <html><header>پنج شنبه 14 آبان 1405 15:51</header>
          <article><h1>شهرداری کرمان گزارشی منتشر کرد</h1>
          <p>این یک خبر بدون تاریخ اختصاصی است.</p></article></html>
        """, "html.parser")
        self.assertIsNone(published_at(page))

    def test_kerna_article_header_date_is_found_not_global_clock(self):
        page = BeautifulSoup("""
          <header>پنج شنبه 14 آبان 1405 15:51</header>
          <main><section><div>شماره خبر: 9613758 7 آبان 1405 19:05
          <h1>خبر کرمان درباره نشست شهری</h1>
          <div class="news-content"><p>خبر درباره اجرای طرح شهری در کرمان
          و بهسازی خیابان‌های شهر کرمان در هفته جاری است.</p></div>
          </div></section></main>
        """, "html.parser")
        self.assertEqual(published_at(page).isoformat(), "2026-10-29T15:35:00+00:00")

    def test_article_iso_time_and_old_news_filtered(self):
        listing = BeautifulSoup("""
          <a href="/News/street/36407">خبر تازه شهر کرمان</a>
          <a href="https://outside.example.com/News/false">تبلیغ</a>
        """, "html.parser")
        article = BeautifulSoup("""
          <meta property="article:published_time" content="2026-10-29T19:05:00+03:30">
          <h1>خبر درباره خیابان‌های کرمان</h1>
          <div class="news-content"><p>شهرداری کرمان امروز گزارشی از بهسازی معابر
          شهری کرمان و پروژه‌های عمرانی در شهر کرمان منتشر کرده است.</p></div>
        """, "html.parser")
        source = {"name": "کرنا", "handle": "web_kerna",
                  "url": "https://kerna.ir/"}
        with patch("web_sources.get_html", side_effect=[listing, article]) as fetch:
            posts = website_posts(source, max_articles=1)
        self.assertEqual(len(posts), 1)
        self.assertEqual(fetch.call_count, 2)
        self.assertEqual(posts[0]["media"], None)
        now = datetime(2026, 11, 5, 16, 0, tzinfo=timezone.utc)
        self.assertIsNone(runner.evaluate(dict(posts[0]), now, source))

    def test_undated_article_is_not_ingested(self):
        listing = BeautifulSoup("<a href='/News/undated/123'>خبر بدون تاریخ</a>", "html.parser")
        article = BeautifulSoup("""
          <header>پنج شنبه 14 آبان 1405 20:00</header>
          <article><h1>بازسازی خیابان‌های کرمان</h1>
          <p>شهرداری کرمان از بازسازی معابر شهر کرمان خبر داده است.</p></article>
        """, "html.parser")
        with patch("web_sources.get_html", side_effect=[listing, article]):
            posts = website_posts({"url": "https://kerna.ir/",
                                   "name": "کرنا", "handle": "web_kerna"})
        self.assertEqual(posts, [])

    def test_approved_article_paths_only(self):
        self.assertTrue(is_allowed_article("https://kerna.ir/News/news/1"))
        self.assertTrue(is_allowed_article("https://www.irib-news.ir/fa/news/123"))
        self.assertFalse(is_allowed_article("https://evil.example/News/1"))
        self.assertFalse(is_allowed_article("http://kerna.ir/News/1"))
        self.assertFalse(is_allowed_article("https://kerna.ir/contact"))


if __name__ == "__main__":
    unittest.main()

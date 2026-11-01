import copy
import unittest
from backend.scripts.simorgh_intake import update, approved

CANDIDATE = {
    "id": "abcdef0123456789abcd",
    "source_id": "simorghdata369",
    "source_kind": "public_telegram_preview",
    "url": "https://t.me/simorghdata369/22",
    "status": "unverified_candidate",
    "published": "2026-11-01T14:00:00Z",
    "title": "خبر مرتبط با ایران و هرمز",
    "excerpt": "این متن نمونه صرفاً برای آزمایش استخراج یک سرنخ خبری مرتبط با ایران است که نیاز به بررسی مستقل و تطبیق با منبع اصلی دارد."
}
EMPTY = {"version": 1, "leads": []}


class SimorghIntakeTests(unittest.TestCase):
    def test_unverified_remains_pending(self):
        result = update(EMPTY, [CANDIDATE], observed_at="2026-11-02T00:00:00Z")
        self.assertEqual(len(result["leads"]), 1)
        lead = result["leads"][0]
        self.assertEqual(lead["review_status"], "pending")
        self.assertFalse(approved(lead))

    def test_poll_preserves_editor_changes(self):
        first = update(EMPTY, [CANDIDATE], observed_at="2026-11-02T00:00:00Z")
        first["leads"][0]["review_status"] = "rejected"
        second = update(first, [CANDIDATE], observed_at="2026-11-03T00:00:00Z")
        self.assertEqual(second["leads"][0]["review_status"], "rejected")

    def test_source_spoofing_discarded(self):
        bad = copy.deepcopy(CANDIDATE)
        bad["url"] = "https://t.me/another/22"
        self.assertEqual(update(EMPTY, [bad])["leads"], [])

    def test_approval_requires_independent_source(self):
        row = update(EMPTY, [CANDIDATE])["leads"][0]
        row.update(review_status="approved", reviewed_by="desk",
                   approved_at="2026-11-02T12:00:00Z",
                   approved_headline_fa="عنوان خبری مستقل درباره رویداد مرتبط با ایران",
                   approved_summary_fa="این روایت تأییدشده از رویداد پس از بررسی سند اولیه تهیه شده و فقط اطلاعات تأییدشده را به خواننده ارائه می‌کند.",
                   why_it_matters_fa="این رویداد بر سیاست منطقه‌ای و وضعیت فعلی ایران اثر مهمی دارد.",
                   independent_sources=[{"source_name": "منبع رسمی",
                                         "article_url": "https://example.org/report"}])
        self.assertTrue(approved(row))
        row["independent_sources"][0]["article_url"] = "https://t.me/simorghdata369/22"
        self.assertFalse(approved(row))


if __name__ == "__main__":
    unittest.main()

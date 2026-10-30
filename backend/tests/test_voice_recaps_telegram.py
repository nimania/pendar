"""Publisher uses deployed reports and a persisted ledger, never reposting old pages."""
import copy
from datetime import datetime, timedelta, timezone
import unittest

from backend.scripts.publish_voice_recaps_telegram import (
    valid_reports, message, deliver, payload, DeliveryUncertain, MAX_MESSAGE
)


class FakeLedger:
    def __init__(self):
        self.state=None
        self.writes=[]
    def load(self):
        return self.state
    def save(self,state):
        self.state=copy.deepcopy(state)
        self.writes.append(copy.deepcopy(state))


class FakeTelegram:
    def __init__(self, uncertain=False):
        self.calls=[]
        self.uncertain=uncertain
    def call(self,method,data):
        self.calls.append((method,data))
        if self.uncertain:
            raise DeliveryUncertain("ambiguous API response")
        return {"message_id":len(self.calls)}


class VoiceTelegramTests(unittest.TestCase):
    def setUp(self):
        self.now=datetime(2026,10,30,13,50,tzinfo=timezone.utc)
        self.news=self.example("99629-news","news")
        self.opinions=self.example("99629-opinions","opinions")

    def example(self,uid,kind):
        return {"id":uid, "kind":kind,"url":f"/reports/voices/{uid}/",
                "generated_at":self.now.isoformat(),"window_end":self.now.isoformat(),
                "window_start":(self.now-timedelta(hours=5)).isoformat(),
                "title_fa":"متن گزارش و تحول تازهٔ ایران",
                "lead_fa":"این خلاصه از اظهارنظرهای منتشرشده در طول پنج ساعت گذشته گردآوری شده و مواضع گویندگان را با احتیاط بازتاب می‌دهد.",
                "author_name":"دبیر نمونه","author_handle":"sample-author",
                "sources":[{"person":"گوینده","source_id":"s1"}],
                "paragraphs":[{"text_fa":"توضیح مفصل و مستند درباره تحول تازهٔ منطقه و مواضع مطرح‌شده در آن."} for _ in range(3)]}

    def test_both_types_only_if_recent_and_valid(self):
        data={"reports":[self.news,self.opinions]}
        self.assertEqual([x["id"] for x in valid_reports(data,self.now)],
                         ["99629-news","99629-opinions"])
        stale=copy.deepcopy(self.news)
        stale["generated_at"]=(self.now-timedelta(hours=16)).isoformat()
        self.assertEqual(valid_reports({"reports":[stale]},self.now),[])
        wrong=copy.deepcopy(self.news)
        wrong["url"]="/news/archive/"
        self.assertEqual(valid_reports({"reports":[wrong]},self.now),[])

    def test_actual_messages_link_to_full_report_and_writer(self):
        text=message(self.news)
        self.assertIn("https://pendar.io/reports/voices/99629-news/",text)
        self.assertIn("https://pendar.io/@sample-author/",text)
        self.assertIn("ری‌کپ پنج‌ساعتهٔ خبرها",text)
        self.assertIn("\n",text)
        self.assertLessEqual(len(text),MAX_MESSAGE)
        self.assertEqual(payload(self.news,"@pendario")["parse_mode"],"HTML")

    def test_sends_two_then_never_repeats(self):
        ledger,bot=FakeLedger(),FakeTelegram()
        data={"reports":[self.news,self.opinions]}
        self.assertEqual(deliver(data,ledger,bot,"@pendario",now=self.now),
                         ["99629-news","99629-opinions"])
        self.assertEqual(len(bot.calls),2)
        self.assertEqual(deliver(data,ledger,bot,"@pendario",now=self.now),[])
        self.assertEqual(len(bot.calls),2)
        self.assertTrue(all(ledger.state["messages"][key]["status"]=="sent"
                            for key in ("99629-news","99629-opinions")))

    def test_uncertain_delivery_is_never_sent_twice(self):
        ledger,bot=FakeLedger(),FakeTelegram(uncertain=True)
        with self.assertRaises(DeliveryUncertain):
            deliver({"reports":[self.news]},ledger,bot,"@pendario",now=self.now)
        self.assertEqual(ledger.state["messages"]["99629-news"]["status"],"sending")
        self.assertEqual(deliver({"reports":[self.news]},ledger,bot,"@pendario",now=self.now),[])
        self.assertEqual(len(bot.calls),1)

    def test_invalid_report_and_changed_channel_rejected(self):
        with self.assertRaises(ValueError):
            valid_reports({"wrong":[]},self.now)
        ledger=FakeLedger()
        ledger.state={"version":1,"channel":"@another","messages":{}}
        with self.assertRaises(ValueError):
            deliver({"reports":[self.news]},ledger,FakeTelegram(),"@pendario",now=self.now)

if __name__=="__main__":
    unittest.main()

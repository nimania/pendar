from __future__ import annotations
from datetime import datetime, timezone, timedelta
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from publish_iran_radar_live import get_endpoint,selected_signals

class LivePublisherTests(unittest.TestCase):
    def test_https_origin_only(self):
        self.assertEqual(get_endpoint("https://radar.example.org"),"https://radar.example.org/v1/ingest")
        for bad in ["http://a.test","https://user:pass@example.org","https://example.org/private","", "javascript:evil"]:
            with self.assertRaises(ValueError):
                get_endpoint(bad)

    def test_only_sourced_recent_auto_signals_are_sent(self):
        now=datetime(2026,10,17,tzinfo=timezone.utc)
        recent=int(now.timestamp()*1000)
        source=[{"label":"مطلب","kind":"original","url":"https://news.example.org/one"}]
        signal={"id":"auto-123", "by":"pendar-auto","family":"war",
                "ts":recent,"source_links":source}
        rows=[signal,{**signal,"id":"auto-old","ts":int((now-timedelta(days=5)).timestamp()*1000)},
              {**signal,"id":"auto-no-source","source_links":[]},
              {**signal,"id":"manual","by":"editor"}]
        self.assertEqual([x["id"] for x in selected_signals(rows,now)],["auto-123"])

if __name__=="__main__": unittest.main()

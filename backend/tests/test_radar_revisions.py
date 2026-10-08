import importlib.util
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('radars',ROOT/'backend/scripts/refresh_radars.py')
radars=importlib.util.module_from_spec(spec);spec.loader.exec_module(radars)
class Revisions(unittest.TestCase):
    def setUp(self):
        self.data=json.loads((ROOT/'web-static/data/us-radar.json').read_text());self.data['generic_polls']=[];self.data.pop('generic_reviewed_at',None)
    def test_unchanged_does_not_invent_poll(self):
        first=radars.update_country('us',self.data,{},'2026-10-08T00:00:00Z')
        again=radars.update_country('us',self.data,first,'2026-10-09T00:00:00Z')
        self.assertEqual(first['history'],again['history']);self.assertEqual(first['changes'],again['changes'])
        self.assertEqual(first['reviewed_at'],again['reviewed_at'])
    def test_real_change_preserved_and_logged(self):
        first=radars.update_country('us',self.data,{},'2026-10-08T00:00:00Z')
        self.data['generic']['d']=45;self.data['generic_date']='2026-10-10'
        second=radars.update_country('us',self.data,first,'2026-10-10T00:00:00Z')
        self.assertEqual(len(second['history']),2)
        self.assertIn('44 ← 45',second['changes'][-1]['title_fa'])
        self.assertEqual(second['history'][0]['values']['d'],44)
    def test_review_alone_not_new_point(self):
        first=radars.update_country('us',self.data,{},'a')
        self.data['updated_iso']='2026-10-10T00:00:00Z'
        second=radars.update_country('us',self.data,first,'b')
        self.assertEqual(len(second['history']),1)
        self.assertEqual(second['reviewed_at'],self.data['updated_iso'])
    def test_new_pdf_release_not_new_poll(self):
        first=radars.update_country('us',self.data,{},'a')
        self.data['generic_source_url']='https://www.ipsos.com/new-release.pdf'
        self.data['generic']['label']='Reuters/Ipsos · 2026-10-05'
        second=radars.update_country('us',self.data,first,'b')
        self.assertEqual(len(second['history']),1)
        self.assertEqual(first['changes'],second['changes'])
        self.assertEqual(second['history'][-1]['url'],self.data['generic_source_url'])
class PollTable(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec=importlib.util.spec_from_file_location('polls',ROOT/'backend/scripts/collect_radar_polls.py')
        cls.polls=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.polls)
    def fixture(self):
        return '''Interview dates: September 30 to October 5, 2026
TM3287Y24. Thinking about the elections in 2026
Total (N=4,506) RV (N=3,526) Rep (N=1,339) Dem (N=1,337)
Democratic candidate 37% 44% 3% 85% 26%
Republican candidate 30% 37% 83% 2% 14%
TM3328Y25. Different question'''
    def test_registered_column_and_cross_month_date(self):
        result=self.polls.parse_poll(self.fixture())
        self.assertEqual(result,{'date':'2026-10-05','values':{'d':44,'r':37}})
    def test_reordered_columns_rejected(self):
        with self.assertRaises(ValueError): self.polls.parse_poll(self.fixture().replace('RV (N=3,526)','Dem (N=3,526)'))
    def test_other_question_rejected(self):
        with self.assertRaises(ValueError): self.polls.parse_poll(self.fixture().replace('TM3287Y24','TM9999Y24'))

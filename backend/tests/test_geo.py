import unittest
from app.geo.service import classify

class ProvinceTests(unittest.TestCase):
    def test_city_and_normalization(self):
        g=classify("بارندگی در قائم شهر و بابلسر و نوشهر")
        self.assertEqual(g['provinces'][0]['slug'],'mazandaran')
        self.assertEqual({c['name_fa'] for c in g['cities']},{'قائم‌شهر','بابلسر','نوشهر'})
        self.assertEqual(classify('بارندگي در ساري')['provinces'][0]['slug'],'mazandaran')
    def test_light_and_substrings(self):
        self.assertEqual(classify('نور خورشید و دلار')['provinces'],[])
    def test_multiple_provinces(self):
        self.assertEqual({p['slug'] for p in classify('رشت و رامسر')['provinces']},{'gilan','mazandaran'})

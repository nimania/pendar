import json, tempfile, unittest, xml.etree.ElementTree as ET
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from build_seo import build

class SeoTests(unittest.TestCase):
    def test_static_pages_and_rebuild(self):
        with tempfile.TemporaryDirectory() as folder:
            site=Path(folder);data=site/'data';data.mkdir()
            (site/'index.html').write_text((Path(__file__).resolve().parents[2]/'web-static'/'index.html').read_text())
            fixtures={
                'stories.json':[{'id':'news-1','headline_fa':'خبر آزمایشی','summary_fa':'گزارش دقیق و قابل خواندن بدون جاوااسکریپت. '*8}],
                'figures.json':{'figures':[{'handle':'standalone','name_fa':'چهره مستقل','bio_fa':'زندگی و آثار این شخص در پندار معرفی می‌شود. '*5},{'handle':'someone','name_fa':'یک چهره','posts':[{'id':'statement-1','topic_fa':'دیدگاه','summary_fa':'شرح دیدگاه همراه با توضیح و شواهد. '*8}]}]},
                'books.json':{'books':[{'slug':'a-book','title_fa':'کتاب','description_fa':'معرفی کتاب و نویسنده و اطلاعات اثر. '*8}]},
                'movies.json':{'movies':[{'slug':'a-movie','title_fa':'فیلم','overview_fa':'شرح فیلم و داستان و اطلاعات آن. '*8}]},
                'entity-registry.json':{'entities':[{'id':'book:a-book','type':'book','name_fa':'کتاب','refs':[{'dataset':'books','key':'a-book'}]},{'id':'organization:a-group','type':'organization','name_fa':'گروه','meta':{'description_fa':'معرفی کامل این گروه در پندار. '*8}},{'id':'person:someone','name_fa':'یک چهره','refs':[{'dataset':'figures','key':'someone'}]}]},
            }
            for name,obj in fixtures.items():(data/name).write_text(json.dumps(obj,ensure_ascii=False))
            pages=build(site)
            for url in ['/story/news-1/','/book/a-book/','/movie/a-movie/','/statement/statement-1/','/us-radar/']:
                html=(site/url.strip('/')/'index.html').read_text()
                self.assertIn('<base href="/">',html)
                self.assertLess(html.index('<base '),html.index('<link rel="stylesheet"'))
                self.assertIn('https://pendar.io'+url,html)
                self.assertIn('<section id="seo-static"',html)
                self.assertIn('<meta name="robots" content="index,follow',html)
                self.assertNotIn('href="#/',html[html.index('<section id="seo-static"'):html.index('<!-- seo-end -->')])
                json.loads((site/url.strip('/')/'seo.json').read_text())
            ET.parse(site/'sitemap.xml');ET.parse(site/'sitemap-1.xml')
            sitemap=(site/'sitemap-1.xml').read_text()
            self.assertNotIn('#',sitemap)
            self.assertNotIn('/entity/person%3Asomeone/',sitemap)
            self.assertIn('/@someone/',sitemap)
            self.assertNotIn('/figure/someone/',sitemap)
            self.assertIn('0;url=/@someone/',(site/'entity/person:someone/index.html').read_text())
            handles=json.loads((data/'person-handles.json').read_text())
            self.assertEqual(handles['people']['someone']['id'],'person:someone')
            self.assertEqual(handles['routes']['figure/someone'],'someone')
            self.assertEqual(handles['entities']['entity/book:a-book'],'/book/a-book/')
            self.assertEqual(handles['entities']['entity/organization:a-group'],'/entity/organization/a-group/')
            self.assertIn('0;url=/book/a-book/',(site/'entity/book:a-book/index.html').read_text())
            self.assertIn('/entity/organization/a-group/',sitemap)
            self.assertIn('ProfilePage',(site/'@someone/index.html').read_text())
            self.assertTrue((site/'entity/person:someone/index.html').exists())
            self.assertIn('Sitemap: https://pendar.io/sitemap.xml',(site/'robots.txt').read_text())
            (data/'movies.json').write_text('{"movies":[]}')
            build(site)
            again=json.loads((data/'person-handles.json').read_text())
            self.assertEqual(again['people'],handles['people'])
            self.assertEqual(again['people']['standalone']['figure'],'standalone')
            self.assertFalse((site/'movie/a-movie/index.html').exists())
            self.assertEqual((site/'index.html').read_text().count('id="seo-static"'),1)
if __name__=='__main__':unittest.main()


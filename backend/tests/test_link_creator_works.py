import json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from link_creator_works import publish,bucket

class LinkTests(unittest.TestCase):
    def test_exact_ready_links_only_and_reverse_and_dedup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'people').mkdir()
            person={'id':'person:a','type':'person','name_fa':'آزمایش','refs':[{'dataset':'books.people','key':'translator-a'}],'meta':{'tmdb_id':9,'works':[
                {'kind':'movie','tmdb_id':12,'id':'tmdb:movie:12','role_fa':'بازیگر','url':'https://example.com/movie'},
                {'kind':'movie','id':'wikidata:Q12','role_fa':'تهیه‌کننده','thumbnail':'https://example.com/poster'},
                {'kind':'tv','tmdb_id':12,'id':'tmdb:tv:12','internal_target':{'kind':'movie','id':'pm_c'}},
                {'kind':'book','id':'wikidata:Q2','title':'همنام'}]}}
            (root/'books.json').write_text(json.dumps({'books':[{'slug':'own','creators':[],'editions':[{'creators':[{'slug':'translator-a','name_fa':'آزمایش','role_fa':'مترجم'}]}]}]}))
            (root/'entity-registry.json').write_text(json.dumps({'entities':[]}))
            (root/'people/0.json').write_text(json.dumps({'person:a':person}))
            rows=[{'person_id':'person:a','work_id':'tmdb:movie:12','kind':'movie','tmdb_id':12,'status':'internal_ready','target_id':'pm_c'},
                  {'person_id':'person:a','work_id':'wikidata:Q12','kind':'movie','status':'internal_ready','target_id':'pm_c'},
                  {'person_id':'person:a','work_id':'tmdb:tv:12','kind':'tv','tmdb_id':12,'status':'indexed_metadata_pending','target_id':'pt_c'},
                  {'person_id':'person:a','work_id':'wikidata:Q2','kind':'book','status':'review_candidates'},
                  {'person_id':'person:a','work_id':'pendar-book:own','kind':'book','status':'internal_ready','target_id':'own'}]
            (root/'creator-work-audit.json').write_text(json.dumps({'scope':{'movie_index':'full_master'},'works':rows}))
            self.assertEqual(publish(root),2)
            result=json.loads((root/'people/0.json').read_text())['person:a']['meta']['works']
            self.assertEqual(len(result),3)
            self.assertEqual(result[0]['internal_target'],{'kind':'movie','id':'pm_c'})
            self.assertEqual(result[0]['role_fa'],'بازیگر · تهیه‌کننده')
            self.assertTrue(result[0]['thumbnail'])
            self.assertNotIn('internal_target',result[1]);self.assertNotIn('internal_target',result[2])
            reverse=json.loads((root/f'creator-work-links/{bucket("movie:pm_c")}.json').read_text())
            self.assertEqual(reverse['movie:pm_c'][0]['person_id'],'person:a')
            self.assertEqual(reverse['movie:pm_c'][0]['role_fa'],'بازیگر · تهیه‌کننده')
            book_reverse=json.loads((root/f'creator-work-links/{bucket("book:own")}.json').read_text())
            self.assertEqual(book_reverse['book:own'][0]['role_fa'],'مترجم')
            self.assertEqual(publish(root),2)
            self.assertEqual(json.loads((root/'people/0.json').read_text())['person:a']['meta']['works'],result)

if __name__=='__main__': unittest.main()

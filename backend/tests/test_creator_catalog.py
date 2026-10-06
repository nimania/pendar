import sys
import unittest
import json
import tempfile
from unittest.mock import patch
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from enrich_creator_catalog import profile, work, enrich, related_work_ids
from build_people import combined_works
from build_entities import Registry, add_creator_profiles, add_books

def claim(value):
    return [{'rank':'normal','mainsnak':{'datavalue':{'value':value}}}]

class CreatorCatalogTests(unittest.TestCase):
    def test_related_ids_reject_unrequested_people_and_nonentities(self):
        data={'results':{'bindings':[{'person':{'value':'http://www.wikidata.org/entity/Q1'},'work':{'value':'http://www.wikidata.org/entity/Q2'}},{'person':{'value':'http://www.wikidata.org/entity/Q9'},'work':{'value':'http://www.wikidata.org/entity/Q3'}},{'person':{'value':'http://www.wikidata.org/entity/Q1'},'work':{'value':'http://www.wikidata.org/prop/statement/P50'}}]}}
        with patch('enrich_creator_catalog.request',return_value=data):
            self.assertEqual(related_work_ids(['Q1']),{'Q1':['Q2']})

    def test_provider_author_books_do_not_establish_authorship(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); seeds=root/'seeds.json'; cache=root/'cache.json'
            seeds.write_text(json.dumps([{'site':'enwiki','title':'Author','name_fa':'نویسنده'}]))
            cache.write_text(json.dumps({'profiles':{'enwiki:Author':{'qid':'Q1','name_fa':'نویسنده','aliases':[],'occupation_ids':[],'notable_ids':[],'meta':{'social':[{'url':'https://openlibrary.org/authors/OL1A'}],'works':[{'id':'openlibrary:bad','kind':'book','title':'Unrelated book'}]}}},'related':{'Q1':[]}}))
            with patch('enrich_creator_catalog.request',side_effect=RuntimeError('offline')):
                people=enrich(root,0,seeds,cache)
            self.assertEqual(people[0]['meta']['works'],[])
            self.assertEqual(people[0]['meta']['social'],[])

    def test_nonhuman_is_not_a_person(self):
        self.assertIsNone(profile({'id':'Q1','claims':{}},{'name_fa':'کتاب'}))

    def test_roles_are_exact_relationships(self):
        entity={'id':'Q2','labels':{'en':{'value':'Novel'}},'claims':{'P50':claim({'id':'Q1'}),'P655':claim({'id':'Q3'})}}
        self.assertEqual(work(entity,'Q1')['role_fa'],'نویسنده')
        self.assertEqual(work(entity,'Q3')['role_fa'],'مترجم')
        self.assertNotEqual(work(entity,'Q4')['role_fa'],'نویسنده')

    def test_same_work_multiple_roles_and_media_ids(self):
        credits={'cast':[{'id':12,'media_type':'movie','title':'Film'},{'id':12,'media_type':'tv','name':'Series'}],'crew':[{'id':12,'media_type':'movie','title':'Film','job':'Director'}]}
        works=combined_works(credits)
        self.assertEqual(len(works),2)
        film=next(w for w in works if w['kind']=='movie')
        self.assertEqual(film['roles'],['بازیگر','کارگردان'])
        self.assertEqual(film['url'],'https://www.themoviedb.org/movie/12')

    def test_book_and_film_share_one_exact_identity(self):
        reg=Registry()
        add_books(reg,{'people':[{'slug':'author','name_fa':'نام فارسی','wikidata_id':'Q1','book_slugs':['book']}],'books':[]})
        add_creator_profiles(reg,{'people':[{'qid':'Q1','name_fa':'نام دیگر','book_slugs':['author'],'meta':{'wikidata_id':'Q1','tmdb_id':12,'works':[{'kind':'movie','title':'Film'}]}}]})
        people=[e for e in reg.entities.values() if e['type']=='person']
        self.assertEqual(len(people),1)
        self.assertEqual(people[0]['meta']['tmdb_id'],12)
        self.assertEqual(people[0]['routes']['figure'],people[0]['id'].split(':')[1])

if __name__=='__main__': unittest.main()

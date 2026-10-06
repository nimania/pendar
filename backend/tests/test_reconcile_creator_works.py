import tempfile,sqlite3,json,unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from reconcile_creator_works import reconcile,media_key

class ReconciliationTests(unittest.TestCase):
    def test_same_numeric_id_is_not_same_movie_and_series(self):
        self.assertEqual(media_key({'kind':'tv','tmdb_id':12}),('series',12))
        self.assertIsNone(media_key({'kind':'tv','tmdb_id':12,'url':'https://www.themoviedb.org/movie/12'}))

    def test_full_index_missing_metadata_ambiguity_and_internal_books(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            p={'id':'person:a','type':'person','name_fa':'نویسنده','refs':[{'dataset':'books.people','key':'a'}],'meta':{'works':[{'kind':'movie','tmdb_id':12,'title':'Outside Top'},{'kind':'tv','tmdb_id':12,'title':'Missing TV'},{'kind':'book','id':'wikidata:Q1','title_fa':'همنام'}]}}
            (root/'entity-registry.json').write_text(json.dumps({'entities':[p]}))
            (root/'books.json').write_text(json.dumps({'books':[{'slug':'own','title_fa':'اثر خودش'},{'slug':'other','title_fa':'همنام'}],'people':[{'slug':'a','name_fa':'نویسنده','book_slugs':['own']}]}))
            db=root/'master.sqlite';con=sqlite3.connect(db);con.execute('CREATE TABLE titles(pendar_id,media_type,tmdb_id,hydrated,active)');con.execute("INSERT INTO titles VALUES('pm_c','movie',12,1,1)");con.commit();con.close()
            result=reconcile(root,db)
            self.assertEqual(result['counts']['indexed_metadata_pending'],1)
            self.assertEqual(result['counts']['not_indexed'],1)
            self.assertEqual(result['counts']['review_candidates'],1)
            self.assertEqual(result['counts']['internal_ready'],1)
            self.assertEqual(result['scope']['movie_index'],'full_master')

if __name__=='__main__': unittest.main()

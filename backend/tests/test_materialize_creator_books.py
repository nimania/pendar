import json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from materialize_creator_books import materialize

class BooksTests(unittest.TestCase):
    def test_exact_identity_existing_book_and_multiple_creators(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            data={'books':[{'slug':'old','title_fa':'کتاب قبلی','creators':[]}],'people':[{'slug':'author','name_fa':'نویسنده','wikidata_id':'Q1','roles_fa':['نویسنده'],'book_slugs':['old']}]}
            work={'id':'wikidata:Q10','kind':'book','title_fa':'کتاب قبلی','role_fa':'نویسنده','year':'2000'}
            new={'id':'wikidata:Q20','kind':'book','title_fa':'اثر تازه','role_fa':'نویسنده'}
            profiles=[{'qid':'Q1','name_fa':'نویسنده','aliases':[],'meta':{'works':[work,new,{'id':'wikidata:Q30','kind':'book','title_fa':'صرفاً اشاره','role_fa':'اثر شاخص'}]}},
                      {'qid':'Q2','name_fa':'مترجم','meta':{'works':[{**new,'role_fa':'مترجم'}]}}]
            (root/'books.json').write_text(json.dumps(data));(root/'creator-profiles.json').write_text(json.dumps({'people':profiles}))
            result=materialize(root);self.assertEqual(result['created'],1)
            out=json.loads((root/'books.json').read_text());self.assertEqual(len(out['books']),2)
            self.assertEqual(out['books'][0]['slug'],'old');self.assertTrue(out['books'][0]['external']['wikidata'].endswith('Q10'))
            self.assertEqual({c['role_fa'] for c in out['books'][1]['creators']},{'نویسنده','مترجم'})
            self.assertEqual(materialize(root)['created'],0)
            self.assertEqual(json.loads((root/'books.json').read_text()),out)

if __name__=='__main__':unittest.main()

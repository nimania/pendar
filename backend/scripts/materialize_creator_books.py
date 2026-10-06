"""Create internal literary-work records from verified creator catalog identities."""
import argparse,json,re
from collections import defaultdict
from pathlib import Path
from reconcile_creator_works import read,norm

def materialize(root):
    data=read(root/'books.json',{'books':[],'people':[]})
    profiles=read(root/'creator-profiles.json',{}).get('people',[])
    books=data.setdefault('books',[]); people=data.setdefault('people',[])
    by_qid=defaultdict(list)
    for b in books:
        for field in ('wikidata','wikidata_id','wikidata_qid'):
            qid=re.search(r'Q\d+',str(b.get(field) or (b.get('external') or {}).get(field) or ''))
            if qid and b not in by_qid[qid[0]]: by_qid[qid[0]].append(b)
    names=defaultdict(set)
    for p in profiles:
        for name in [p.get('name_fa')]+p.get('aliases',[]):
            if norm(name): names[norm(name)].add(p['qid'])
    created=0; attached=0
    for p in profiles:
        if p.get('unverified_book_match'): continue
        aliases={norm(n) for n in [p.get('name_fa')]+p.get('aliases',[]) if n}
        linked={slug for person in people if norm(person.get('name_fa')) in aliases and names[norm(person.get('name_fa'))]=={p['qid']} for slug in person.get('book_slugs',[])}
        creator=next((x for x in people if x.get('wikidata_id')==p['qid']),None)
        if not creator:
            creator={'slug':'creator-'+p['qid'].lower(),'name_fa':p['name_fa'],'wikidata_id':p['qid'],'aliases':p.get('aliases',[]),'profile':p.get('meta',{}),'roles_fa':[],'book_slugs':[]}
        creator.setdefault('roles_fa',[]);creator.setdefault('book_slugs',[])
        used=False
        for work in p.get('meta',{}).get('works',[]):
            if work.get('kind')!='book' or not re.fullmatch(r'wikidata:Q\d+',str(work.get('id',''))): continue
            roles=[r.strip() for r in re.split('[،·]',work.get('role_fa','')) if r.strip() in ('نویسنده','مترجم','تصویرگر','ویراستار')]
            if not roles: continue
            qid=work['id'].split(':')[1];title=work.get('title_fa') or work.get('title')
            if not title: continue
            candidates=by_qid.get(qid,[])
            if len(candidates)>1: continue
            b=candidates[0] if candidates else None
            if not b:
                exact=[x for x in books if x['slug'] in linked and norm(x.get('title_fa'))==norm(title)]
                if len(exact)>1: continue
                if exact: b=exact[0];b.setdefault('external',{})['wikidata']='https://www.wikidata.org/wiki/'+qid
            if not b:
                b={'slug':'work-'+qid.lower(),'title_fa':title,'original_title':work.get('title_en') or '',
                   'source_lang':work.get('source_lang') or 'fa','record_type':'literary_work','category_fa':'کتاب و آثار ادبی','creators':[],
                   'description_fa':work.get('description_fa') or '', 'original_year':work.get('year') or None,
                   'cover_url':work.get('thumbnail') or '', 'external':{'wikidata':'https://www.wikidata.org/wiki/'+qid,'encyclopedia':work.get('url')},
                   'source_meta':{'provider':'Wikidata','work_id':qid,'source_url':work.get('source_url') or 'https://www.wikidata.org/wiki/'+qid},
                   'editions':[],'purchase_links':[],'mentions':[],'mention_count':0}
                books.append(b);created+=1
            by_qid[qid]=[b]
            # Roles describe sourced relationships to the work; no edition is invented.
            for role in roles:
                if role not in creator['roles_fa']: creator['roles_fa'].append(role)
                if not any(c.get('slug')==creator['slug'] and c.get('role_fa')==role for c in b.get('creators',[])):
                    b.setdefault('creators',[]).append({'slug':creator['slug'],'name_fa':creator['name_fa'],'role_fa':role,'source_url':work.get('source_url')});attached+=1
            if b['slug'] not in creator['book_slugs']:creator['book_slugs'].append(b['slug'])
            used=True
        if used and creator not in people: people.append(creator)
    text=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    (root/'books.json').write_text(text,encoding='utf-8');(root/'books.js').write_text('window.__BOOKS_DATA__='+text+';\n',encoding='utf-8')
    report={'created':created,'creator_links_added':attached,'total_books':len(books)}
    (root/'creator-books-status.json').write_text(json.dumps(report),encoding='utf-8')
    print('Internal creator books:',json.dumps(report));return report

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--data-dir',type=Path,required=True)
    materialize(p.parse_args().data_dir)

"""Read-only reconciliation: exact provider identities, never guessed title merges."""
import argparse
import json
import re
import sqlite3
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

def read(path, default):
    try: return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError): return default

def norm(value):
    return ' '.join(str(value or '').translate(str.maketrans('يىك','ییک')).replace('\u200c',' ').lower().split())

def media_key(work):
    kind=work.get('kind'); typ='series' if kind in ('tv','series') else 'movie' if kind in ('movie','film') else None
    if not typ: return None
    mid=work.get('tmdb_id')
    match=re.search(r'(?:tmdb:|themoviedb.org/)(movie|tv)[:/](\d+)',str(work.get('id',''))+' '+str(work.get('url','')))
    if match:
        urltyp='series' if match[1]=='tv' else 'movie'
        if urltyp!=typ: return None
        if mid and int(mid)!=int(match[2]): return None
        mid=int(match[2])
    return (typ,int(mid)) if mid and str(mid).isdigit() else None

def reconcile(root, db_path=None):
    registry=read(root/'entity-registry.json',{}); people={e['id']:e for e in registry.get('entities',[]) if e.get('type')=='person'}
    for path in (root/'people').glob('*.json'):
        for person in read(path,{}).values():
            if person.get('type')=='person': people[person['id']]=person
    books=read(root/'books.json',{}); by_slug={b['slug']:b for b in books.get('books',[])}
    creators={p['slug']:p for p in books.get('people',[])}
    title_books=defaultdict(list); qid_books=defaultdict(list)
    for b in by_slug.values():
        title_books[norm(b.get('title_fa') or b.get('original_title'))].append(b['slug'])
        ext=b.get('external') or {}
        for key in ('wikidata','wikidata_id','wikidata_qid'):
            qid=re.search(r'Q\d+',str(b.get(key) or ext.get(key) or ''))
            if qid: qid_books[qid[0]].append(b['slug'])
    ready={}
    for path in (root/'movie-master-details').glob('*.json'): ready.update(read(path,{}))
    top=read(root/'movie-master-top.json',{}).get('items',[])
    indexed={(r['media_type'],int(r['tmdb_id'])):r for r in top}
    owners=defaultdict(set)
    for pid,p in people.items():
        for name in [p.get('name_fa')]+p.get('aliases',[]):
            if norm(name): owners[norm(name)].add(pid)
    works=[]; person_totals={}; duplicate_rows=0; requested=set()
    for pid,p in people.items():
        rows={}
        for w in p.get('meta',{}).get('works',[]):
            if not isinstance(w,dict): continue
            key=media_key(w); identity=key or w.get('id') or w.get('url')
            if not identity: continue
            if identity in rows: duplicate_rows+=1; continue
            rows[identity]=w
            if key: requested.add(key)
        if rows: person_totals[pid]={'name_fa':p.get('name_fa'),'counts':{}}
        linked=set()
        names={norm(v) for v in [p.get('name_fa')]+p.get('aliases',[]) if v}
        for ref in p.get('refs',[]):
            if ref.get('dataset')=='books.people': linked.update(creators.get(str(ref.get('key')),{}).get('book_slugs',[]))
        for creator in creators.values():
            if norm(creator.get('name_fa')) in names and owners[norm(creator.get('name_fa'))]=={pid}: linked.update(creator.get('book_slugs',[]))
        for slug in linked:
            if slug in by_slug:
                b=by_slug[slug]; rows.setdefault('pendar-book:'+slug,{'id':'pendar-book:'+slug,'kind':'book','internal_slug':slug,'title_fa':b.get('title_fa')})
        if rows: person_totals[pid]={'name_fa':p.get('name_fa'),'counts':{}}
        for identity,w in rows.items(): works.append((pid,w,linked))
    coverage='full_master' if db_path else 'public_subset_only'
    total_indexed=len(indexed)
    if db_path:
        con=sqlite3.connect('file:'+str(db_path.resolve())+'?mode=ro',uri=True)
        total_indexed=con.execute('SELECT COUNT(*) FROM titles WHERE active=1').fetchone()[0]
        for typ in ('movie','series'):
            ids=sorted(mid for t,mid in requested if t==typ)
            for offset in range(0,len(ids),500):
                batch=ids[offset:offset+500]
                query='SELECT pendar_id,tmdb_id,hydrated FROM titles WHERE active=1 AND media_type=? AND tmdb_id IN ('+','.join('?' for _ in batch)+')'
                for pendar,mid,hydrated in con.execute(query,[typ]+batch): indexed[(typ,mid)]={'pendar_id':pendar,'hydrated':hydrated}
        con.close()
    output=[]; counts=Counter()
    for pid,w,linked in works:
        kind=w.get('kind','other'); row={'person_id':pid,'name_fa':people[pid].get('name_fa'),'work_id':w.get('id'),'kind':kind,'title':w.get('title_fa') or w.get('title'),'source_url':w.get('source_url') or w.get('url')}
        key=media_key(w)
        if key:
            match=indexed.get(key)
            row['match_method']='exact_tmdb_type_and_id'
            if match:
                row['target_id']=match['pendar_id']; row['status']='internal_ready' if match['pendar_id'] in ready else 'indexed_metadata_pending'
            else: row['status']='not_indexed' if db_path else 'full_index_unchecked'
        elif kind=='book':
            qid=str(w.get('id','')).removeprefix('wikidata:'); exact=[w['internal_slug']] if w.get('internal_slug') in by_slug else qid_books.get(qid,[])
            if not exact:
                title=norm(row['title']); exact=[slug for slug in title_books.get(title,[]) if slug in linked]
                row['match_method']='exact_title_and_linked_creator'
            else: row['match_method']='exact_wikidata_id'
            if len(exact)==1: row.update(status='internal_ready',target_id=exact[0])
            elif len(exact)>1: row.update(status='duplicate_candidates',candidate_ids=exact)
            else:
                candidates=title_books.get(norm(row['title']),[])
                row.update(status='review_candidates' if candidates else 'not_indexed',candidate_ids=candidates)
        else: row['status']='identity_review_required'
        counts[row['status']]+=1
        pc=person_totals[pid]['counts']; pc[row['status']]=pc.get(row['status'],0)+1
        output.append(row)
    result={'generated_at':datetime.now(timezone.utc).isoformat(),'scope':{'movie_index':coverage,'master_titles':total_indexed,'detail_records':len(ready),'books':len(by_slug),'audited_people':len(person_totals),'audited_works':len(output)},'counts':dict(counts),'duplicate_source_rows':duplicate_rows,'people':person_totals,'works':output}
    (root/'creator-work-audit.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print('Creator work reconciliation:',json.dumps({k:v for k,v in result.items() if k not in ('people','works')},ensure_ascii=False))
    for name in ('بهرام بیضایی','مهدی تدینی','لیلا حاتمی','جورج اورول','تام هنکس'):
        print('Sample:',name,json.dumps([v for v in person_totals.values() if norm(v['name_fa'])==norm(name)],ensure_ascii=False))
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--data-dir',type=Path,required=True);p.add_argument('--master-db',type=Path)
    a=p.parse_args();reconcile(a.data_dir,a.master_db)

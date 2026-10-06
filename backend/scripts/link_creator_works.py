"""Publish only exact, detail-ready creator/work links from reconciliation."""
import argparse
import json
from pathlib import Path
from collections import defaultdict
from reconcile_creator_works import read, media_key, norm

def bucket(key): return sum(ord(c) for c in key) % 64

def publish(root):
    audit=read(root/'creator-work-audit.json',{})
    if not audit.get('scope'): raise ValueError('Reconciliation report required')
    matches=defaultdict(dict)
    for row in audit.get('works',[]):
        if row.get('status')!='internal_ready': continue
        target={'kind':'book' if row['kind']=='book' else 'movie','id':row['target_id']}
        for key in (row.get('work_id'),row.get('source_url')):
            if key: matches[row['person_id']][key]=target
        if row.get('tmdb_id'):
            typ='series' if row['kind'] in ('tv','series') else 'movie'
            matches[row['person_id']][(typ,int(row['tmdb_id']))]=target
    reverse=[defaultdict(dict) for _ in range(64)]
    linked=0; profiles={}
    def update(p):
        nonlocal linked
        pid=p.get('id'); meta=p.get('meta',{}); result=[]; seen={}
        if pid in matches: profiles[pid]={'name_fa':p.get('name_fa'),'aliases':p.get('aliases',[]),'refs':p.get('refs',[]),'tmdb_id':meta.get('tmdb_id')}
        for work in meta.get('works',[]):
            if not isinstance(work,dict): continue
            work=dict(work); work.pop('internal_target',None)
            lookup=matches.get(pid,{})
            target=lookup.get(media_key(work)) or lookup.get(work.get('id')) or lookup.get(work.get('source_url')) or lookup.get(work.get('url'))
            if target:
                work['internal_target']=target
                key=(target['kind'],target['id'])
                if key in seen:
                    old=seen[key]
                    old['role_fa']=' · '.join(dict.fromkeys(filter(None,[old.get('role_fa'),work.get('role_fa')])))
                    if not old.get('thumbnail'): old['thumbnail']=work.get('thumbnail')
                    revkey=target['kind']+':'+target['id']
                    reverse[bucket(revkey)][revkey][pid]['role_fa']=old['role_fa']
                    continue
                seen[key]=work; linked+=1
                revkey=target['kind']+':'+target['id']
                reverse[bucket(revkey)][revkey][pid]={'person_id':pid,'name_fa':p.get('name_fa'),'role_fa':work.get('role_fa'),'tmdb_person_id':meta.get('tmdb_id')}
            result.append(work)
        if 'works' in meta: meta['works']=result
    registry=read(root/'entity-registry.json',{})
    # Partition records are authoritative; registry may contain the same person.
    for p in registry.get('entities',[]):
        if p.get('type')=='person': update(p)
    (root/'entity-registry.json').write_text(json.dumps(registry,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    for path in (root/'people').glob('*.json'):
        records=read(path,{})
        for p in records.values():
            if p.get('type')=='person': update(p)
        path.write_text(json.dumps(records,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    # Books linked through edition translators/creators need reverse edges too,
    # even when the person has no imported meta.works rows.
    books={b['slug']:b for b in read(root/'books.json',{}).get('books',[])}
    for row in audit.get('works',[]):
        if row.get('status')!='internal_ready' or row.get('kind')!='book': continue
        pid=row['person_id']; person=profiles.get(pid)
        if not person: continue
        book=books.get(row['target_id'],{})
        names={norm(n) for n in [person['name_fa']]+person['aliases'] if n}
        slugs={str(r['key']) for r in person['refs'] if r.get('dataset')=='books.people'}
        creators=book.get('creators',[])+[c for e in book.get('editions',[]) for c in e.get('creators',[])]
        roles=list(dict.fromkeys(c['role_fa'] for c in creators if c.get('role_fa') and (str(c.get('slug')) in slugs or norm(c.get('name_fa')) in names)))
        key='book:'+row['target_id']; edges=reverse[bucket(key)][key]
        old=edges.get(pid,{})
        edges[pid]={'person_id':pid,'name_fa':person['name_fa'],'tmdb_person_id':person['tmdb_id'],'role_fa':old.get('role_fa') or '، '.join(roles) or 'پدیدآورنده'}
    dest=root/'creator-work-links'; dest.mkdir(exist_ok=True)
    for n,records in enumerate(reverse):
        (dest/(str(n)+'.json')).write_text(json.dumps({k:list(v.values()) for k,v in records.items()},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    unique=sum(len(v) for records in reverse for v in records.values())
    print('Published verified creator/work links:',unique)
    return unique

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--data-dir',type=Path,required=True)
    publish(p.parse_args().data_dir)

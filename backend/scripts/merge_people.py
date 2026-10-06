"""Extend the canonical person registry from exact upstream identities.

Large person records live in registry partitions; there is one person type,
one directory and one profile renderer for every source.
"""
import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from build_entities import norm, read_json

ROLE_FA={'Director':'کارگردان','Writer':'نویسنده','Screenplay':'فیلمنامه‌نویس','Creator':'خالق','Producer':'تهیه‌کننده','Executive Producer':'تهیه‌کننده اجرایی','Story':'داستان‌نویس','Director of Photography':'مدیر فیلم‌برداری','Editor':'تدوینگر','Original Music Composer':'آهنگساز','Casting':'انتخاب بازیگر'}

def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

def merge(root):
    registry=read_json(root/'entity-registry.json',{})
    entities=registry.get('entities',[])
    by_id={e['id']:e for e in entities}
    # Index only the original canonical identities, before adding provider people.
    names=defaultdict(set); external=defaultdict(set)
    for e in entities:
        if e.get('type')!='person': continue
        for label in [e.get('name_fa')]+e.get('aliases',[]):
            if norm(label): names[norm(label)].add(e['id'])
        meta=e.get('meta',{})
        for key in ('tmdb_id','wikidata_id','wikidata_qid','imdb_id'):
            if meta.get(key): external[(key,str(meta[key]))].add(e['id'])
    rows=[]
    for shard in (root/'people').glob('*.json'):
        rows.extend(read_json(shard,{}).values())
    fa_counts=Counter(norm(p.get('name_fa')) for p in rows if p.get('name_fa'))
    original_counts=Counter(norm(p.get('name')) for p in rows if p.get('name'))
    buckets=[{} for _ in range(64)]; index=[]; matched=0
    for p in rows:
        tmdb=int(p['id']); candidates=set()
        for key,value in [('tmdb_id',tmdb),('wikidata_id',p.get('wikidata_id')),('wikidata_qid',p.get('wikidata_id')),('imdb_id',p.get('imdb_id'))]:
            if value: candidates.update(external.get((key,str(value)),set()))
        # Exact unique Persian names follow the existing registry policy;
        # ambiguous provider names never collapse into an unrelated person.
        label=p.get('name_fa','')
        if not candidates and label and fa_counts[norm(label)]==1:
            candidates=names.get(norm(label),set())
        if not candidates and p.get('name') and original_counts[norm(p['name'])]==1:
            original_matches=names.get(norm(p['name']),set())
            if len(original_matches)==1:
                original_id=next(iter(original_matches))
                if set(by_id[original_id].get('roles',[]))&{'actor','director'}: candidates={original_id}
        target=next(iter(candidates)) if len(candidates)==1 else None
        eid=target or f'person:tmdb-{tmdb}'
        if target:
            entity=by_id[target]; matched+=1
        else:
            entity={'id':eid,'type':'person','name_fa':label or p.get('name',''),'aliases':[],'roles':[],'refs':[],'routes':{},'meta':{}}
        for alias in [label,p.get('name','')]:
            if alias and alias!=entity['name_fa'] and alias not in entity['aliases']: entity['aliases'].append(alias)
        meta=entity.setdefault('meta',{})
        meta.update({'tmdb_id':tmdb,'person_bucket':tmdb%64})
        for key in ('birthday','deathday','biography_fa','wikidata_id','imdb_id'):
            if p.get(key) and not meta.get(key): meta[key]=p[key]
        photo='https://image.tmdb.org/t/p/w185'+p['profile_path'] if p.get('profile_path') else ''
        if photo and not meta.get('avatar'): meta['avatar']=photo
        role='، '.join(dict.fromkeys(ROLE_FA.get(r,r if r=='بازیگر' else 'عوامل') for r in p.get('roles',[])))
        if role and not meta.get('role_fa'): meta['role_fa']=role
        ref={'dataset':'tmdb_people','key':str(tmdb)}
        if ref not in entity['refs']: entity['refs'].append(ref)
        handle=entity['routes'].get('figure') or f'tmdb-{tmdb}'
        entity['routes']['figure']=handle
        if 'figure' not in entity['roles']: entity['roles'].append('figure')
        # Filmography is a relationship, not a separate kind of person.
        record={**entity,'meta':{**meta,'filmography':p.get('films',{})}}
        buckets[tmdb%64][str(tmdb)]=record
        index.append({'id':eid,'tmdb_id':tmdb,'handle':handle,'name_fa':entity['name_fa'],'aliases':entity['aliases'],'role_fa':meta.get('role_fa',''),'avatar':meta.get('avatar','')})
    for number,records in enumerate(buckets): write(root/'people'/f'{number}.json',records)
    # Exact old TMDB links resolve to a matched pre-existing canonical person.
    redirects=registry.setdefault('redirects',{})
    for row in index:
        alias=f"person:tmdb-{row['tmdb_id']}"
        if alias!=row['id']: redirects[alias]=row['id']
    extension_count=len(index)-matched
    base_people=sum(e.get('type')=='person' for e in entities)
    registry.setdefault('partitions',{})['person']={'index':'people-index.json','path':'people','buckets':64,'count':extension_count,'total':base_people+extension_count}
    registry.setdefault('counts',{})['person']=base_people+extension_count
    write(root/'entity-registry.json',registry)
    write(root/'people-index.json',{'people':index,'count':base_people+extension_count})
    # Movie credits link directly to canonical people, including known figures.
    ids={row['tmdb_id']:row['id'] for row in index}
    for path in (root/'movie-details').glob('*.json'):
        movie=read_json(path,{})
        for credit in movie.get('credits',[]): credit['person_id']=ids.get(credit.get('id'),f"person:tmdb-{credit.get('id')}")
        write(path,movie)
    print(f"Unified people: {base_people+extension_count}; media identities: {len(index)}; merged into existing people: {matched}")

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--data-dir',type=Path,default=Path('site/data'))
    merge(parser.parse_args().data_dir)

if __name__=='__main__': main()

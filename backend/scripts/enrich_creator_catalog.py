"""Progressively enrich exact book/film creator identities; never fuzzy-match people."""
import argparse
import hashlib
import json
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parents[1]
USER_AGENT = 'PendarCreatorCatalog/1.0 (https://nimania.github.io/pendar/; public bibliographic catalog)'

def read(path, default):
    try: return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError): return default

def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

def request(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': USER_AGENT}), timeout=15) as response:
        return json.load(response)

def api(**params):
    data = request('https://www.wikidata.org/w/api.php?' + urllib.parse.urlencode({'action':'wbgetentities','format':'json','props':'claims|labels|descriptions|sitelinks|aliases','languages':'fa|en', **params}))
    if data.get('error'): raise ValueError(data['error'].get('code'))
    return data.get('entities', {})

def norm(value):
    return ' '.join(str(value or '').translate(str.maketrans('يىك', 'ییک')).replace('\u200c', ' ').lower().split())

def claims(entity, prop):
    return [row['mainsnak']['datavalue']['value'] for row in entity.get('claims', {}).get(prop, []) if row.get('rank') != 'deprecated' and row.get('mainsnak', {}).get('datavalue')]

def ids(entity, prop):
    return [value.get('id') for value in claims(entity, prop) if isinstance(value, dict) and value.get('id')]

def first(entity, prop):
    return next(iter(claims(entity, prop)), None)

def label(entity, lang='fa'):
    return entity.get('labels', {}).get(lang, {}).get('value', '')

def image_url(filename, width=240):
    return 'https://commons.wikimedia.org/wiki/Special:FilePath/' + urllib.parse.quote(filename.replace(' ', '_')) + '?width=' + str(width) if filename else ''

def profile(entity, requested):
    if 'Q5' not in ids(entity, 'P31'): return None
    qid=entity['id']; links=[{'kind':'website','label':'ویکی‌داده','url':'https://www.wikidata.org/wiki/'+qid}]
    for site, display in [('fawiki','ویکی‌پدیای فارسی'),('enwiki','ویکی‌پدیای انگلیسی')]:
        page=entity.get('sitelinks', {}).get(site)
        if page: links.append({'kind':'website','label':display,'url':'https://'+site[:2]+'.wikipedia.org/wiki/'+urllib.parse.quote(page['title'].replace(' ', '_'))})
    for prop, kind, display, prefix in [('P856','website','وب‌سایت رسمی',''),('P2002','x','ایکس','https://x.com/'),('P2003','instagram','اینستاگرام','https://www.instagram.com/'),('P2397','youtube','یوتیوب','https://www.youtube.com/channel/')]:
        for value in claims(entity, prop):
            if isinstance(value,str): links.append({'kind':kind,'label':display,'url':prefix+value})
    aliases=[label(entity,'en'),label(entity)]+[row['value'] for lang in ('fa','en') for row in entity.get('aliases',{}).get(lang,[])]
    avatar=first(entity,'P18')
    return {'qid':qid,'name_fa':requested.get('name_fa') or label(entity) or label(entity,'en'),'aliases':list(dict.fromkeys(x for x in aliases if x)), 'book_slug':requested.get('book_slug'),'occupation_ids':ids(entity,'P106'),'notable_ids':ids(entity,'P800'), 'openlibrary_id':first(entity,'P648'), 'meta':{'wikidata_id':qid,'tmdb_id':first(entity,'P4985'),'imdb_id':first(entity,'P345'),'role_fa':entity.get('descriptions',{}).get('fa',{}).get('value',''),'summary':entity.get('descriptions',{}).get('fa',{}).get('value',''),'avatar':image_url(avatar),'picture_source':'https://commons.wikimedia.org/wiki/File:'+urllib.parse.quote(avatar.replace(' ','_')) if avatar else '', 'social':links, 'birthday':(first(entity,'P569') or {}).get('time','').lstrip('+').split('T')[0], 'deathday':(first(entity,'P570') or {}).get('time','').lstrip('+').split('T')[0], 'source_url':'https://www.wikidata.org/wiki/'+qid}}

def work(entity, person_qid):
    roles=[]
    for prop, role in [('P50','نویسنده'),('P655','مترجم'),('P57','کارگردان'),('P58','فیلم‌نامه‌نویس'),('P161','بازیگر'),('P110','تصویرگر'),('P98','ویراستار')]:
        if person_qid in ids(entity, prop): roles.append(role)
    kind='movie' if first(entity,'P4947') or 'Q11424' in ids(entity,'P31') else 'tv' if first(entity,'P4983') else 'book' if ids(entity,'P50') or 'Q571' in ids(entity,'P31') or 'Q7725634' in ids(entity,'P31') else 'other'
    page=entity.get('sitelinks',{}).get('fawiki') or entity.get('sitelinks',{}).get('enwiki')
    url='https://www.wikidata.org/wiki/'+entity['id']
    if page: url='https://'+page['site'][:2]+'.wikipedia.org/wiki/'+urllib.parse.quote(page['title'].replace(' ','_'))
    time=(first(entity,'P577') or {}).get('time','').lstrip('+')[:4]
    return {'id':'wikidata:'+entity['id'],'kind':kind,'tmdb_id':int(first(entity,'P4947') or first(entity,'P4983')) if first(entity,'P4947') or first(entity,'P4983') else None,'title_fa':label(entity) or label(entity,'en'),'url':url,'thumbnail':image_url(first(entity,'P18')),'role_fa':'، '.join(roles) or 'اثر شاخص','year':time,'source_url':'https://www.wikidata.org/wiki/'+entity['id'],'openlibrary_id':first(entity,'P648')}

def enrich(root, limit=100, seeds_path=None, cache_path=None):
    now=datetime.now(timezone.utc).isoformat(); cache_path=cache_path or SCRIPT_ROOT/'data/creator-catalog-cache.json'
    cache=read(cache_path, {'profiles':{},'works':{},'openlibrary':{}})
    for key in ('profiles','works','openlibrary','unresolved'): cache.setdefault(key,{})
    initial=read(SCRIPT_ROOT/'data/creator-initial-profiles.json',{}).get('people',[])
    for seed in initial:
        for row in read(seeds_path or SCRIPT_ROOT/'data/creator-seeds.json',[]):
            if row.get('name_fa')==seed.get('name_fa'): cache['profiles'].setdefault(row['site']+':'+row['title'],seed)
    cache['unresolved']={key:date for key,date in cache['unresolved'].items() if (datetime.now(timezone.utc)-datetime.fromisoformat(date)).days<7}
    books=read(root/'books.json',{}); people=books.get('people',[]); seeds=read(seeds_path or SCRIPT_ROOT/'data/creator-seeds.json',[])
    requests=list(seeds)+[{'name_fa':p['name_fa'],'site':'fawiki','title':p['name_fa'],'book_slug':p['slug']} for p in people if p.get('name_fa') and p.get('slug')]
    missing=[p for p in requests if p['site']+':'+p['title'] not in cache['profiles'] and cache['unresolved'].get(p['site']+':'+p['title']) is None][:limit]
    unresolved=[]; failed=[]
    by_site=defaultdict(list)
    for row in missing: by_site[row['site']].append(row)
    for site, rows in by_site.items():
        for offset in range(0,len(rows),20):
            batch=rows[offset:offset+20]
            try:
                entities=api(sites=site,titles='|'.join(p['title'] for p in batch))
                for row in batch:
                    candidates=[e for e in entities.values() if norm(e.get('sitelinks',{}).get(site,{}).get('title'))==norm(row['title'])]
                    if len(candidates)==1:
                        result=profile(candidates[0],row)
                        if result: cache['profiles'][site+':'+row['title']]=result
                        else: unresolved.append(row['title']); cache['unresolved'][site+':'+row['title']]=now
                    else: unresolved.append(row['title']); cache['unresolved'][site+':'+row['title']]=now
            except Exception as exc: failed.append({'stage':'identity','error':type(exc).__name__}); break
    profiles={}
    for row in requests:
        value=cache['profiles'].get(row['site']+':'+row['title'])
        if not value: continue
        if value['qid'] not in profiles: profiles[value['qid']]=json.loads(json.dumps(value))
        if row.get('book_slug'): profiles[value['qid']].setdefault('book_slugs',[]).append(row['book_slug'])
    entity_ids=set()
    for p in profiles.values(): entity_ids.update(p['occupation_ids']+p['notable_ids'][:20])
    pending=[qid for qid in sorted(entity_ids) if qid not in cache['works']]
    for start in range(0,len(pending),50):
        try: cache['works'].update(api(ids='|'.join(pending[start:start+50])))
        except Exception as exc: failed.append({'stage':'works','error':type(exc).__name__}); break
    for p in profiles.values():
        occupation_text=' '.join(label(cache['works'].get(q,{}),'en') for q in p['occupation_ids']).lower()
        # An exact encyclopedia page for a common name is not enough to identify a book creator.
        is_seed=any(row.get('qid')==p['qid'] or (row.get('name_fa')==p['name_fa'] and not row.get('book_slug')) for row in seeds)
        if not is_seed and not re.search('writer|author|poet|translator|historian|philosopher|editor|illustrator|journalist|researcher|academic|linguist',occupation_text):
            p['book_slugs']=[];p['unverified_book_match']=True
        works=[work(cache['works'][qid],p['qid']) for qid in p['notable_ids'][:20] if qid in cache['works'] and label(cache['works'][qid],'en')]
        if not works: works=p.get('meta',{}).get('works',[])[:]
        aid=p.get('openlibrary_id')
        if isinstance(aid,str) and re.fullmatch('OL[0-9]+A',aid) and not p.get('unverified_book_match'):
            if aid not in cache['openlibrary']:
                try:
                    data=request('https://openlibrary.org/authors/'+aid+'/works.json?limit=20')
                    cache['openlibrary'][aid]=[e for e in data.get('entries',[]) if any(a.get('author',{}).get('key')=='/authors/'+aid for a in e.get('authors',[]))]
                except Exception as exc: failed.append({'stage':'openlibrary','error':type(exc).__name__})
            seen={w.get('openlibrary_id') or w.get('url','').rsplit('/',1)[-1] for w in works}
            for e in cache['openlibrary'].get(aid,[]):
                key=e.get('key','')
                if not re.fullmatch('/works/OL[0-9]+W',key) or key.rsplit('/',1)[-1] in seen: continue
                works.append({'id':'openlibrary:'+key,'kind':'book','title':e.get('title'),'url':'https://openlibrary.org'+key,'role_fa':'نویسنده','thumbnail':'https://covers.openlibrary.org/b/id/'+str(e['covers'][0])+'-M.jpg' if e.get('covers') and e['covers'][0]>0 else '', 'source_url':'https://openlibrary.org'+key})
            p['meta']['social'].append({'kind':'website','label':'آثار در کتابخانهٔ باز','url':'https://openlibrary.org/authors/'+aid})
        p['meta']['works']=works;p['meta']['catalog_updated_at']=now
        if p['meta'].get('tmdb_id'): p['meta']['tmdb_id']=int(p['meta']['tmdb_id'])
        for book_person in people:
            if book_person.get('slug') in p.get('book_slugs',[]) and not p.get('unverified_book_match'):
                book_person['profile']=p['meta'];book_person['aliases']=p['aliases'];book_person['wikidata_id']=p['qid']
    public=[p for p in profiles.values() if not p.get('unverified_book_match')]
    write(root/'creator-profiles.json',{'updated_at':now,'people':public})
    write(root/'creator-catalog-status.json',{'updated_at':now,'requested':len(requests),'resolved':len(public),'with_photo':sum(bool(p['meta'].get('avatar')) for p in public),'with_works':sum(bool(p['meta'].get('works')) for p in public),'pending':len(requests)-len(public),'unresolved_sample':unresolved[:50],'source_failures':failed[:20]})
    if books:
        write(root/'books.json',books);(root/'books.js').write_text('window.__BOOKS_DATA__='+json.dumps(books,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    write(cache_path,cache)
    print('Creator catalog:',len(public),'verified identities;',sum(len(p['meta'].get('works',[])) for p in public),'sourced works;',len(failed),'source failures')
    return public

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--data-dir',type=Path,default=Path('site/data'));parser.add_argument('--limit',type=int,default=100)
    args=parser.parse_args();enrich(args.data_dir,args.limit)

"""Exact TMDB people identities, Persian labels and sourced film ratings."""
import argparse, csv, gzip, io, json, os, re, urllib.request
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor

FA = {229931:'اصغر فرهادی',559566:'پیمان معادی',240240:'لیلا حاتمی',229933:'شهاب حسینی',559567:'ساره بیات',1589296:'سارینا فرهادی',559568:'علی‌اصغر شهبازی',240243:'مریلا زارعی',41525:'بابک کریمی',240242:'کیمیا حسینی',559569:'شیرین یزدان‌بخش'}

def read(p, default):
    try: return json.loads(p.read_text(encoding='utf-8'))
    except (OSError, ValueError): return default

def write(p, value):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':')),encoding='utf-8')

def request(url, token=None):
    headers={'User-Agent':'Pendar Cinema/1.0'}
    if token: headers['Authorization']='Bearer '+token
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=20) as r: return json.load(r)

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--data-dir',default='site/data'); parser.add_argument('--limit',type=int,default=400)
    args=parser.parse_args(); root=Path(args.data_dir); now=datetime.now(timezone.utc).isoformat()
    people={}; films=read(root/'movie-master-top.json',{}).get('items',[]); wanted={x.get('imdb_id') for x in films if x.get('imdb_id')}
    for shard in (root/'movie-master-details').glob('*.json'):
        for film_id, film in read(shard,{}).items():
            for credit in film.get('credits',[]):
                pid=credit.get('id')
                if not isinstance(pid,int) or pid<=0: continue
                p=people.setdefault(str(pid),{'id':pid,'name':credit.get('name',''),'films':{},'roles':[]})
                p['films'].setdefault(film_id,[])
                role='بازیگر' if credit.get('kind')=='cast' else credit.get('role','')
                if role not in p['films'][film_id]: p['films'][film_id].append(role)
                if role not in p['roles']: p['roles'].append(role)
    cache_path=Path('backend/data/cinema-people-cache.json'); cache=read(cache_path,{})
    token=os.environ.get('TMDB_READ_TOKEN','')
    ranked=sorted(people,key=lambda k:(int(k) not in FA,-len(people[k]['films'])))
    pending=[k for k in ranked if k not in cache][:args.limit]
    def enrich(k):
        try:
            d=request('https://api.themoviedb.org/3/person/'+k+'?append_to_response=external_ids&language=fa-IR',token)
            qid=d.get('external_ids',{}).get('wikidata_id'); name_fa=FA.get(int(k),'')
            if not name_fa:
                name_fa=next((n for n in [d.get('name','')]+d.get('also_known_as',[]) if re.search('[پچژگکی]',n)), '')
            return k,{'name_fa':name_fa,'profile_path':d.get('profile_path'),'birthday':d.get('birthday'),'deathday':d.get('deathday'),'birthplace':d.get('place_of_birth'),'biography_fa':d.get('biography') if re.search('[\u0600-\u06ff]',d.get('biography','')) else '', 'wikidata_id':qid,'imdb_id':d.get('external_ids',{}).get('imdb_id'),'updated_at':now}
        except Exception: return k,None
    if token:
        with ThreadPoolExecutor(max_workers=4) as pool:
            for k,d in pool.map(enrich,pending):
                if d: cache[k]=d
    # Resolve Persian labels only through the person's exact Wikidata identity.
    qids={d['wikidata_id']:k for k,d in cache.items() if d.get('wikidata_id') and not d.get('name_fa')}
    keys=list(qids)
    for start in range(0,len(keys),50):
        try:
            data=request('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels&languages=fa&ids='+'|'.join(keys[start:start+50]))
            for q,d in data.get('entities',{}).items():
                label=d.get('labels',{}).get('fa',{}).get('value')
                if label: cache[qids[q]]['name_fa']=label
        except Exception: pass
    write(cache_path,cache)
    buckets=[{} for _ in range(64)]; index=[]
    for k,p in people.items():
        p.update(cache.get(k,{})); p['name_fa']=FA.get(int(k)) or p.get('name_fa',''); p['label_source']='Pendar' if int(k) in FA else 'TMDB / Wikidata'
        buckets[int(k)%64][k]=p
        index.append({key:p.get(key) for key in ('id','name','name_fa','profile_path','roles')})
    for i,b in enumerate(buckets): write(root/'cinema-people'/f'{i}.json',b)
    write(root/'cinema-people-index.json',{'updated_at':now,'people':index})
    for shard in (root/'movie-master-details').glob('*.json'):
        for film_id, film in read(shard,{}).items():
            if not re.fullmatch(r'p[mt]_[a-z0-9]+',film_id): continue
            for credit in film.get('credits',[]):
                person=buckets[int(credit.get('id',0))%64].get(str(credit.get('id')),{})
                credit['name_fa']=person.get('name_fa','')
                credit['profile_path']=person.get('profile_path')
            write(root/'movie-details'/f'{film_id}.json',film)
    ratings=read(root/'movie-ratings.json',{'items':{}}); items=ratings.setdefault('items',{})
    try:
        with urllib.request.urlopen('https://datasets.imdbws.com/title.ratings.tsv.gz',timeout=60) as r:
            with gzip.GzipFile(fileobj=r) as compressed:
                for row in csv.DictReader(io.TextIOWrapper(compressed,encoding='utf-8'),delimiter='\t'):
                    if row['tconst'] in wanted:
                        items.setdefault(row['tconst'],{})['imdb']={'value':float(row['averageRating']),'votes':int(row['numVotes']),'source':'https://datasets.imdbws.com/title.ratings.tsv.gz','updated_at':now}
    except Exception: print('IMDb refresh unavailable; preserving sourced previous ratings')
    omdb=os.environ.get('OMDB_API_KEY','')
    if omdb:
        for imdb in sorted(wanted)[:200]:
            if 'rotten_tomatoes' in items.get(imdb,{}): continue
            try:
                d=request('https://www.omdbapi.com/?apikey='+omdb+'&i='+imdb)
                if d.get('imdbID')!=imdb: continue
                for rating in d.get('Ratings',[]):
                    if rating.get('Source')=='Rotten Tomatoes' and re.fullmatch(r'\d{1,3}%',rating.get('Value','')):
                        value=int(rating['Value'][:-1])
                        if 0<=value<=100: items.setdefault(imdb,{})['rotten_tomatoes']={'value':value,'source':'OMDb / Rotten Tomatoes','updated_at':now}
            except Exception: pass
    ratings['updated_at']=now; write(root/'movie-ratings.json',ratings)
    print('Cinema people:',len(people),'Persian names:',sum(bool(p.get('name_fa')) for b in buckets for p in b.values()),'IMDb ratings:',sum('imdb' in x for x in items.values()),'Rotten Tomatoes:',sum('rotten_tomatoes' in x for x in items.values()))

if __name__=='__main__': main()

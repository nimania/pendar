"""Publish crawlable static routes from the same datasets used by the UI."""
import argparse, datetime, html, json, re, shutil
from pathlib import Path
from urllib.parse import quote, unquote

ORIGIN = 'https://pendar.io'
SECTIONS = {'headlines':'سرخط خبرها','books':'پیشخوان کتاب','movies':'جان فیلم','figures':'چهره‌ها','press':'پیشخوان جراید','tv':'راهنمای تماشا','knowledge':'دانش پندار','market':'پنداربازار','weather':'آب‌وهوا','faq':'راهنمای پندار','trends':'روند خبرها','iran':'خبرهای ایران','topics':'موضوعات'}
def text(value):
    if isinstance(value, dict): return str(value.get('text') or value.get('summary_fa') or value.get('name_fa') or value.get('name') or value.get('title_fa') or value.get('title') or '')
    if isinstance(value, list): return '\n'.join(text(x) for x in value)
    return re.sub(r'<[^>]*>', '', str(value or '')).strip()
def esc(value): return html.escape(text(value), quote=True)
def route(kind, key=''): return '/'+kind+'/' +(quote(str(key), safe='/')+'/' if key else '')
def read(path, default):
    if not path.exists(): return default
    return json.loads(path.read_text(encoding='utf-8'))
def array(data, key): return data if isinstance(data,list) else data.get(key,[]) if isinstance(data,dict) else []
def paragraphs(value): return ''.join('<p>'+esc(p)+'</p>' for p in text(value).split('\n') if p.strip())
def links(rows): return '<ul>'+''.join('<li><a href="'+esc(url)+'">'+esc(title)+'</a></li>' for url,title in rows)+'</ul>'
def build(site):
    site=Path(site); data=site/'data'; template=(site/'index.html').read_text()
    # Old generated pages are removed so deleted content becomes a real 404.
    prior=read(data/'seo-manifest.json',{})
    for path in prior.get('generated_paths',[]):
        if path and not path.startswith('/') and '..' not in Path(path).parts:
            target=site/path
            if target.is_file(): target.unlink()
    template=re.sub(r'<base[^>]*>', '', template)
    template=re.sub(r'<link[^>]*rel="canonical"[^>]*>', '', template)
    template=re.sub(r'<meta[^>]*(?:property="og:[^"]+"|name="(?:robots|twitter:[^"]+)")[^>]*>', '', template)
    template=re.sub(r'<script[^>]*id="seo-schema"[^>]*>[\s\S]*?</script>', '', template)
    template=re.sub(r'<section id="seo-static"[\s\S]*?</section><!-- seo-end -->', '', template)
    pages={}; aliases={}; catalogs={k:[] for k in SECTIONS}
    def add(kind,key,title,body,image=None,schema_type='WebPage',published=None,canonical=None):
        if not title or not key: return
        url=route(kind,key); description=text(body)[:170]
        content=paragraphs(body)
        if image and str(image).startswith(('https://','assets/')): content='<img src="'+esc(image)+'" alt="'+esc(title)+'" style="max-width:320px;height:auto">'+content
        pages[url]={'title':text(title),'description':description,'body':content,'kind':kind,'section':{'book':'books','movie':'movies','master-movie':'movies','figure':'figures','statement':'figures','entity':'figures','story':'headlines','press-article':'press','publisher':'books','book-person':'books'}.get(kind,kind),'image':image,'schema_type':schema_type,'published':published,'canonical':canonical or url,'indexable':len(text(body))>=80}
        section={'book':'books','movie':'movies','master-movie':'movies','figure':'figures','statement':'figures','entity':'figures','story':'headlines','press-article':'press','publisher':'books','book-person':'books'}.get(kind,kind)
        if section in catalogs: catalogs[section].append((url,text(title)))
    stories=array(read(data/'stories.json',[]),'stories')
    for s in stories:
        full=read(data/'story'/ (str(s.get('id'))+'.json'),s)
        add('story',s.get('id'),full.get('headline_fa'),full.get('summary_fa'),schema_type='Article',published=full.get('published_at'))
    # Deep stories can outlive the compact homepage feed.
    for p in sorted((data/'story').glob('*.json')):
        s=read(p,{}); add('story',s.get('id') or p.stem,s.get('headline_fa'),s.get('summary_fa'),schema_type='Article',published=s.get('published_at'))
    figures=array(read(data/'figures.json',{}),'figures')
    for f in figures:
        posts=f.get('posts') or []; body='\n'.join(filter(None,[text(f.get('bio_fa')),text(f.get('role_fa')),text(f.get('field_fa'))]))
        add('figure',f.get('handle'),f.get('name_fa'),body,f.get('avatar'),schema_type='ProfilePage')
        related=[]
        for p in posts:
            title=p.get('topic_fa') or p.get('headline_fa') or p.get('title_fa') or ('دیدگاه '+str(f.get('name_fa','')))
            add('statement',p.get('id'),title,'\n'.join(filter(None,[text(p.get('recap_fa')),text(p.get('summary_fa')),text(p.get('key_points')),text(p.get('text'))])),schema_type='Article',published=p.get('published_at'))
            if p.get('id'):related.append((route('statement',p['id']),title))
        url=route('figure',f.get('handle',''))
        if url in pages and related:pages[url]['body']+= '<h2>دیدگاه‌ها و گفته‌ها</h2>'+links(related);pages[url]['indexable']=True
    books=read(data/'books.json',{})
    for b in array(books,'books'):
        facts='\n'.join(text(b.get(k)) for k in ['description_fa','overview_fa','summary_fa','author','authors','translator','translators','publisher','year','isbn','creators','publisher_name'] if b.get(k))
        add('book',b.get('slug'),b.get('title_fa') or b.get('title'),facts,b.get('cover_url') or b.get('image_url'),schema_type='Book')
    for key,kind in [('people','book-person'),('publishers','publisher')]:
        for p in array(books,key): add(kind,p.get('slug'),p.get('name_fa'),'\n'.join(text(p.get(k)) for k in ['bio_fa','description_fa','address','website'] if p.get(k)),p.get('avatar') or p.get('logo'))
    movies=array(read(data/'movies.json',{}),'movies')
    showcase=read(data/'pendar-series-showcase.json',{})
    for row in showcase.get('items',[]):
        if row.get('slug') and not any(m.get('slug')==row['slug'] for m in movies):movies.append({'slug':row['slug'],'title_fa':row['title'],'type':'series','overview_fa':'سریال اختصاصی '+row['platform']+'؛ '+row.get('reason','')+'؛ آغاز پخش '+row.get('release_date','')+'. کارگردان: جمشید محمودی. تهیه‌کننده: نوید محمودی.','poster_url':row.get('poster_url')})
    for m in movies:
        body='\n'.join(text(m.get(k)) for k in ['overview_fa','overview_en','genres_fa','director','cast','year','country_fa'] if m.get(k))
        add('movie',m.get('slug'),m.get('title_fa') or m.get('original_title'),body,m.get('poster_url'),schema_type='TVSeries' if m.get('type')=='series' else 'Movie')
    masters={}
    for p in sorted((data/'movie-master-details').glob('*.json')):
        obj=read(p,{})
        rows=obj if isinstance(obj,list) else obj.get('items',list(obj.values()))
        for m in rows:
            if isinstance(m,dict) and m.get('pendar_id'):masters[m['pendar_id']]=m
    for m in array(read(data/'movie-master-top.json',{}),'items'):
        if m.get('hydrated'):masters.setdefault(m['pendar_id'],m)
    for key,m in masters.items():
        add('master-movie',key,m.get('title_fa') or m.get('title_en'),'\n'.join(text(m.get(k)) for k in ['overview_fa','overview_en','year','genres'] if m.get(k)),('https://image.tmdb.org/t/p/w500'+m['poster_path']) if m.get('poster_path') else None,schema_type='TVSeries' if m.get('media_type')=='series' else 'Movie')
    for a in array(read(data/'periodicals.json',[]),'items'):
        add('press-article',a.get('id'),a.get('headline_fa') or a.get('title_fa') or a.get('title_original'),'\n'.join(text(a.get(k)) for k in ['summary_fa','body_fa','longform_fa'] if a.get(k)),schema_type='Article',published=a.get('published_at'))
    entities=array(read(data/'entity-registry.json',{}),'entities')
    for e in entities:
        eid=e.get('id'); primary=None
        for ref in e.get('refs',[]):
            kind={'figures':'figure','books':'book','movies':'movie','books.people':'book-person','books.publishers':'publisher'}.get(ref.get('dataset'))
            candidate=route(kind,ref.get('key')) if kind else None
            if candidate in pages:primary=candidate;break
        meta=e.get('meta') or {}
        add('entity',eid,e.get('name_fa'),'\n'.join(text(meta.get(k)) for k in ['bio_fa','biography_fa','biography_en','description_fa','role_fa','field_fa','works'] if meta.get(k)),meta.get('avatar'),canonical=primary)
        url=route('entity',eid or '')
        if primary and url in pages:
            pages[url].update(body=pages[primary]['body'],description=pages[primary]['description'],indexable=False)
            aliases[url]=primary
    for filename,kind in [('pendar-festivals.json','festival'),('pendar-organizations.json','organization'),('pendar-topics.json','topic'),('pendar-collections.json','collection'),('pendar-paths.json','path'),('pendar-articles.json','article')]:
        for row in array(read(data/filename,[]),'items'):
            add('knowledge',kind+'/'+str(row.get('id','')),row.get('title') or row.get('name_fa'),'\n'.join(text(row.get(k)) for k in ['summary','description','body','notes','dateLabel'] if row.get(k)))
    for p in sorted((data/'movie-details').glob('*.json')):
        m=read(p,{})
        if m.get('pendar_id') and route('master-movie',m['pendar_id']) not in pages:
            add('master-movie',m['pendar_id'],m.get('title_fa') or m.get('title_en'),'\n'.join(text(m.get(k)) for k in ['overview_fa','overview_en','year','genres'] if m.get(k)),('https://image.tmdb.org/t/p/w500'+m['poster_path']) if m.get('poster_path') else None)
    # Every detail is reachable through paginated section indexes.
    for kind,title in SECTIONS.items():
        rows=catalogs[kind]; chunks=[rows[i:i+150] for i in range(0,len(rows),150)] or [[]]
        for n,chunk in enumerate(chunks,1):
            url=route(kind) if n==1 else route(kind,'page/'+str(n))
            paging=links([(route(kind) if i==1 else route(kind,'page/'+str(i)), 'صفحهٔ '+str(i)) for i in range(1,len(chunks)+1)]) if len(chunks)>1 else ''
            pages[url]={'title':title+(' — صفحهٔ '+str(n) if n>1 else ''),'description':title+' در پندار؛ مطالب، مشخصات و پیوندهای مرتبط.','body':'<p>'+esc(title+' در پندار')+'</p>'+links(chunk)+paging,'kind':kind,'canonical':url,'indexable':bool(rows) or kind in ['tv','knowledge','faq'],'schema_type':'CollectionPage'}
    if '/tv/' in pages:
        schedule=read(data/'pendar-watch-schedule.json',{})
        pages['/tv/']['body']+='<h2>برنامهٔ انتشار فیلم و سریال</h2>'+''.join('<p>'+esc(p.get('title_fa'))+' — '+esc(p.get('start','')[:10])+'</p>' for p in schedule.get('programmes',[])[:100])
    if '/faq/' in pages:
        pages['/faq/']['body']+=paragraphs('پندار خبرها و دیدگاه‌ها را با حفظ نام منابع گردآوری می‌کند. بخش چهره‌ها گفته‌ها و تحلیل‌ها را به گوینده نسبت می‌دهد. پیشخوان کتاب و جان فیلم مشخصات آثار و پیوندهای مرتبط را در اختیار خواننده می‌گذارند. زمان‌های راهنمای تماشا به ساعت ایران نمایش داده می‌شوند.')
    for section,variants in {'tv':['today','week','now','tonight','next','sports','channels','streaming','sources'],'books':['publishers','people','new','all','used','reviews'],'figures':['directory'],'knowledge':['home','people','topics','collections','paths','festivals','organizations'],'videos':['recaps']}.items():
        base=route(section)
        if base not in pages:continue
        for variant in variants:
            url=route(section,variant)
            if url not in pages:pages[url]={**pages[base],'canonical':base,'indexable':False}
    for e in entities:
        base=route('entity',e.get('id',''))
        if base in pages:
            for kind in ['profile','graph']:
                pages[route(kind,e['id'])]={**pages[base],'canonical':pages[base]['canonical'],'indexable':False}
    pages['/']={'title':'پندار؛ خبر، چهره‌ها، کتاب، فیلم و سریال','description':'پندار؛ خبر و اندیشه، دیدگاه چهره‌ها، پیشخوان کتاب و جراید، فیلم و سریال و راهنمای تماشا.','body':links([(route(k),v) for k,v in SECTIONS.items()])+ '<h2>تازه‌ترین خبرها</h2>'+links(catalogs['headlines'][:20]),'canonical':'/','indexable':True,'schema_type':'WebSite'}
    generated=[]; sitemap=[]
    for url,page in pages.items():
        canonical=ORIGIN+page['canonical']; title=page['title']+' | پندار'; desc=page['description']
        schema={'@context':'https://schema.org','@type':page['schema_type'],'name':page['title'],'url':canonical,'description':desc,'inLanguage':'fa-IR'}
        if schema['@type']=='Article':schema.update(headline=page['title'],publisher={'@type':'Organization','name':'پندار','url':ORIGIN})
        if page.get('published'):schema['datePublished']=page['published']
        if page.get('image'):schema['image']=page['image'] if page['image'].startswith('https://') else ORIGIN+'/'+page['image']
        # ProfilePage requires a mainEntity; keep a valid WebPage otherwise.
        if schema['@type']=='ProfilePage':schema['mainEntity']={'@type':'Person','name':page['title']}
        schema={'@context':'https://schema.org','@graph':[schema,{'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':1,'name':'پندار','item':ORIGIN+'/'},{'@type':'ListItem','position':2,'name':page['title'],'item':canonical}]}]}
        schema_text=json.dumps(schema,ensure_ascii=False).replace('<','\\u003c')
        head='<base href="/"><link rel="canonical" href="'+esc(canonical)+'"><meta name="robots" content="'+('index,follow,max-image-preview:large' if page['indexable'] else 'noindex,follow')+'"><meta property="og:type" content="'+('article' if page['schema_type']=='Article' else 'website')+'"><meta property="og:title" content="'+esc(title)+'"><meta property="og:description" content="'+esc(desc)+'"><meta property="og:url" content="'+esc(canonical)+'"><meta name="twitter:card" content="summary_large_image">'
        if schema['@graph'][0].get('image'):head+='<meta property="og:image" content="'+esc(schema['@graph'][0]['image'])+'">'
        head+='<script type="application/ld+json" id="seo-schema">'+schema_text+'</script>'
        out=re.sub(r'<title>.*?</title>',lambda _: '<title>'+esc(title)+'</title>',template,count=1)
        out=re.sub(r'<meta name="description"[^>]*>',lambda _: '<meta name="description" content="'+esc(desc)+'">',out,count=1)
        out=out.replace('</head>',head+'</head>')
        content='<section id="seo-static" class="wrap"><nav><a href="/">پندار</a> · <a href="/'+esc(page.get('section',page.get('kind','headlines')))+'/">'+esc(SECTIONS.get(page.get('section',page.get('kind')),'مطالب پندار'))+'</a></nav><h1>'+esc(page['title'])+'</h1>'+page['body']+'</section><!-- seo-end -->'
        out=out.replace('<main class="wrap">',content+'<main class="wrap">')
        # Prevent the app shell from painting below the readable static content.
        out=out.replace('</head>','<style>html:not(.app-ready) main.wrap{display:none}html.app-ready #seo-static{display:none}</style></head>')
        target=site/(unquote(url.strip('/'))+'/index.html' if url!='/' else 'index.html');target.parent.mkdir(parents=True,exist_ok=True);target.write_text(out,encoding='utf-8')
        metadata={'title':title,'canonical':canonical,'schema':schema,'tags':{'description':desc,'robots':('index,follow,max-image-preview:large' if page['indexable'] else 'noindex,follow'),'og:title':title,'og:description':desc,'og:url':canonical,'og:type':('article' if page['schema_type']=='Article' else 'website'),'og:image':schema['@graph'][0].get('image',ORIGIN+'/assets/pendar-logo.svg')}}
        (target.parent/'seo.json').write_text(json.dumps(metadata,ensure_ascii=False),encoding='utf-8')
        if url!='/':generated.extend([str(target.relative_to(site)),str((target.parent/'seo.json').relative_to(site))])
        if page['indexable'] and page['canonical']==url:sitemap.append(ORIGIN+url)
    sitemap_files=[]
    for n in range(0,len(sitemap),10000):
        name='sitemap-'+str(n//10000+1)+'.xml';sitemap_files.append(name)
        (site/name).write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+html.escape(u)+'</loc></url>' for u in sitemap[n:n+10000])+'</urlset>')
    (site/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<sitemap><loc>'+ORIGIN+'/'+x+'</loc></sitemap>' for x in sitemap_files)+'</sitemapindex>')
    (site/'robots.txt').write_text('User-agent: *\nAllow: /\nDisallow: /system/\nDisallow: /finance/\nSitemap: '+ORIGIN+'/sitemap.xml\n')
    (data/'seo-manifest.json').write_text(json.dumps({'generated_paths':generated,'pages':len(pages),'indexable':len(sitemap),'aliases':aliases},ensure_ascii=False))
    print('SEO: '+str(len(pages))+' HTML pages; '+str(len(sitemap))+' canonical sitemap URLs')
    assert len(sitemap)>1, 'SEO sitemap unexpectedly empty'
    return pages
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--site',required=True);build(parser.parse_args().site)

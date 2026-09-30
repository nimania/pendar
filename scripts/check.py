"""Check generated links and data relationships before publishing."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist'
class Links(HTMLParser):
 def handle_starttag(self,tag,attrs):
  for name,value in attrs:
   if name not in ('href','src','action') or not value:continue
   u=urlsplit(value)
   if u.scheme or u.netloc or value.startswith('#'):continue
   path=unquote(u.path)
   candidate=(OUT/path.removeprefix('/pendar/')) if path.startswith('/pendar/') else self.file.parent/path
   if path.endswith('/') or candidate.is_dir():candidate=candidate/'index.html'
   assert candidate.exists(),f'{self.file.relative_to(OUT)}: missing {value}'
parser=Links()
for f in OUT.rglob('*.html'):parser.file=f;parser.feed(f.read_text())
topics={x['id'] for x in json.loads((ROOT/'data/topics.json').read_text())}
for name in ['books','people','figures','organizations','articles','collections','paths','festivals']:
 xs=json.loads((ROOT/'data'/f'{name}.json').read_text());assert len({x['id'] for x in xs})==len(xs)
 for x in xs:
  assert set(x.get('topicIds',[]))<=topics,(name,x['id'])
print(f'Passed: {len(list(OUT.rglob("*.html")))} HTML files, local links, record IDs and topic references')

figures=json.loads((ROOT/'data/figures.json').read_text())
figure_ids={x['id'] for x in figures}
for x in figures:
 assert x['sources'] and x['biography'] and x['timeline'],x['id']
 assert set(x['relatedIds'])<=figure_ids,x['id']
 index=json.loads((OUT/'assets/search-index.json').read_text())
 assert any(r['kind']=='figure' and r['url']==f"figures/{x['id']}/" for r in index),x['id']
print(f'Passed: {len(figures)} sourced figure profiles, related figures and search entries')

"""Read only the registered-voter generic ballot from primary Ipsos PDF tables.

Unknown layouts fail closed. Israel graphic polls remain reviewed snapshots.
"""
import argparse
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from io import BytesIO
import json
from pathlib import Path
import re
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
ROOT=Path(__file__).resolve().parents[2]
INDEX='https://www.ipsos.com/en-us/latest-us-opinion-polls'
class Links(HTMLParser):
    def __init__(self): super().__init__();self.urls=[]
    def handle_starttag(self, tag, attrs):
        if tag=='a' and dict(attrs).get('href'): self.urls.append(unescape(dict(attrs)['href']))
def get(url):
    if urlparse(url).hostname not in ('www.ipsos.com','ipsos.com'): raise ValueError('Unapproved source')
    with urlopen(Request(url,headers={'User-Agent':'Pendar-Radar/1.0'}),timeout=15) as r:
        if urlparse(r.url).hostname not in ('www.ipsos.com','ipsos.com'): raise ValueError('Unapproved redirect')
        return r.read(5_000_000)
def parse_poll(text):
    # Fix scope and column order before reading any value; second column is RV.
    section=re.search(r'TM3287Y24\.(.*?)(?=TM\d{4}|Approval5|$)',text,re.S)
    if not section: raise ValueError('Generic ballot question missing')
    block=section.group(1)
    if not re.search(r'Total\s*\(N=[\d,]+\)\s*RV\s*\(N=[\d,]+\)\s*Rep',block):
        raise ValueError('Unrecognized table columns')
    values={}
    for key,name in [('d','Democratic'),('r','Republican')]:
        row=re.search(name+r'\s+candidate\s+(\d+)%\s+(\d+)%',block)
        if not row: raise ValueError('Ballot row missing')
        values[key]=int(row.group(2))
    if not all(0<=v<=100 for v in values.values()) or sum(values.values())>100: raise ValueError('Invalid percentages')
    date=re.search(r'Interview dates:\s*([A-Za-z]+)\s+(\d+)(?:\s*(?:[-–]|to)\s*(?:([A-Za-z]+)\s+)?(\d+))?,?\s+(20\d{2})',text)
    if not date: raise ValueError('Fieldwork date missing')
    month=date.group(3) or date.group(1); day=date.group(4) or date.group(2)
    end=datetime.strptime(f'{month} {day} {date.group(5)}','%B %d %Y').date().isoformat()
    if end>datetime.now(timezone.utc).date().isoformat(): raise ValueError('Future poll')
    return {'date':end,'values':values}
def collect(path):
    from pypdf import PdfReader
    current=json.loads(path.read_text());found=[]
    parser=Links();parser.feed(get(INDEX).decode('utf-8',errors='replace'))
    urls=list(dict.fromkeys(urljoin(INDEX,u) for u in parser.urls if '/en-us/reutersipsos-' in u))[:8]
    for url in urls:
        try:
            page=get(url).decode('utf-8',errors='replace');links=Links();links.feed(page)
            pdfs=list(dict.fromkeys(urljoin(url,u) for u in links.urls if '.pdf' in u.lower()))[-2:]
            for pdf in pdfs:
                try:
                    text='\n'.join(p.extract_text() or '' for p in PdfReader(BytesIO(get(pdf))).pages)
                    point=parse_poll(text);point.update(url=pdf,source='Reuters/Ipsos');found.append(point)
                except Exception as exc: print('Poll retained:',type(exc).__name__,pdf)
        except Exception as exc: print('Source unavailable:',type(exc).__name__,url)
    known={p['date']:p for p in current.get('generic_polls',[])}
    for p in found: known[p['date']]=p
    if not known: return
    current['generic_polls']=sorted(known.values(),key=lambda p:p['date'])
    latest=current['generic_polls'][-1]
    if latest['date']>=current.get('generic_date',''):
        current['generic']={**current['generic'],**latest['values'],'label':'Reuters/Ipsos · '+latest['date']}
        current['generic_date']=latest['date'];current['generic_source_url']=latest['url']
        if any(p['date']==latest['date'] and p['values']==latest['values'] for p in found): current['generic_reviewed_at']=datetime.now(timezone.utc).isoformat()
    path.write_text(json.dumps(current,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--data',default=str(ROOT/'web-static/data/us-radar.json'));args=ap.parse_args()
    try: collect(Path(args.data))
    except Exception as exc: print('Existing poll preserved:',type(exc).__name__)

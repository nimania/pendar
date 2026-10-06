"""Prioritize exact indexed works of Pendar creators in the master database."""
import argparse,sqlite3
from pathlib import Path
from collections import Counter
from reconcile_creator_works import read

FOCUS={'person:wd-q803646','person:wd-q255510','person:wd-q2263'}
def queue(db,audit_path):
    audit=read(audit_path,{})
    if not audit.get('scope'): raise ValueError('A real reconciliation report is required')
    scores=Counter()
    for row in audit.get('works',[]):
        if row.get('kind') not in ('movie','film','tv','series'): continue
        target=row.get('target_id')
        if not target and row.get('tmdb_id'):
            from build_movie_master import pendar_id
            target=pendar_id('series' if row['kind'] in ('tv','series') else 'movie',int(row['tmdb_id']))
        if target: scores[target]+=1000000 if row['person_id'] in FOCUS or any(row['person_id'].endswith('-'+focus.rsplit('-',1)[1]) for focus in FOCUS) else 1
    con=sqlite3.connect(db)
    con.execute('CREATE TABLE IF NOT EXISTS creator_priority(pendar_id TEXT PRIMARY KEY,score INTEGER NOT NULL)')
    con.execute('DELETE FROM creator_priority')
    con.executemany('INSERT INTO creator_priority SELECT pendar_id,? FROM titles WHERE pendar_id=? AND active=1',[(score,pid) for pid,score in scores.items()])
    stats=dict(zip(('requested','pending'),con.execute('SELECT COUNT(*),SUM(t.hydrated=0) FROM creator_priority p JOIN titles t USING(pendar_id)').fetchone()))
    con.commit();con.close();print('Creator movie queue:',stats);return stats

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--db',type=Path,required=True);p.add_argument('--audit',type=Path,required=True)
    a=p.parse_args();queue(a.db,a.audit)

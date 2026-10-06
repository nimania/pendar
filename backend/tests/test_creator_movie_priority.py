import json,sys,sqlite3,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build_movie_master import SCHEMA
from hydrate_movie_master import ensure_columns,select_rows,write_public
from queue_creator_movies import queue

class MoviePriorityTests(unittest.TestCase):
    def test_creator_priority_typed_ids_and_export_outside_top(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);db=root/'db.sqlite';con=sqlite3.connect(db);con.executescript(SCHEMA);ensure_columns(con)
            for pid,kind,pop,hydrated in [('pm_c','movie',0,0),('pt_c','series',999,0),('pm_d','movie',1,1),('pm_e','movie',999,1)]:
                con.execute('INSERT INTO titles(pendar_id,media_type,tmdb_id,popularity,hydrated,source_date,first_seen_at,last_seen_at,tmdb_payload_json) VALUES(?,?,?,?,?,?,?,?,?)',(pid,kind,int(pid[3:],36),pop,hydrated,'now','now','now','{}'))
            con.commit()
            audit=root/'audit.json';audit.write_text(json.dumps({'scope':{'movie_index':'full_master'},'works':[{'person_id':'person:wd-q803646','kind':'movie','target_id':'pm_c'}]}))
            queue(db,audit)
            self.assertEqual(select_rows(con,1,3)[0]['pendar_id'],'pm_c')
            write_public(con,root/'summary.json',root/'top.json',1)
            top=json.loads((root/'top.json').read_text())['items'];self.assertEqual(len(top),1);self.assertEqual(top[0]['pendar_id'],'pm_e')
            details=json.loads((root/'movie-master-details/13.json').read_text());self.assertIn('pm_d',details)
            self.assertNotIn('pt_c',details)
            con.close()

if __name__=='__main__':unittest.main()

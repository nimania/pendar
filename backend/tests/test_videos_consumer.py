"""Contract tests for Pendar as a read-only consumer of Nimania Videos."""
import ast
import io
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
SCRIPT=ROOT/'scripts'/'collect_external_figures.py'
TEXT=SCRIPT.read_text(encoding='utf-8')

class VideosConsumerTests(unittest.TestCase):
 def _loader(self,temp):
  src=ast.parse(TEXT)
  funcs=[x for x in src.body if isinstance(x,ast.FunctionDef) and x.name=='load_videos_catalog']
  self.assertEqual(len(funcs),1)
  module=ast.Module(body=funcs,type_ignores=[])
  namespace={
    'YOUTUBE_CATALOG_OUT':Path(temp)/'youtube-videos.json',
    'VIDEOS_OWNED_CATALOG':'https://nimania.github.io/videos/data/pendar-youtube-videos.json',
    'FIGURES':[SimpleNamespace(handle='source-channel-one-tv')],
    'json':json,
    're':__import__('re'),
  }
  exec(compile(module,str(SCRIPT),'exec'),namespace)
  return namespace['load_videos_catalog'],namespace['YOUTUBE_CATALOG_OUT']
 def test_separation_of_collection_ownership(self):
  self.assertNotIn('collect_youtube_catalog',TEXT)
  self.assertNotIn('youtube.com/feeds/videos.xml',TEXT)
  self.assertIn('nimania.github.io/videos/data/pendar-youtube-videos.json',TEXT)
 def test_import_and_cache_catalog_without_youtube_discovery(self):
  with tempfile.TemporaryDirectory() as t:
   loader,target=self._loader(t)
   feed=[{'id':f'{i:011d}','handle':'source-channel-one-tv',
          'url':f'https://www.youtube.com/watch?v={i:011d}',
          'title':'گفت‌وگو'} for i in range(210)]
   class Response:
    status=200
    def __enter__(self):return self
    def __exit__(self,*_):pass
    def read(self,_):return json.dumps(feed).encode()
   with patch('urllib.request.urlopen',return_value=Response()) as opening:
    result=loader()
   self.assertEqual(len(result),210)
   self.assertTrue(target.exists())
   self.assertEqual(opening.call_args.args[0].full_url,'https://nimania.github.io/videos/data/pendar-youtube-videos.json')
 def test_outage_keeps_last_known_good_rows(self):
  with tempfile.TemporaryDirectory() as t:
   loader,target=self._loader(t)
   expected=[{'id':'abcdefghijk','handle':'source-channel-one-tv','title':'قدیمی'}]
   target.write_text(json.dumps(expected))
   with patch('urllib.request.urlopen',side_effect=OSError('offline')):
    self.assertEqual(loader(),expected)
 def test_bad_or_empty_feed_keeps_cache(self):
  with tempfile.TemporaryDirectory() as t:
   loader,target=self._loader(t)
   target.write_text(json.dumps([{'id':'abcdefghijk','handle':'source-channel-one-tv'}]))
   class Response:
    status=200
    def __enter__(self):return self
    def __exit__(self,*_):pass
    def read(self,_):return b'[]'
   with patch('urllib.request.urlopen',return_value=Response()):
    self.assertEqual(len(loader()),1)

if __name__=='__main__':unittest.main()

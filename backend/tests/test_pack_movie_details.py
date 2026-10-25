"""Offline regression tests for lossless, size-reducing movie detail shards."""
import gzip
import json
import tempfile
import unittest
from pathlib import Path

from backend.scripts.pack_movie_details import pack, bucket


class MovieDetailShardTests(unittest.TestCase):
    def test_round_trip_every_credit_and_remove_only_verified_copies(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "data" / "movie-details"
            source.mkdir(parents=True)
            expected = {}
            for i in range(150):
                pendar_id = ("pm_" if i % 2 else "pt_") + format(i + 100, "x")
                record = {
                    "pendar_id": pendar_id,
                    "title_fa": "داستانی فارسی بلند " * 70,
                    "credits": [{"id": i + 3000, "person_id": "person:tmdb-" + str(i+3000),
                                 "name_fa": "هنرپیشهٔ فارسی", "role": "acting"}],
                    "other": {"review": "A very detailed review " * 40},
                }
                expected[pendar_id] = record
                (source / (pendar_id + ".json")).write_text(
                    json.dumps(record, ensure_ascii=False), encoding="utf-8"
                )
            stats = pack(root, minimum=100)
            self.assertEqual(stats["records"], 150)
            self.assertEqual(stats["shards"], 64)
            self.assertLess(stats["packed_bytes"], stats["original_bytes"])
            self.assertFalse(source.exists())
            collected = {}
            for shard in range(64):
                item = root / "data" / "movie-detail-shards" / f"{shard}.json.gz"
                self.assertTrue(item.is_file())
                with gzip.open(item, "rt", encoding="utf-8") as reader:
                    rows = json.load(reader)
                    self.assertTrue(all(bucket(k) == shard for k in rows))
                    collected.update(rows)
            self.assertEqual(collected, expected)

    def test_bad_movie_detail_cannot_delete_originals(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "data" / "movie-details"
            source.mkdir(parents=True)
            file = source / "pm_123.json"
            file.write_text('{"pendar_id":"pm_mismatch","credits":[]}')
            with self.assertRaisesRegex(ValueError, "mismatch"):
                pack(root, minimum=1)
            self.assertTrue(file.exists())
            self.assertFalse((root/"data"/"movie-detail-shards").exists())

    def test_too_small_catalog_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/"data"/"movie-details").mkdir(parents=True)
            with self.assertRaisesRegex(ValueError, "only 0 files"):
                pack(root, minimum=5)


if __name__ == "__main__":
    unittest.main()

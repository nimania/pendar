import io
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from prepare_priority_site import prepare, required_data
from restore_core_site_data import missing, restore


class CoreRecoveryTests(unittest.TestCase):
    def test_recovery_then_trim_preserves_data_needed_for_profiles_and_catalogs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            site = root / "site"
            (site / "data").mkdir(parents=True)
            (site / "index.html").write_text("shell")
            (site / "data/stories.json").write_text('[{"id":"current"}]')
            archive = root / "backup.tar"
            entries = {f"data/{name}": b"{}" for name in required_data}
            entries["data/books.json"] = b'[]' + b' ' * 5_000_001
            for folder in ("people", "person-aliases"):
                for i in range(64):
                    entries[f"data/{folder}/{i}.json"] = b"{}"
            entries.update({"data/press-directory.js": b"directory",
                            "data/studio-recaps.json": b"[]",
                            "data/entities.json": b"[]",
                            "data/movie-details/pm_1.json": b"{}",
                            "data/creator-work-audit.json": b"private audit",
                            "../escaped.txt": b"unsafe",
                            "data/people/../../escaped.txt": b"unsafe"})
            with tarfile.open(archive, "w") as tar:
                for path, data in entries.items():
                    member = tarfile.TarInfo(path)
                    member.size = len(data)
                    tar.addfile(member, io.BytesIO(data))
            restore(site, archive)
            self.assertEqual(missing(site), [])
            prepare(site)
            self.assertEqual((site / "data/stories.json").read_text(), '[{"id":"current"}]')
            self.assertGreater((site / "data/books.json").stat().st_size, 5_000_000)
            for path in ("people/0.json", "person-aliases/63.json", "press-directory.js",
                         "studio-recaps.json", "movie-details/pm_1.json", "entities.json"):
                self.assertTrue((site / "data" / path).is_file(), path)
            self.assertFalse((site / "data/creator-work-audit.json").exists())
            self.assertFalse((root / "escaped.txt").exists())
            # Integrity validation creates the health report after preparation.
            self.assertFalse((site / "data/system-health.json").exists())

    def test_incomplete_payload_fails_before_deleting_anything(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text("shell")
            (root / "optional").mkdir()
            with self.assertRaises(SystemExit):
                prepare(root)
            self.assertTrue((root / "optional").is_dir())


if __name__ == "__main__":
    unittest.main()

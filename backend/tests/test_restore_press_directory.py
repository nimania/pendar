"""Offline tests for recovery of the genuine previously-published press directory."""
import json
import tempfile
import unittest
from pathlib import Path

from backend.scripts.restore_press_directory import restore, validate


def directory(count=25):
    return [{"source_name": f"Publisher {i}", "count": i + 1,
             "latest_at": "2026-10-20T00:00:00Z"} for i in range(count)]


class PressDirectoryRecoveryTests(unittest.TestCase):
    def test_rejects_empty_and_duplicate_and_synthetic_counts(self):
        self.assertFalse(validate(directory(19)))
        bad = directory()
        bad[1]["source_name"] = bad[0]["source_name"]
        self.assertFalse(validate(bad))
        bad = directory()
        bad[0]["count"] = "24"
        self.assertFalse(validate(bad))

    def test_preserves_valid_current_data_without_network(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            (path/"data").mkdir()
            (path/"data"/"press-directory.json").write_text(
                json.dumps(directory()), encoding="utf-8")
            self.assertEqual(restore(path, fetch=lambda: self.fail("Must not fetch")), 25)

    def test_recovers_verified_published_data_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            self.assertEqual(
                restore(path, fetch=lambda: json.dumps(directory()).encode("utf-8")), 25)
            saved = json.loads((path/"data"/"press-directory.json").read_text(encoding="utf-8"))
            self.assertEqual(len(saved), 25)
            self.assertIn("window.__PRESS_DIRECTORY__=", (path/"data"/"press-directory.js").read_text(encoding="utf-8"))

    def test_failed_fetch_does_not_create_placeholder(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            self.assertEqual(
                restore(path, fetch=lambda: json.dumps(directory(3)).encode("utf-8")), 0)
            self.assertFalse((path/"data"/"press-directory.json").exists())


if __name__ == "__main__":
    unittest.main()

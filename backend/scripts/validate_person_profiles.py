#!/usr/bin/env python3
"""Reject a publish whose person directory cannot resolve its own profile links."""
import argparse
import json
from collections import defaultdict
from pathlib import Path

def validate(root):
    registry = json.loads((root / "entity-registry.json").read_text())
    partition = registry.get("partitions", {}).get("person")
    assert partition and partition.get("buckets") == 64, "Missing canonical person partitions"
    directory = json.loads((root / partition["index"]).read_text())
    rows = directory["people"]
    assert rows, "Empty person directory"
    grouped = defaultdict(list)
    for row in rows:
        grouped[int(row["tmdb_id"]) % 64].append(row)
    seen = 0
    for bucket in range(64):
        records = json.loads((root / partition["path"] / f"{bucket}.json").read_text())
        # Name resolution uses the same complete set of published partitions.
        aliases = json.loads((root / "person-aliases" / f"{bucket}.json").read_text())
        assert isinstance(aliases, dict), f"Invalid alias partition {bucket}"
        for row in grouped[bucket]:
            record = records.get(str(row["tmdb_id"]))
            assert record, f"Missing profile {row['tmdb_id']} in partition {bucket}"
            assert record.get("type") == "person", f"Unmerged profile {row['tmdb_id']}"
            assert record.get("id") == row["id"], f"Wrong canonical identity {row['tmdb_id']}"
            assert record.get("name_fa"), f"Unnamed profile {row['tmdb_id']}"
            seen += 1
    assert directory["count"] == registry["counts"]["person"] == partition["total"], "Person count mismatch"
    print(f"Validated {seen} person profile links across 64 partitions")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("site/data"))
    validate(parser.parse_args().data_dir)

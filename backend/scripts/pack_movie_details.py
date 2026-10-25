#!/usr/bin/env python3
"""Losslessly pack generated movie-detail JSON into compact gzip shards.

Only the generated Pages payload is modified, never the source catalog or
stored historical data. Original per-movie files are removed only after every
record has been validated in its compressed shard. The browser loader reads
these shards; canonical movie pages and all SEO HTML remain unchanged.
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import shutil
import tempfile
from pathlib import Path

SHARDS = 64
ID = re.compile(r"p[mt]_[0-9a-z]+\Z")


def bucket(pendar_id: str) -> int:
    return sum(pendar_id.encode("ascii")) % SHARDS


def pack(site: Path, *, minimum: int = 1000) -> dict:
    data = Path(site) / "data"
    source = data / "movie-details"
    target = data / "movie-detail-shards"
    files = sorted(source.glob("*.json")) if source.is_dir() else []
    if len(files) < minimum:
        raise ValueError(f"Refusing to replace movie details: only {len(files)} files, required {minimum}")
    raw_bytes = sum(p.stat().st_size for p in files)

    # Stage the output in a temporary directory so failures retain originals.
    with tempfile.TemporaryDirectory(prefix=".movie-shards-staging-", dir=data) as tmp:
        stage = Path(tmp)
        handles = []
        first = [True] * SHARDS
        try:
            for shard in range(SHARDS):
                handle = (stage / f"{shard}.json").open("w", encoding="utf-8")
                handle.write("{")
                handles.append(handle)
            for item in files:
                pendar_id = item.stem
                if not ID.fullmatch(pendar_id):
                    raise ValueError(f"Invalid movie-detail identifier: {item.name}")
                value = json.loads(item.read_text(encoding="utf-8"))
                if not isinstance(value, dict):
                    raise ValueError(f"Invalid detail record: {item.name}")
                if value.get("pendar_id") not in (None, pendar_id):
                    raise ValueError(f"Movie detail mismatch: {item.name}")
                shard = bucket(pendar_id)
                handle = handles[shard]
                if not first[shard]:
                    handle.write(",")
                handle.write(json.dumps(pendar_id, ensure_ascii=False))
                handle.write(":")
                handle.write(json.dumps(value, ensure_ascii=False, separators=(",", ":")))
                first[shard] = False
        finally:
            for handle in handles:
                handle.write("}")
                handle.close()

        staged_count = 0
        compact_bytes = 0
        for shard in range(SHARDS):
            source_file = stage / f"{shard}.json"
            packed_file = stage / f"{shard}.json.gz"
            with source_file.open("rb") as input_file, packed_file.open("wb") as output_file:
                with gzip.GzipFile(filename="", mode="wb", fileobj=output_file, compresslevel=6, mtime=0) as zipper:
                    shutil.copyfileobj(input_file, zipper, length=1024*1024)
            # Verify every record actually round-trips, including its identity.
            with gzip.open(packed_file, "rt", encoding="utf-8") as input_file:
                restored = json.load(input_file)
            if not isinstance(restored, dict):
                raise ValueError(f"Invalid decompressed shard {shard}")
            if any(bucket(k) != shard or not ID.fullmatch(k) or not isinstance(v, dict)
                   for k, v in restored.items()):
                raise ValueError(f"Incorrect identity inside movie-detail shard {shard}")
            staged_count += len(restored)
            compact_bytes += packed_file.stat().st_size
            source_file.unlink()

        if staged_count != len(files):
            raise ValueError(f"Detail packing lost records: {staged_count}/{len(files)}")

        old = data / ".movie-detail-shards-previous"
        if old.exists():
            shutil.rmtree(old)
        if target.exists():
            target.rename(old)
        try:
            stage_target = stage / "shards"
            stage_target.mkdir()
            for packed_file in stage.glob("*.json.gz"):
                packed_file.rename(stage_target / packed_file.name)
            stage_target.rename(target)
        except Exception:
            if old.exists() and not target.exists():
                old.rename(target)
            raise
        if old.exists():
            shutil.rmtree(old)

    # Archive is fully recoverable. Delete only generated copies, not source data.
    shutil.rmtree(source)
    report = {
        "records": staged_count,
        "shards": SHARDS,
        "original_bytes": raw_bytes,
        "packed_bytes": compact_bytes,
        "saved_bytes": raw_bytes - compact_bytes,
    }
    (data / "movie-detail-shards-manifest.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("Movie details packed losslessly: "
          f"{staged_count:,} records, {raw_bytes/1e6:.1f} -> "
          f"{compact_bytes/1e6:.1f} MB ({(raw_bytes-compact_bytes)/1e6:.1f} MB saved).",
          flush=True)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--minimum", type=int, default=1000)
    args = parser.parse_args()
    pack(args.site, minimum=args.minimum)

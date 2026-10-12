"""Recover UI datasets from a verified complete artifact without replacing news.

Only missing retained data paths are restored; no collectors or APIs are run.
"""
import argparse
import shutil
import tarfile
from pathlib import Path, PurePosixPath

from prepare_priority_site import keep_data_dirs, keep_data_file, required_data


def missing(root):
    data = Path(root) / "data"
    paths = [name for name in required_data if not (data / name).is_file()]
    # Every bucket is generated, including empty ones, for exact identity lookup.
    for folder in ("people", "person-aliases"):
        paths.extend(f"{folder}/{i}.json" for i in range(64)
                     if not (data / folder / f"{i}.json").is_file()
                     and not (data / folder / f"{i}.json.gz").is_file())
    return paths


def restore(root, archive):
    root = Path(root)
    restored = 0
    with tarfile.open(archive) as tar:
        for member in tar:
            path = PurePosixPath(member.name)
            parts = path.parts
            if not member.isfile() or ".." in parts or path.is_absolute():
                continue
            if not parts or parts[0] != "data" or len(parts) < 2:
                continue
            selected = (len(parts) == 2 and keep_data_file(parts[1])) or (
                len(parts) == 3 and parts[1] in keep_data_dirs and parts[1] != "story")
            target = root.joinpath(*parts)
            if not selected or target.exists() or target.with_suffix(target.suffix + ".gz").is_file():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(member) as src, target.open("wb") as dst:
                shutil.copyfileobj(src, dst)
            restored += 1
    remaining = missing(root)
    if remaining:
        raise SystemExit("::error::Core recovery incomplete: " + ", ".join(remaining[:12]))
    print(f"Recovered {restored} missing core data files; existing snapshots preserved.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True, type=Path)
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        paths = missing(args.site)
        print("Missing core data: " + ", ".join(paths[:12]) if paths else "Core data present.")
        raise SystemExit(bool(paths))
    if not args.archive:
        parser.error("--archive is required for recovery")
    restore(args.site, args.archive)

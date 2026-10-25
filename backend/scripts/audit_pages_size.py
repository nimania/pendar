"""Fail safely before GitHub Pages upload and diagnose the source of payload growth.

Read-only audit: does not delete, relocate, or compress any published file.
"""
from collections import defaultdict
from pathlib import Path
import json
import sys

root = Path(sys.argv[1])
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 750_000_000
files = [(p.stat().st_size, p) for p in root.rglob("*") if p.is_file()]
total = sum(n for n, _ in files)
print(f"Pages publish footprint: {total:,} bytes ({total/1e6:.1f} MB), {len(files):,} files", flush=True)

for n, p in sorted(files, reverse=True)[:35]:
    print(f"  {n/1e6:9.2f} MB  {p.relative_to(root)}", flush=True)

sizes = defaultdict(lambda: [0, 0])
for n, p in files:
    rel = p.relative_to(root)
    for depth in (1, 2):
        if len(rel.parts) >= depth:
            key = "/".join(rel.parts[:depth])
            sizes[key][0] += n
            sizes[key][1] += 1

print("Top root directories:", flush=True)
for name, (amount, count) in sorted(
    ((k, v) for k, v in sizes.items() if "/" not in k),
    key=lambda item: -item[1][0]
)[:18]:
    print(f"  {amount/1e6:9.2f} MB  {count:8,d} files  {name}", flush=True)

print("Top second-level directory buckets:", flush=True)
for name, (amount, count) in sorted(
    ((k, v) for k, v in sizes.items() if "/" in k),
    key=lambda item: -item[1][0]
)[:35]:
    print(f"  {amount/1e6:9.2f} MB  {count:8,d} files  {name}", flush=True)

manifest_path = root / "data" / "seo-manifest.json"
seo = {}
if manifest_path.is_file():
    try:
        m = json.loads(manifest_path.read_text(encoding="utf-8"))
        seo = {
            "generated_pages": m.get("pages"),
            "indexable_pages": m.get("indexable"),
            "generated_files": len(m.get("generated_paths") or []),
        }
        print("SEO manifest:", seo, flush=True)
    except (OSError, ValueError) as exc:
        print(f"::warning::Unable to inspect SEO manifest: {exc}", flush=True)

report = {
    "bytes": total,
    "files": len(files),
    "safe_limit_bytes": limit,
    "largest_files": [
        {"path": str(p.relative_to(root)), "bytes": n}
        for n, p in sorted(files, reverse=True)[:35]
    ],
    "buckets": {
        key: {"bytes": value[0], "files": value[1]}
        for key, value in sizes.items()
    },
    "seo": seo,
}
Path("pages-payload-audit.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
)
if total > 600_000_000:
    print(
        f"::warning::Pages footprint {total/1e6:.1f} MB exceeds the 600 MB early-warning threshold; inspect archive growth.",
        flush=True,
    )
if total > limit:
    sys.exit(
        f"::error::Publish exceeds {limit/1e6:.0f} MB safe limit; see largest files and second-level bucket totals above."
    )

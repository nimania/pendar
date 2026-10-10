"""Fail safely before GitHub Pages upload and identify largest publish files."""
from pathlib import Path
import sys
root=Path(sys.argv[1]);limit=int(sys.argv[2]) if len(sys.argv)>2 else 750_000_000
files=[(p.stat().st_size,p) for p in root.rglob("*") if p.is_file()]
total=sum(n for n,_ in files)
print(f"Pages publish footprint: {total:,} bytes ({total/1e6:.1f} MB), {len(files):,} files",flush=True)
for n,p in sorted(files,reverse=True)[:35]:
    print(f"  {n/1e6:9.2f} MB  {p.relative_to(root)}",flush=True)
from collections import defaultdict
dirs=defaultdict(int)
for n,p in files:
    rel=p.relative_to(root)
    dirs[str(rel.parts[0]) if rel.parts else "."]+=n
print("Top root directories:",flush=True)
for name,n in sorted(dirs.items(),key=lambda x:-x[1])[:18]:print(f"  {n/1e6:9.2f} MB  {name}",flush=True)
if total>limit:sys.exit(f"::error::Publish exceeds {limit/1e6:.0f} MB safe limit; see largest files above.")

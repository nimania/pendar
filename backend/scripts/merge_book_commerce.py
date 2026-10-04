"""Merge cached Torob commerce fields into a fresher books catalog."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    p=argparse.ArgumentParser()
    p.add_argument("--source", required=True)
    p.add_argument("--target", required=True)
    p.add_argument("--target-js")
    args=p.parse_args()

    srcp=Path(args.source)
    dstp=Path(args.target)
    if not srcp.exists() or not dstp.exists():
        print("book commerce merge: source or target missing; skipped")
        return

    src=json.loads(srcp.read_text(encoding="utf-8"))
    dst=json.loads(dstp.read_text(encoding="utf-8"))
    cached={
        str(x.get("slug")):x for x in (src.get("books") or [])
        if isinstance(x,dict) and x.get("slug")
    }
    merged=0
    for b in dst.get("books") or []:
        old=cached.get(str(b.get("slug")))
        if not old:
            continue
        incoming=old.get("torob") or {}
        current=b.get("torob") or {}
        use=False
        if incoming:
            if incoming.get("matched") and not current.get("matched"):
                use=True
            elif incoming.get("matched") and current.get("matched"):
                newer_incoming=str(incoming.get("checked_at") or "") > str(current.get("checked_at") or "")
                primary=incoming if newer_incoming else current
                secondary=current if newer_incoming else incoming
                combined=dict(secondary)
                for k,v in primary.items():
                    if v not in (None, "", [], {}):
                        combined[k]=v
                # Seller/detail payloads are expensive and may be absent when
                # Torob challenges a later refresh. Never replace a richer
                # snapshot with an empty list merely because it is newer.
                for k in ("offers","offer_count","price_range_toman","price_spread_toman","attribution"):
                    if primary.get(k) in (None, "", [], {}) and secondary.get(k) not in (None, "", [], {}):
                        combined[k]=secondary[k]
                b["torob"]=combined
                merged+=1
            elif not current:
                use=True
        if use:
            b["torob"]=incoming
            merged+=1
        cover=str(old.get("cover_url") or "")
        if cover.startswith("assets/books/") and not str(b.get("cover_url") or "").startswith("assets/books/"):
            b["cover_url"]=cover

    compact=json.dumps(dst,ensure_ascii=False,separators=(",",":"))
    dstp.write_text(compact,encoding="utf-8")
    if args.target_js:
        Path(args.target_js).write_text("window.__BOOKS_DATA__="+compact+";\n",encoding="utf-8")
    print(f"book commerce merge: {merged} matched books")


if __name__=="__main__":
    main()

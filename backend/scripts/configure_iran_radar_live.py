"""Write the PUBLIC URL of the optional live radar without exposing credentials."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

def public_origin(raw: str) -> str:
    v = str(raw or "").strip().rstrip("/")
    if not v: return ""
    u = urlsplit(v)
    if u.scheme != "https" or not u.hostname or u.username or u.password \
       or u.path not in ("", "/") or u.query or u.fragment:
        raise ValueError("RADAR_LIVE_ORIGIN must be a secure HTTPS origin without a path")
    return v

def write_config(site: Path, raw: str) -> None:
    origin = public_origin(raw)
    target = site / "data" / "iran-scenario-live-config.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({"origin": origin, "mode": "edge-stream" if origin else "static-fallback"},
                                  ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Live radar client configuration:", "configured" if origin else "not configured — static fallback")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--site", type=Path, required=True)
    args = ap.parse_args()
    write_config(args.site, os.getenv("RADAR_LIVE_ORIGIN", ""))

if __name__ == "__main__": main()

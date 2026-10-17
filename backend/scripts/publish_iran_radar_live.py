"""Send Pendar's already-attributed and scored recent signals to its optional live edge.

This is an outbound, bounded, opt-in publisher. Pendar's static deployment never
depends on the edge service's availability. The token is secret and only used in
the server-side GitHub Actions runner, never in publicly served JavaScript.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

MAX_BATCH = 75
MAX_AGE = timedelta(days=4)


def get_endpoint(raw: str) -> str:
    value = str(raw or "").strip().rstrip("/")
    parsed = urlsplit(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("RADAR_LIVE_ORIGIN must be a public HTTPS origin")
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise ValueError("RADAR_LIVE_ORIGIN must be an origin, not a URL path")
    return value + "/v1/ingest"


def selected_signals(data: list[dict], now: datetime) -> list[dict]:
    cutoff = int((now - MAX_AGE).timestamp() * 1000)
    selected: dict[str, dict] = {}
    for row in data:
        if not isinstance(row, dict) or row.get("by") != "pendar-auto":
            continue
        timestamp = int(row.get("ts") or 0)
        if timestamp < cutoff or timestamp > int((now + timedelta(hours=1)).timestamp() * 1000):
            continue
        if not row.get("id") or not row.get("family"):
            continue
        if not any(link.get("kind") == "original" and link.get("url", "").startswith("https://")
                   for link in row.get("source_links", []) if isinstance(link, dict)):
            continue
        selected[str(row["id"])] = row
    return sorted(selected.values(), key=lambda x: (int(x.get("ts") or 0), str(x["id"])), reverse=True)


def publish(site: Path, origin: str, token: str, now: datetime | None = None) -> tuple[int, int]:
    if not token:
        raise ValueError("Missing secret RADAR_LIVE_INGEST_TOKEN")
    now = now or datetime.now(timezone.utc)
    path = site / "data" / "iran-scenario-signals.json"
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise ValueError("Invalid scenario signals")
    selected = selected_signals(rows, now)
    accepted, changed = 0, 0
    for i in range(0, len(selected), MAX_BATCH):
        body = json.dumps({"signals": selected[i:i + MAX_BATCH]}, ensure_ascii=False,
                          separators=(",", ":")).encode("utf-8")
        if len(body) > 250000:
            raise ValueError("Outgoing live radar batch too large")
        request = Request(get_endpoint(origin), data=body, method="POST",
                          headers={"Content-Type": "application/json",
                                   "Authorization": "Bearer " + token,
                                   "User-Agent": "PendarRadarPublisher/1.0"})
        with urlopen(request, timeout=14) as response:
            result = json.loads(response.read(65536))
        accepted += int(result.get("accepted", 0))
        changed += int(result.get("changed", 0))
    return accepted, changed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", type=Path, required=True)
    args = parser.parse_args()
    origin = os.getenv("RADAR_LIVE_ORIGIN", "").strip()
    token = os.getenv("RADAR_LIVE_INGEST_TOKEN", "").strip()
    if not origin:
        print("Live publisher not configured; retaining static radar.")
        return
    if not token:
        print("::warning::Live publisher URL set but ingest secret missing; no events pushed.")
        return
    try:
        accepted, changed = publish(args.site, origin, token)
        print(f"Sent {accepted} attributed records to live radar; {changed} changed.")
    except (OSError, ValueError, HTTPError, URLError) as error:
        print(f"::warning::Live radar publication skipped: {type(error).__name__} ({error})")
        sys.exit(1)


if __name__ == "__main__":
    main()

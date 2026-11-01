#!/usr/bin/env python3
"""Archive Simorgh posts as review leads, never as verified or published news."""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlsplit

SOURCE = "https://raw.githubusercontent.com/nimania/IranSignal/main/data/news/candidates.json"
OUT = Path(__file__).resolve().parents[1] / "data/simorgh-leads.json"
POST = re.compile(r"^https://t\.me/simorghdata369/[1-9][0-9]*$")
SID = re.compile(r"^[0-9a-f]{20}$")


def fetch_candidates():
    req = Request(SOURCE, headers={"Accept": "application/json", "User-Agent": "Pendar-SimorghLeads/1.0"})
    with urlopen(req, timeout=25) as response:
        body = response.read(3_000_001)
    if len(body) > 3_000_000:
        raise ValueError("Candidate feed exceeds 3 MB")
    result = json.loads(body.decode("utf-8"))
    if not isinstance(result, list):
        raise ValueError("Candidate feed must be a list")
    return result


def update(previous, candidates, *, observed_at=None):
    """Preserve all editorial decisions when polling the source again."""
    if not isinstance(previous, dict) or not isinstance(previous.get("leads"), list):
        raise ValueError("Existing review queue is not valid")
    if not isinstance(candidates, list):
        raise ValueError("Invalid candidates")
    observed_at = observed_at or datetime.now(timezone.utc).isoformat()
    leads = {r["id"]: dict(r) for r in previous["leads"]
             if isinstance(r, dict) and SID.fullmatch(str(r.get("id", "")))}
    for row in candidates:
        if not isinstance(row, dict):
            continue
        sid = str(row.get("id") or "")
        url = str(row.get("url") or "")
        if (row.get("source_id") != "simorghdata369"
            or row.get("status") != "unverified_candidate"
            or row.get("source_kind") != "public_telegram_preview"
            or not SID.fullmatch(sid) or not POST.fullmatch(url)):
            continue
        try:
            published = datetime.fromisoformat(str(row["published"]).replace("Z", "+00:00"))
            if published.tzinfo is None:
                continue
        except (TypeError, ValueError, KeyError):
            continue
        snippet = " ".join(str(row.get("excerpt") or "").split())[:800]
        if len(snippet) < 55:
            continue
        if sid in leads:
            # Refresh only automatic display hints; preserve every editorial decision.
            if leads[sid].get("review_status") == "pending":
                leads[sid]["headline_hint"] = str(row.get("title") or "")[:180]
                leads[sid]["source_excerpt"] = snippet
            continue
        leads[sid] = {
            "id": sid, "channel": "@simorghdata369", "source_url": url,
            "source_published_at": published.isoformat(),
            "headline_hint": str(row.get("title") or "")[:180],
            "source_excerpt": snippet, "first_seen_at": observed_at,
            "review_status": "pending", "reviewed_by": "",
            "approved_at": None, "approved_headline_fa": "",
            "approved_summary_fa": "", "why_it_matters_fa": "",
            "independent_sources": [], "review_note": "",
        }
    rows = sorted(leads.values(), key=lambda item: (item.get("source_published_at", ""), item["id"]), reverse=True)
    return {"version": 1, "description": "Editorial review queue only; publication requires independent verification and explicit approval.",
            "leads": rows[:2000]}


def approved(row):
    """Explicit editorial gate; a Telegram link does not qualify as corroboration."""
    if row.get("review_status") != "approved":
        return False
    if len(str(row.get("reviewed_by") or "").strip()) < 2:
        return False
    try:
        t = datetime.fromisoformat(str(row.get("approved_at") or "").replace("Z", "+00:00"))
        if t.tzinfo is None:
            return False
    except ValueError:
        return False
    if len(str(row.get("approved_headline_fa") or "").strip()) < 18:
        return False
    if len(str(row.get("approved_summary_fa") or "").strip()) < 80:
        return False
    if len(str(row.get("why_it_matters_fa") or "").strip()) < 40:
        return False
    sources = row.get("independent_sources") or []
    if not isinstance(sources, list) or not sources:
        return False
    for item in sources:
        if not isinstance(item, dict) or not item.get("source_name"):
            return False
        link = str(item.get("article_url") or "")
        parts = urlsplit(link)
        if parts.scheme != "https" or not parts.netloc:
            return False
        if parts.hostname in {"t.me", "telegram.me", "telegram.org"}:
            return False
    return True


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--out", type=Path, default=OUT)
    p.add_argument("--input", type=Path, help="Offline test candidate feed")
    args = p.parse_args()
    previous = (json.loads(args.out.read_text(encoding="utf-8")) if args.out.exists()
                else {"version": 1, "leads": []})
    candidates = (json.loads(args.input.read_text(encoding="utf-8")) if args.input
                  else fetch_candidates())
    merged = update(previous, candidates)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    ready = sum(approved(r) for r in merged["leads"])
    print("Simorgh lead queue:", len(merged["leads"]), "approved:", ready,
          "(publication is not performed by this collector)")


if __name__ == "__main__":
    main()

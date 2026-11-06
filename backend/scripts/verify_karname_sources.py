#!/usr/bin/env python3
"""Source checks for Karname; NEVER automatic political verdicts.

Fetch a bounded set of already-cited source pages each scheduled run. A text
match proves only that a page contains that string, NOT that the named person
spoke it or that the event occurred. Unreachable pages are not false claims.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
import ipaddress
import json
from pathlib import Path
import re
import socket
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import build_opener, HTTPSHandler, Request, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parents[2]
RADAR = ROOT / "web-static/karname/auto-radar.json"
LEDGER = ROOT / "backend/data/karname.json"
OUTPUT = ROOT / "web-static/karname/source-verification.json"
MAX_BYTES = 350000
MAX_CHECKS = 32
MAX_RECORDS = 5000


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class VisibleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.ignore = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self.ignore += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "svg"} and self.ignore:
            self.ignore -= 1

    def handle_data(self, data):
        if not self.ignore:
            self.parts.append(data)


def safe_public_https(url: object, *, resolve: bool = True) -> bool:
    if not isinstance(url, str) or len(url) > 2048:
        return False
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return False
    if parsed.port not in (None, 443):
        return False
    hostname = parsed.hostname
    if hostname.endswith(".local") or hostname in {"localhost", "metadata.google.internal"}:
        return False
    if not re.fullmatch(r"[A-Za-z0-9.-]{4,253}", hostname):
        return False
    try:
        ipaddress.ip_address(hostname)
        return False  # no literal IPs, including public ones, in candidate URLs
    except ValueError:
        pass
    if not resolve:
        return True
    try:
        addresses = socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM)
        return bool(addresses) and all(
            ipaddress.ip_address(a[4][0]).is_global for a in addresses)
    except (socket.gaierror, ValueError, OSError):
        return False


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[\u064b-\u065f]", "",
           text.replace("ي", "ی").replace("ك", "ک"))).strip().casefold()


def retrieve_page(url: str, timeout: int = 7) -> str:
    if not safe_public_https(url):
        raise ValueError("unsafe_or_unresolvable_url")
    request = Request(url, headers={"User-Agent": "PendarKarnameEvidence/1.0",
                                    "Accept": "text/html,text/plain",
                                    "Accept-Encoding": "identity"})
    response = build_opener(NoRedirect(), HTTPSHandler()).open(request, timeout=timeout)
    with response:
        if response.status != 200:
            raise ValueError("http_status_not_200")
        ctype = response.headers.get("Content-Type", "").lower()
        if not ("text/html" in ctype or "text/plain" in ctype):
            raise ValueError("not_html_or_plain_text")
        contents = response.read(MAX_BYTES+1)
        if len(contents) > MAX_BYTES:
            raise ValueError("page_exceeds_size_limit")
        charset = response.headers.get_content_charset() or "utf-8"
        body = contents.decode(charset, errors="replace")
    if "html" in ctype:
        parsed = VisibleText()
        parsed.feed(body)
        return " ".join(parsed.parts)
    return body


def verify_page(item: dict, *, fetch=retrieve_page) -> str:
    url = item.get("source", {}).get("link")
    if not safe_public_https(url, resolve=False):
        return "no_source_url"
    try:
        body = fetch(url)
        excerpt = normalize(str(item.get("text_from_source") or ""))
        if len(excerpt) >= 30 and excerpt in normalize(body):
            return "source_text_found"
        return "source_accessible"
    except (ValueError, UnicodeError, OSError, HTTPError, URLError, TimeoutError):
        return "source_unavailable"


def now_iso(now: datetime) -> str:
    return now.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def build(radar: dict, ledger: dict, previous: dict | None = None,
          *, now: datetime | None = None, budget: int = MAX_CHECKS,
          fetch=retrieve_page) -> dict:
    now = now or datetime.now(timezone.utc)
    rows = radar.get("items")
    if not isinstance(rows, list) or len(rows) > MAX_RECORDS:
        raise ValueError("Invalid radar observations")
    if not isinstance(ledger.get("claims"), list) or not isinstance(ledger.get("buckets"), list):
        raise ValueError("Invalid official ledger")
    previous_rows = (previous or {}).get("observations") or {}
    if not isinstance(previous_rows, dict):
        raise ValueError("Invalid previous status")
    valid = {x["id"]: x for x in rows if isinstance(x, dict) and
             re.fullmatch(r"KC-[a-f0-9]{18}", str(x.get("id", ""))) and
             x.get("observation_status") == "auto_collected_unverified"}
    if len(valid) != len(rows):
        raise ValueError("Duplicate or invalid observation")
    checked = 0
    results = {}
    # Prefer never-checked, then least-recently-checked, for fair coverage.
    order = sorted(rows, key=lambda x: (
        str((previous_rows.get(x["id"]) or {}).get("checked_at") or ""), x["id"]))
    for row in order:
        id_ = row["id"]
        prior = previous_rows.get(id_)
        prior = prior if isinstance(prior, dict) else {}
        url = row.get("source", {}).get("link")
        if not safe_public_https(url, resolve=False):
            results[id_] = {
                "status": "no_source_url", "checked_at": None,
                "source_url": None, "speaker_verified": False,
                "outcome": "not_assessed",
            }
            continue
        if checked < max(0, budget):
            status = verify_page(row, fetch=fetch)
            results[id_] = {"status": status, "checked_at": now_iso(now),
                            "source_url": url, "speaker_verified": False,
                            "outcome": "not_assessed"}
            checked += 1
        elif prior.get("source_url") == url and prior.get("status") in {
                "source_text_found", "source_accessible", "source_unavailable"}:
            results[id_] = prior
        else:
            results[id_] = {"status": "pending_check", "checked_at": None,
                            "source_url": url, "speaker_verified": False,
                            "outcome": "not_assessed"}
    buckets = {x.get("key"): x for x in ledger["buckets"] if isinstance(x, dict)}
    dates = {}
    for claim in ledger["claims"]:
        id_ = str(claim.get("id") or "")
        if not id_:
            raise ValueError("Missing official claim ID")
        bucket = buckets.get(claim.get("bucket")) or {}
        due = bucket.get("date")
        if isinstance(due, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", due):
            # No automatic verdict; a due date can trigger an evidence search.
            state = "deadline_passed_needs_evidence" if due < now.date().isoformat() \
                else "scheduled_future"
        else:
            due = None
            state = "event_based_or_no_verified_deadline"
        dates[id_] = {"deadline_date": due, "triage_status": state,
                      "automated_outcome": None,
                      "requires_independent_event_evidence": True}
    return {
        "schema_version": 1,
        "scope": "automatic_source_verification_not_outcome_scoring",
        "generated_at": now_iso(now),
        "policy_fa": "این بررسی صرفاً دسترس‌پذیری منبع و وجود متن در صفحه را می‌سنجد؛ نه اصالت گفتار شخص، نه تحقق رویداد و نه درست/نادرست‌بودن پیش‌بینی.",
        "summary": {"observations": len(rows), "checked_this_run": checked,
                    "exact_text_in_source_page": sum(
                        v["status"] == "source_text_found" for v in results.values()),
                    "deadlines_requiring_evidence": sum(
                        v["triage_status"] == "deadline_passed_needs_evidence"
                        for v in dates.values()),
                    "outcomes_automatically_scored": 0},
        "observations": {k: results[k] for k in sorted(results)},
        "official_due_review": {k: dates[k] for k in sorted(dates)},
    }


def run(radar: Path = RADAR, ledger: Path = LEDGER, output: Path = OUTPUT,
        *, budget: int = MAX_CHECKS, check: bool = False):
    old = json.loads(output.read_text(encoding="utf-8")) if output.exists() else {}
    existing = json.loads(radar.read_text(encoding="utf-8"))
    main = json.loads(ledger.read_text(encoding="utf-8"))
    report = build(existing, main, old, budget=0 if check else budget)
    # --check verifies structural compatibility without repeating network calls.
    if check:
        if not output.is_file():
            raise ValueError("Evidence output missing; required for consistency check")
        existing_report = json.loads(output.read_text(encoding="utf-8"))
        if set(existing_report.get("observations", {})) != {
                v["id"] for v in existing.get("items", [])}:
            raise ValueError("Evidence output observation IDs are stale")
        if set(existing_report.get("official_due_review", {})) != {
                v["id"] for v in main.get("claims", [])}:
            raise ValueError("Evidence output official IDs are stale")
        return existing_report
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = output.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(report, ensure_ascii=False, indent=2)+"\n",
                   encoding="utf-8")
    tmp.replace(output)
    print("Karname automated source checks:", report["summary"])
    return report


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--radar", type=Path, default=RADAR)
    p.add_argument("--ledger", type=Path, default=LEDGER)
    p.add_argument("--output", type=Path, default=OUTPUT)
    p.add_argument("--budget", type=int, default=MAX_CHECKS)
    p.add_argument("--check", action="store_true")
    args = p.parse_args()
    try:
        run(args.radar, args.ledger, args.output,
            budget=max(0, min(40, args.budget)), check=args.check)
    except (ValueError, OSError) as e:
        print("Source-verification stopped:", e, file=sys.stderr)
        sys.exit(1)

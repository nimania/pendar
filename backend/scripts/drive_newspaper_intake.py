#!/usr/bin/env python3
"""Drive newspaper intake: metadata + short page leads, never full-text republication."""
import hashlib
import io
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from google.auth.transport.requests import AuthorizedSession
from google.oauth2 import service_account
from pypdf import PdfReader

FOLDER = os.getenv("NEWSPAPER_DRIVE_FOLDER_ID", "1rP8lEWxcWUWK1mG3fKEhWySv85VgCnbX")
OUTPUT = Path(os.getenv("NEWSPAPER_INTAKE_PATH", "backend/data/newspaper-intake.json"))
MAX_NEW = int(os.getenv("NEWSPAPER_MAX_FILES_PER_RUN", "2"))
MAX_PAGES = int(os.getenv("NEWSPAPER_MAX_PAGES", "180"))
API = "https://www.googleapis.com/drive/v3/files"


def drive_session():
    raw = os.environ.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON")
    if not raw:
        raise RuntimeError("Missing GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON. Share the folder with the service-account email.")
    info = json.loads(raw)
    creds = service_account.Credentials.from_service_account_info(
        info, scopes=["https://www.googleapis.com/auth/drive.readonly"]
    )
    return AuthorizedSession(creds)


def list_pdfs(session):
    items, token = [], None
    while True:
        params = {
            "q": f"'{FOLDER}' in parents and mimeType = 'application/pdf' and trashed = false",
            "fields": "nextPageToken,files(id,name,mimeType,size,md5Checksum,modifiedTime,webViewLink)",
            "pageSize": 100, "orderBy": "createdTime asc",
        }
        if token:
            params["pageToken"] = token
        r = session.get(API, params=params, timeout=40)
        r.raise_for_status()
        body = r.json()
        items.extend(body.get("files", []))
        token = body.get("nextPageToken")
        if not token:
            return items


def download(session, file_id):
    r = session.get(f"{API}/{file_id}", params={"alt": "media"},
                    stream=True, timeout=180)
    r.raise_for_status()
    data = io.BytesIO()
    limit = 100 * 1024 * 1024
    for chunk in r.iter_content(chunk_size=1048576):
        data.write(chunk)
        if data.tell() > limit:
            raise ValueError("PDF exceeds 100 MB intake limit")
    data.seek(0)
    return data


def page_lead(text):
    # Candidate only: complex newspaper columns require editorial review.
    lines = [re.sub(r"\\s+", " ", s).strip() for s in text.splitlines()]
    lines = [s for s in lines if 18 <= len(s) <= 125 and not s.isdigit()]
    return lines[0][:125] if lines else ""


def inspect_pdf(stream):
    reader = PdfReader(stream, strict=False)
    pages = []
    for index, page in enumerate(reader.pages[:MAX_PAGES], start=1):
        try:
            raw = page.extract_text() or ""
            pages.append({
                "page": index,
                "text_chars": len(raw),
                "candidate_heading": page_lead(raw),
                "status": "needs_editorial_review",
            })
        except Exception as exc:
            pages.append({"page": index, "text_chars": 0, "candidate_heading": "",
                          "status": "extraction_error", "error": str(exc)[:160]})
    return len(reader.pages), pages


def main():
    session = drive_session()
    previous = {"schema_version": 1, "folder_id": FOLDER, "files": []}
    if OUTPUT.exists():
        previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
    if previous.get("folder_id") != FOLDER:
        raise ValueError("Existing index targets a different Drive folder")
    by_id = {item["id"]: item for item in previous["files"]}
    files = list_pdfs(session)
    changed = 0
    for meta in files:
        file_id = meta["id"]
        fingerprint = meta.get("md5Checksum") or meta.get("modifiedTime", "")
        if by_id.get(file_id, {}).get("fingerprint") == fingerprint:
            continue
        if changed >= MAX_NEW:
            break
        try:
            total, pages = inspect_pdf(download(session, file_id))
            record = {
                "id": file_id, "name": meta["name"], "fingerprint": fingerprint,
                "source_url": meta.get("webViewLink") or
                    f"https://drive.google.com/file/d/{file_id}/view",
                "page_count": total, "pages_scanned": len(pages),
                "pages": pages, "status": "awaiting_editorial_review",
                "rights_status": "unverified",
                "full_translation_allowed": False,
                "processed_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as exc:
            print(f"WARNING: {meta['name']}: {exc}", file=sys.stderr)
            # Retry failed documents on next scheduled run; do not mark processed.
            continue
        by_id[file_id] = record
        changed += 1
    payload = {"schema_version": 1, "folder_id": FOLDER,
               "files": list(by_id.values())}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    # Deterministic content when no new PDFs; avoid unnecessary commits.
    serialized = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != serialized:
        OUTPUT.write_text(serialized, encoding="utf-8")
    print(f"PDF files in Drive: {len(files)}; newly inspected: {changed}; indexed: {len(by_id)}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Archive up to ten playlist caption tracks to the private Drive folder.

Uses locally authorized YouTube and Drive tokens. Never prints credentials.
"""
import json
import re
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaInMemoryUpload

ROOT = Path(__file__).resolve().parent.parent
PLAYLIST_ID = "PL7LmGD9xOFR4l_4B36Bm8N1fNl7BSvrtU"
FOLDER_ID = "1rSlAuXM_0WwrEIJ-7AJDfcJK-SFRCdiO"
YOUTUBE_SCOPE = ["https://www.googleapis.com/auth/youtube.force-ssl"]
DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive"]

def auth(filename, scopes):
    path = ROOT / filename
    creds = Credentials.from_authorized_user_file(str(path), scopes=scopes) if path.exists() else None
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    if not creds or not creds.valid:
        client = ROOT / "credentials.json"
        if not client.is_file():
            raise SystemExit("Missing private credentials.json in project root.")
        creds = InstalledAppFlow.from_client_secrets_file(str(client), scopes).run_local_server(
            port=0, open_browser=True, prompt="consent", access_type="offline")
    path.write_text(creds.to_json(), encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass
    return creds

youtube = build("youtube", "v3", credentials=auth("youtube-oauth-token.json", YOUTUBE_SCOPE), cache_discovery=False)
drive = build("drive", "v3", credentials=auth("drive-oauth-token.json", DRIVE_SCOPE), cache_discovery=False)
folder = drive.files().get(fileId=FOLDER_ID, fields="id,mimeType", supportsAllDrives=True).execute()
if folder.get("mimeType") != "application/vnd.google-apps.folder":
    raise SystemExit("Invalid destination folder.")
page = youtube.playlistItems().list(part="snippet,contentDetails", playlistId=PLAYLIST_ID, maxResults=10).execute()
records = []
for item in page.get("items", [])[:10]:
    ident = item.get("contentDetails", {}).get("videoId")
    title = item.get("snippet", {}).get("title", "")
    record = {"video_id": ident, "title": title}
    records.append(record)
    if not ident or not re.fullmatch(r"[A-Za-z0-9_-]{11}", ident):
        record["status"] = "invalid_id"
        continue
    try:
        tracks = youtube.captions().list(part="snippet", videoId=ident).execute().get("items", [])
        fa = [t for t in tracks if t.get("snippet", {}).get("language", "").lower().startswith("fa")]
        if not fa:
            record["status"] = "no_persian_captions"
            continue
        chosen = next((t for t in fa if t.get("snippet", {}).get("trackKind") == "asr"), fa[0])
        name = f"{ident}.fa.srt"
        safe_name = name.replace("'", "\\'")
        existing = drive.files().list(
            q=f"'{FOLDER_ID}' in parents and name = '{safe_name}' and trashed = false",
            fields="nextPageToken,files(id,name,webViewLink)", pageSize=100
        ).execute().get("files", [])
        if existing:
            record["status"] = "already_archived"
            record["drive_file_id"] = existing[0]["id"]
            continue
        raw = youtube.captions().download(id=chosen["id"], tfmt="srt").execute()
        data = raw if isinstance(raw, bytes) else str(raw).encode("utf-8")
        if not data:
            record["status"] = "empty_subtitle"
            continue
        uploaded = drive.files().create(
            body={"name": name, "parents": [FOLDER_ID],
                  "description": f"Title: {title}\nSource: https://www.youtube.com/watch?v={ident}"},
            media_body=MediaInMemoryUpload(data, mimetype="application/x-subrip"),
            fields="id,name,size,webViewLink"
        ).execute()
        record.update(status="uploaded", bytes=len(data), drive_file_id=uploaded["id"])
    except HttpError as exc:
        record.update(status="api_error", http_status=exc.resp.status,
                      error=str(exc)[:300])
    except Exception as exc:
        record.update(status="error", error=type(exc).__name__ + ": " + str(exc)[:200])
    print(json.dumps(record, ensure_ascii=False), flush=True)

report = ROOT / "local-transcripts" / "first-ten-report.json"
report.parent.mkdir(parents=True, exist_ok=True)
report.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"REPORT: {report}")
print("SUMMARY:", json.dumps({s: sum(r.get("status") == s for r in records)
                             for s in sorted(set(r.get("status") for r in records))}, ensure_ascii=False))

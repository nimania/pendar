#!/usr/bin/env python3
"""Upload the first verified YouTube SRT to the pre-created private Drive archive.

Credentials stay local. A separate Drive OAuth token is used to avoid replacing
the working YouTube credential. No GitHub Actions integration in this step.
"""
import hashlib
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "local-transcripts" / "dpYz8bT_w0Y.srt"
CLIENT = ROOT / "credentials.json"
TOKEN = ROOT / "drive-oauth-token.json"
FOLDER_ID = "1rSlAuXM_0WwrEIJ-7AJDfcJK-SFRCdiO"
SCOPES = ["https://www.googleapis.com/auth/drive"]
NAME = "dpYz8bT_w0Y.fa.srt"

if not SOURCE.is_file():
    raise SystemExit(f"Missing subtitle file: {SOURCE}")
if not CLIENT.is_file():
    raise SystemExit("Missing credentials.json; put downloaded Desktop OAuth JSON in project root.")

creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES) if TOKEN.exists() else None
if creds and creds.expired and creds.refresh_token:
    creds.refresh(Request())
if not creds or not creds.valid:
    creds = InstalledAppFlow.from_client_secrets_file(str(CLIENT), SCOPES).run_local_server(
        port=0, open_browser=True, prompt="consent", access_type="offline"
    )
TOKEN.write_text(creds.to_json(), encoding="utf-8")
try:
    TOKEN.chmod(0o600)
except OSError:
    pass

drive = build("drive", "v3", credentials=creds, cache_discovery=False)
folder = drive.files().get(fileId=FOLDER_ID, fields="id,name,mimeType", supportsAllDrives=True).execute()
if folder.get("mimeType") != "application/vnd.google-apps.folder":
    raise SystemExit("Target is not a Drive folder; aborting.")
safe_name = NAME.replace("'", "\\'")
existing = drive.files().list(
    q=f"'{FOLDER_ID}' in parents and name = '{safe_name}' and trashed = false",
    fields="files(id,name,md5Checksum,webViewLink),nextPageToken",
    page_size=100,
).execute().get("files", [])
if existing:
    print("ALREADY EXISTS:", existing[0].get("id"), existing[0].get("webViewLink", ""))
    raise SystemExit(0)

media = MediaFileUpload(str(SOURCE), mimetype="application/x-subrip", resumable=False)
uploaded = drive.files().create(
    body={
        "name": NAME,
        "parents": [FOLDER_ID],
        "description": "Persian YouTube subtitles with timestamps. Source: https://www.youtube.com/watch?v=dpYz8bT_w0Y",
    },
    media_body=media,
    fields="id,name,size,md5Checksum,webViewLink,parents",
).execute()
expected = hashlib.md5(SOURCE.read_bytes()).hexdigest()
if uploaded.get("md5Checksum") != expected:
    raise SystemExit("Upload returned unexpected checksum; inspect file in Drive.")
print("UPLOAD VERIFIED:", uploaded.get("name"), uploaded.get("id"), uploaded.get("webViewLink", ""), uploaded.get("size"), "bytes")

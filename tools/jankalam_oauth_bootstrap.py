#!/usr/bin/env python3
"""Local owner-only OAuth bootstrap; never upload credentials to Git or chat."""
import json
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]
VIDEO_ID = "dpYz8bT_w0Y"
root = Path(__file__).resolve().parent.parent
credentials_path = root / "credentials.json"
token_path = root / "youtube-oauth-token.json"

if not credentials_path.is_file():
    raise SystemExit("Missing credentials.json in repository working directory. Keep it private.")
flow = InstalledAppFlow.from_client_secrets_file(str(credentials_path), scopes=SCOPES)
creds = flow.run_local_server(port=0, open_browser=True, prompt="consent", access_type="offline")
token_path.write_text(creds.to_json(), encoding="utf-8")
try:
    token_path.chmod(0o600)
except OSError:
    pass
print("OAuth authorization succeeded. Private token saved locally; do not share or commit it.")
youtube = build("youtube", "v3", credentials=creds, cache_discovery=False)
try:
    response = youtube.captions().list(part="snippet", videoId=VIDEO_ID).execute()
    for track in response.get("items", []):
        snippet = track.get("snippet", {})
        print(json.dumps({"caption_id": track.get("id"), "language": snippet.get("language"),
              "track_kind": snippet.get("trackKind"), "status": snippet.get("status")}, ensure_ascii=False))
    if not response.get("items"):
        print("No caption tracks returned for this video with this account.")
except HttpError as exc:
    print(f"Caption listing unavailable: HTTP {exc.resp.status}. Check channel ownership and permissions.")

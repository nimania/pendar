#!/usr/bin/env python3
"""Download a single owned video's Persian caption through official YouTube API."""
from pathlib import Path
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

ROOT = Path(__file__).resolve().parent.parent
TOKEN = ROOT / "youtube-oauth-token.json"
VIDEO = "dpYz8bT_w0Y"
SCOPE = ["https://www.googleapis.com/auth/youtube.force-ssl"]
if not TOKEN.exists():
    raise SystemExit("Missing local OAuth token. Run python3 tools/jankalam_oauth_bootstrap.py first.")
credentials = Credentials.from_authorized_user_file(str(TOKEN), scopes=SCOPE)
if credentials.expired and credentials.refresh_token:
    credentials.refresh(Request())
    TOKEN.write_text(credentials.to_json(), encoding="utf-8")
if not credentials.valid:
    raise SystemExit("OAuth token is invalid. Reauthorize locally.")
youtube = build("youtube", "v3", credentials=credentials, cache_discovery=False)
try:
    tracks = youtube.captions().list(part="snippet", videoId=VIDEO).execute().get("items", [])
    fa = [t for t in tracks if t.get("snippet", {}).get("language", "").startswith("fa")]
    if not fa:
        raise SystemExit("No Persian caption track found for test video.")
    chosen = next((t for t in fa if t["snippet"].get("trackKind") == "asr"), fa[0])
    raw = youtube.captions().download(id=chosen["id"], tfmt="srt").execute()
    data = raw if isinstance(raw, bytes) else str(raw).encode("utf-8")
    target = ROOT / "local-transcripts" / f"{VIDEO}.srt"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    print(f"SUCCESS: Saved SRT locally ({len(data)} bytes): {target}")
except HttpError as exc:
    print(f"DOWNLOAD FAILED: HTTP {exc.resp.status}; reason: {exc.error_details}")
    print("Listing an ASR track does not guarantee API download rights. Do not share OAuth secrets.")

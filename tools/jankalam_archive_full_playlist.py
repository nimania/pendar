#!/usr/bin/env python3
"""Owner-authorized full Jan Kalam playlist caption archive to Google Drive.

No publishing, no video edits. Uses local OAuth tokens only.
"""
import argparse
import csv
import io
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaInMemoryUpload

ROOT = Path(__file__).resolve().parent.parent
PLAYLIST = "PL7LmGD9xOFR4l_4B36Bm8N1fNl7BSvrtU"
DEST = "1rSlAuXM_0WwrEIJ-7AJDfcJK-SFRCdiO"
REPORT_DIR = ROOT / "local-transcripts"
YOUTUBE_SCOPE = ["https://www.googleapis.com/auth/youtube.force-ssl"]
DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive"]

def credentials(filename, scopes):
    target = ROOT / filename
    creds = Credentials.from_authorized_user_file(str(target), scopes=scopes) if target.exists() else None
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    if not creds or not creds.valid:
        creds = InstalledAppFlow.from_client_secrets_file(
            str(ROOT / "credentials.json"), scopes=scopes
        ).run_local_server(port=0, open_browser=True, prompt="consent", access_type="offline")
    target.write_text(creds.to_json(), encoding="utf-8")
    try: target.chmod(0o600)
    except OSError: pass
    return creds

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="0 means entire playlist")
    parser.add_argument("--delay", type=float, default=0.3, help="Seconds between caption requests")
    args = parser.parse_args()
    yt = build("youtube", "v3", credentials=credentials("youtube-oauth-token.json", YOUTUBE_SCOPE), cache_discovery=False)
    drive = build("drive", "v3", credentials=credentials("drive-oauth-token.json", DRIVE_SCOPE), cache_discovery=False)
    folder = drive.files().get(fileId=DEST, fields="id,mimeType").execute()
    if folder["mimeType"] != "application/vnd.google-apps.folder":
        raise SystemExit("Drive destination is not a folder.")
    # One paginated Drive listing avoids one expensive search per video.
    existing = set()
    token = None
    while True:
        result = drive.files().list(q=f"'{DEST}' in parents and trashed = false",
                                    fields="nextPageToken,files(id,name)",pageSize=1000,
                                    pageToken=token).execute()
        existing.update(f["name"] for f in result.get("files", []))
        token = result.get("nextPageToken")
        if not token: break
    records = []
    page_token = None
    seen = set()
    try:
        while True:
            page = yt.playlistItems().list(part="snippet,contentDetails",playlistId=PLAYLIST,
                                           maxResults=50,pageToken=page_token).execute()
            for item in page.get("items", []):
                video_id = item.get("contentDetails", {}).get("videoId")
                if not video_id or video_id in seen: continue
                seen.add(video_id)
                snippet = item.get("snippet", {})
                rec = {"video_id": video_id,"title": snippet.get("title", ""),
                       "published_at": snippet.get("publishedAt", ""),
                       "video_published_at": item.get("contentDetails", {}).get("videoPublishedAt", ""),
                       "url": "https://www.youtube.com/watch?v=" + video_id,
                       "status": "", "error": ""}
                records.append(rec)
                name = f"{video_id}.fa.srt"
                if name in existing:
                    rec["status"] = "already_archived"
                else:
                    try:
                        tracks = yt.captions().list(part="snippet",videoId=video_id).execute().get("items",[])
                        fa = [x for x in tracks if x.get("snippet",{}).get("language","").lower().startswith("fa")]
                        if not fa:
                            rec["status"] = "no_persian_caption"
                        else:
                            chosen = next((x for x in fa if x.get("snippet",{}).get("trackKind") == "asr"),fa[0])
                            raw = yt.captions().download(id=chosen["id"],tfmt="srt").execute()
                            data = raw if isinstance(raw,bytes) else str(raw).encode("utf-8")
                            if not data:
                                rec["status"] = "empty_caption"
                            else:
                                uploaded = drive.files().create(
                                    body={"name":name,"parents":[DEST],"description":json.dumps(
                                        {k:rec[k] for k in ("video_id","title","published_at","video_published_at","url")},ensure_ascii=False)},
                                    media_body=MediaInMemoryUpload(data,mimetype="application/x-subrip"),
                                    fields="id,size").execute()
                                rec["status"] = "uploaded"
                                rec["drive_file_id"] = uploaded["id"]
                                rec["bytes"] = len(data)
                                existing.add(name)
                    except HttpError as e:
                        rec["status"] = "api_error"
                        rec["error"] = f"HTTP {e.resp.status}: {str(e)[:200]}"
                    except Exception as e:
                        rec["status"] = "error"
                        rec["error"] = f"{type(e).__name__}: {str(e)[:200]}"
                    time.sleep(max(0,args.delay))
                print(json.dumps(rec,ensure_ascii=False),flush=True)
                if args.limit > 0 and len(records) >= args.limit: break
            if args.limit > 0 and len(records) >= args.limit: break
            page_token = page.get("nextPageToken")
            if not page_token: break
    finally:
        REPORT_DIR.mkdir(parents=True,exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        json_path = REPORT_DIR / f"full-playlist-report-{stamp}.json"
        csv_path = REPORT_DIR / f"full-playlist-report-{stamp}.csv"
        json_path.write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding="utf-8")
        columns=["video_id","title","published_at","video_published_at","url","status","error","drive_file_id","bytes"]
        with csv_path.open("w",encoding="utf-8-sig",newline="") as fp:
            w=csv.DictWriter(fp,fieldnames=columns,extrasaction="ignore")
            w.writeheader();w.writerows(records)
        counts={s:sum(r["status"]==s for r in records) for s in sorted({r["status"] for r in records})}
        print("SUMMARY:",json.dumps(counts,ensure_ascii=False))
        print("REPORTS:",json_path,csv_path)

if __name__ == "__main__":
    main()

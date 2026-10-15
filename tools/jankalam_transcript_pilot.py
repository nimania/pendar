#!/usr/bin/env python3
"""Read-only pilot: collect captions for up to 3 playlist videos as timestamped text."""
import json
import re
import subprocess
import tempfile
from pathlib import Path

PLAYLIST = "https://www.youtube.com/playlist?list=PL7LmGD9xOFR4l_4B36Bm8N1fNl7BSvrtU"
OUT = Path("artifacts/jankalam-transcripts")
OUT.mkdir(parents=True, exist_ok=True)

def run(*args):
    return subprocess.run(args, capture_output=True, text=True, check=False, timeout=150)

def clean_vtt(raw):
    lines = []
    previous = None
    timestamp = ""
    for line in raw.splitlines():
        s = line.strip()
        if "-->" in s:
            timestamp = s.split("-->")[0].strip()
            continue
        if not s or s.startswith(("WEBVTT", "Kind:", "Language:", "NOTE", "STYLE", "REGION")) or re.fullmatch(r"\d+", s):
            continue
        s = re.sub(r"<[^>]*>", "", s)
        s = re.sub(r"\{[^}]*\}", "", s).strip()
        if not s or s == previous:
            continue
        lines.append(f"[{timestamp}] {s}" if timestamp else s)
        previous = s
    return "\n".join(lines)

meta = run("yt-dlp", "--flat-playlist", "--dump-single-json", "--playlist-end", "3", PLAYLIST)
if meta.returncode:
    (OUT / "error.txt").write_text(meta.stderr[-5000:], encoding="utf-8")
    raise SystemExit("Playlist enumeration failed; inspect artifact/error.txt")
entries = json.loads(meta.stdout).get("entries") or []
results = []
with tempfile.TemporaryDirectory() as td:
    for item in entries[:3]:
        video_id = item.get("id")
        if not video_id or not re.fullmatch(r"[A-Za-z0-9_-]{11}", video_id):
            continue
        url = "https://www.youtube.com/watch?v=" + video_id
        record = {"video_id": video_id, "title": item.get("title"), "url": url, "status": "no_persian_caption"}
        cmd = run("yt-dlp", "--skip-download", "--write-subs", "--write-auto-subs",
                  "--sub-langs", "fa,fa-.*", "--sub-format", "vtt",
                  "--no-playlist", "-o", str(Path(td) / "%(id)s.%(ext)s"), url)
        candidates = list(Path(td).glob(f"{video_id}*.vtt"))
        if candidates:
            selected = sorted(candidates, key=lambda p: ("fa-orig" not in p.name, "fa.vtt" not in p.name))[0]
            full_text = clean_vtt(selected.read_text(encoding="utf-8"))
            if full_text:
                (OUT / f"{video_id}.txt").write_text(
                    f"Title: {item.get('title', '')}\nSource: {url}\nCaption: {selected.name}\n\n{full_text}\n",
                    encoding="utf-8")
                record["status"] = "saved"
                record["caption_file"] = selected.name
        if cmd.returncode != 0:
            record["warning"] = cmd.stderr[-500:]
        results.append(record)
(OUT / "manifest.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(results, ensure_ascii=False, indent=2))

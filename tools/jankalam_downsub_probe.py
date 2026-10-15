"""Test one DownSub caption request without logging secret or response body."""
import json
import os
import sys
import httpx

key = os.environ.get("DOWNSUB_API_KEY", "").strip()
if not key:
    raise SystemExit("Missing DownSub API configuration")
video_id = "IZIYTWQ4z9E"
with httpx.Client(timeout=60) as client:
    response = client.post(
        "https://api.downsub.com/download",
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
        json={"url": "https://www.youtube.com/watch?v=" + video_id},
    )
print("HTTP status:", response.status_code)
print("Response size:", len(response.content))
if response.status_code == 200:
    if "json" in response.headers.get("content-type", ""):
        data = response.json()
        print("Top-level response fields:", list(data) if isinstance(data, dict) else type(data).__name__)
    else:
        print("Plain caption text available:", len(response.text) > 120)
else:
    sys.exit(1)

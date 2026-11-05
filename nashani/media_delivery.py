"""Rights-aware public Telegram media transport for Nashani.

The caller must enable re-use in the source registry after confirming a right to
repost. Never retrieve protected channel content or arbitrary external URLs.
"""
from __future__ import annotations

import json
import logging

import requests

from editorial import media_url_allowed


class MediaNotAvailable(Exception):
    """Media could not be acquired; caller may publish an attributed text post."""


def upload_public_media(token, channel, media, caption):
    """Fetch allowed public CDN media and upload a photo/video with its own caption.

    Raises MediaNotAvailable before contacting sendPhoto/sendVideo for download
    failures, or RuntimeError when a delivery attempt may have happened.
    """
    kind = media.get("kind")
    url = media.get("url")
    if kind not in {"photo", "video"} or not media_url_allowed(url):
        raise MediaNotAvailable("No permitted public media URL")
    max_bytes = 9_000_000 if kind == "photo" else 45_000_000
    try:
        with requests.get(
            url, stream=True, timeout=(8, 25),
            headers={"User-Agent": "NashaniKermanRadar/1.0"}, allow_redirects=True
        ) as incoming:
            incoming.raise_for_status()
            if not media_url_allowed(incoming.url):
                raise MediaNotAvailable("Source redirected outside approved CDN")
            mime = incoming.headers.get("Content-Type", "").split(";")[0].lower().strip()
            accepted = {"image/jpeg", "image/png"} if kind == "photo" else {"video/mp4"}
            if mime not in accepted:
                raise MediaNotAvailable(f"Unsupported media format: {mime or 'unknown'}")
            if int(incoming.headers.get("Content-Length", "0") or "0") > max_bytes:
                raise MediaNotAvailable("Media exceeds upload size limit")
            data = bytearray()
            for chunk in incoming.iter_content(chunk_size=128 * 1024):
                data.extend(chunk)
                if len(data) > max_bytes:
                    raise MediaNotAvailable("Media exceeds upload size limit")
    except MediaNotAvailable:
        raise
    except (requests.RequestException, ValueError) as exc:
        raise MediaNotAvailable(type(exc).__name__) from None

    extension = "jpg" if mime == "image/jpeg" else "png" if mime == "image/png" else "mp4"
    method = "sendPhoto" if kind == "photo" else "sendVideo"
    field = "photo" if kind == "photo" else "video"
    destination = "https://api.telegram.org/bot" + token + "/" + method
    try:
        delivered = requests.post(
            destination,
            data={"chat_id": str(channel), "caption": caption, "parse_mode": "HTML"},
            files={field: ("nashani." + extension, bytes(data), mime)},
            timeout=(12, 120)
        )
    except requests.RequestException:
        # An ambiguous network failure may have happened *after* delivery.
        raise RuntimeError("Telegram media delivery outcome is uncertain") from None
    if delivered.status_code != 200:
        try:
            detail = str(delivered.json().get("description", ""))[:160]
        except (ValueError, AttributeError):
            detail = ""
        logging.warning("Telegram %s returned HTTP %s: %s",
                        method, delivered.status_code, detail)
        # A 400 rejection is definitive and safe to replace by text.
        if delivered.status_code == 400:
            raise MediaNotAvailable("Telegram rejected this media")
        raise RuntimeError("Telegram media delivery rejected")
    try:
        response = delivered.json()
        if response.get("ok") is not True:
            raise RuntimeError("Telegram did not confirm the media delivery")
        return response["result"]["message_id"]
    except (KeyError, ValueError, TypeError):
        raise RuntimeError("Telegram media response could not be verified") from None

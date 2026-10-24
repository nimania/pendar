"""Opt-in Instagram Business Discovery reader for verified figure profiles.

Uses the official Meta Graph API with Facebook Login; it NEVER scrapes Instagram
HTML, guesses usernames, downloads media, or stores full captions. A Professional
Instagram account linked to a Facebook Page and Meta-approved permissions are
required. A short excerpt and the canonical permalink are retained.
"""
from __future__ import annotations

import os
import re
from datetime import datetime
from urllib.parse import urlsplit, urlunsplit

import httpx

from app.figures import FIGURES, FIGURE_REGION, figure_source_name
from app.ingestion.normalize import strip_html
from app.ingestion.schemas import NormalizedItem
from app.models.source import Source

_USERNAME_RE = re.compile(r"[A-Za-z0-9._]{1,30}")
_VERSION_RE = re.compile(r"v[0-9]+\.[0-9]+")
_MEDIA_PATH_RE = re.compile(r"/(?:p|reel|tv)/[A-Za-z0-9_-]+/?")
TITLE_MAX = 140
EXCERPT_MAX = 700


def _clip(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return (text[:limit].rsplit(" ", 1)[0] or text[:limit]) + "…"


def _username_from_url(url: str) -> str | None:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or (parsed.hostname or "").lower() not in {
        "instagram.com", "www.instagram.com",
    }:
        return None
    name = parsed.path.strip("/")
    return name if _USERNAME_RE.fullmatch(name) else None


def configured_figure_username(source: Source) -> str | None:
    """Only manually allowlisted, pre-registered Instagram identities can be read."""
    if source.region != FIGURE_REGION:
        return None
    allowlist = {
        item.strip().lstrip("@").lower()
        for item in os.getenv("PENDAR_IG_ALLOWLIST", "").split(",")
        if item.strip()
    }
    if not allowlist:
        return None
    for figure in FIGURES:
        if source.name != figure_source_name(figure):
            continue
        for kind, url in figure.social:
            username = _username_from_url(url) if kind == "instagram" else None
            if username and username.lower() in allowlist:
                return username
    return None


def _canonical_permalink(url: str) -> str | None:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or (parsed.hostname or "").lower() not in {
        "instagram.com", "www.instagram.com",
    }:
        return None
    if not _MEDIA_PATH_RE.fullmatch(parsed.path):
        return None
    return urlunsplit(("https", "www.instagram.com", parsed.path.rstrip("/") + "/", "", ""))


def parse_business_discovery(
    payload: dict,
    username: str,
    source: Source,
) -> list[NormalizedItem]:
    """Normalize an API response; reject mismatched identity and invalid URLs."""
    discovered = payload.get("business_discovery") if isinstance(payload, dict) else None
    if not isinstance(discovered, dict):
        raise ValueError("Meta Business Discovery returned no accessible profile")
    if str(discovered.get("username", "")).casefold() != username.casefold():
        raise ValueError("Meta Business Discovery username did not match requested profile")
    media = discovered.get("media") or {}
    if not isinstance(media, dict) or not isinstance(media.get("data", []), list):
        raise ValueError("Meta Business Discovery media format invalid")

    items: list[NormalizedItem] = []
    for row in media.get("data", []):
        if not isinstance(row, dict):
            continue
        permalink = _canonical_permalink(str(row.get("permalink") or ""))
        caption = row.get("caption")
        if not permalink or not isinstance(caption, str):
            continue
        excerpt = strip_html(caption.replace("\r", "\n")) or ""
        if len(excerpt.strip()) < 20:
            continue
        first = next((line.strip() for line in caption.splitlines() if line.strip()), "")
        title = _clip(strip_html(first) or excerpt, TITLE_MAX)
        posted = None
        if isinstance(row.get("timestamp"), str):
            try:
                posted = datetime.fromisoformat(row["timestamp"].replace("Z", "+00:00"))
            except ValueError:
                pass
        items.append(NormalizedItem(
            title=title,
            article_url=permalink,
            description=_clip(excerpt, EXCERPT_MAX),
            published_at=posted,
            author=source.name,
            language=source.language or "fa",
            image_url=None,
            raw_content=None,
        ))
    return items


def fetch_business_discovery(
    username: str,
    source: Source,
    *,
    ig_user_id: str,
    token: str,
    graph_version: str = "v26.0",
) -> list[NormalizedItem]:
    """Fetch one page of recent posts. The bearer token is NEVER put in the URL."""
    if not _USERNAME_RE.fullmatch(username):
        raise ValueError("Invalid Instagram username")
    if not ig_user_id.isdecimal() or not _VERSION_RE.fullmatch(graph_version):
        raise ValueError("Invalid Meta Graph configuration")
    fields = (
        f"business_discovery.username({username})"
        "{username,media.limit(20){id,caption,media_type,permalink,timestamp}}"
    )
    response = httpx.get(
        f"https://graph.facebook.com/{graph_version}/{ig_user_id}",
        params={"fields": fields},
        headers={"Authorization": f"Bearer {token}"},
        timeout=20,
    )
    response.raise_for_status()
    return parse_business_discovery(response.json(), username, source)


def fetch_configured_figure_instagram(source: Source) -> list[NormalizedItem]:
    """Return [] when disabled. No tokens or session cookies are persisted."""
    username = configured_figure_username(source)
    if not username:
        return []
    ig_user_id = os.getenv("PENDAR_IG_USER_ID", "").strip()
    token = os.getenv("PENDAR_IG_ACCESS_TOKEN", "").strip()
    if not (ig_user_id and token):
        return []  # safely off until a permitted Meta app is configured
    return fetch_business_discovery(
        username, source, ig_user_id=ig_user_id, token=token,
        graph_version=os.getenv("PENDAR_IG_GRAPH_VERSION", "v26.0"),
    )

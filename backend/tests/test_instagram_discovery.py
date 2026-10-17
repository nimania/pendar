"""Offline tests for opt-in Instagram ingestion. Never call the real Meta API."""
from __future__ import annotations

from datetime import timezone
from urllib.parse import urlsplit

import pytest

from app.figures import FIGURES, FIGURE_REGION, figure_source_name
from app.ingestion.instagram_discovery import (
    configured_figure_username,
    fetch_business_discovery,
    parse_business_discovery,
)
from app.ingestion.service import ingest_source
from app.models.article import Article
from app.models.enums import FeedType
from app.models.source import Source


def _figure_with_instagram():
    return next(f for f in FIGURES if any(kind == "instagram" for kind, _ in f.social))


def _source():
    figure = _figure_with_instagram()
    return Source(
        name=figure_source_name(figure),
        homepage_url="https://t.me/test",
        feed_url="https://t.me/s/test",
        feed_type=FeedType.telegram,
        region=FIGURE_REGION,
        language="fa",
    )


def _payload(username="verified_user"):
    return {
        "business_discovery": {
            "username": username,
            "media": {"data": [
                {
                    "id": "123",
                    "caption": "این یک نمونه مطلب تحلیلی است که برای آزمایش دریافت از اینستاگرام نوشته شده است.",
                    "media_type": "VIDEO",
                    "permalink": "https://www.instagram.com/reel/Abc123/?igsh=tracking",
                    "timestamp": "2026-10-17T08:00:00+0000",
                },
                {
                    "caption": "A malicious source URL must be ignored in the ingestion flow.",
                    "permalink": "https://www.instagram.com.evil.test/p/Abc123/",
                },
                {
                    "caption": "لینک معتبر ولی کپشن بسیار کوتاه",
                    "permalink": "https://www.instagram.com/p/Different/",
                },
            ]},
        },
    }


def test_allowlist_uses_only_figure_verified_social_links(monkeypatch):
    figure = _figure_with_instagram()
    expected = next(url.rstrip("/").split("/")[-1] for kind, url in figure.social if kind == "instagram")
    monkeypatch.delenv("PENDAR_IG_ALLOWLIST", raising=False)
    assert configured_figure_username(_source()) is None
    monkeypatch.setenv("PENDAR_IG_ALLOWLIST", "unrelated,@" + expected.upper())
    assert configured_figure_username(_source()).lower() == expected.lower()
    unknown = Source(name="Unregistered News", feed_url="https://example.test/rss", region="iran")
    assert configured_figure_username(unknown) is None


def test_parser_keeps_short_excerpt_original_link_and_utc():
    source = _source()
    rows = parse_business_discovery(_payload(), "verified_user", source)
    assert len(rows) == 2
    assert rows[0].article_url == "https://www.instagram.com/reel/Abc123/"
    assert "نمونه مطلب" in rows[0].description
    assert rows[0].published_at.tzinfo == timezone.utc
    assert rows[0].raw_content is None
    assert rows[0].image_url is None


def test_parser_rejects_username_mismatch_and_no_access():
    source = _source()
    with pytest.raises(ValueError, match="username"):
        parse_business_discovery(_payload("different"), "verified_user", source)
    with pytest.raises(ValueError, match="accessible"):
        parse_business_discovery({"error": {"message": "permission denied"}}, "verified_user", source)


def test_api_uses_authorization_header_not_token_in_url(monkeypatch):
    import app.ingestion.instagram_discovery as ig

    called = {}
    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return _payload()

    def fake_get(url, *, params, headers, timeout):
        called.update(url=url, params=params, headers=headers, timeout=timeout)
        return FakeResponse()

    monkeypatch.setattr(ig.httpx, "get", fake_get)
    rows = fetch_business_discovery("verified_user", _source(),
        ig_user_id="1234567", token="super-secret-token", graph_version="v26.0")
    assert len(rows) == 2
    assert called["headers"]["Authorization"] == "Bearer super-secret-token"
    assert "super-secret-token" not in called["url"]
    assert "super-secret-token" not in str(called["params"])
    assert urlsplit(called["url"]).hostname == "graph.facebook.com"
    with pytest.raises(ValueError, match="Invalid Instagram username"):
        fetch_business_discovery("invalid)fields=bad", _source(),
            ig_user_id="123", token="secret")


def test_figure_ingestion_merges_instagram_posts_and_is_idempotent(db, monkeypatch):
    import app.ingestion.instagram_discovery as ig

    source = _source()
    db.add(source)
    db.commit()
    monkeypatch.setattr(ig, "fetch_configured_figure_instagram",
                        lambda src: parse_business_discovery(_payload(), "verified_user", src))
    first = ingest_source(db, source, fetcher=lambda url: "<html></html>")
    assert first.new == 2
    assert all(a.source_id == source.id for a in db.query(Article).all())
    assert any(a.article_url == "https://www.instagram.com/reel/Abc123/"
               for a in db.query(Article).all())
    second = ingest_source(db, source, fetcher=lambda url: "<html></html>")
    assert second.new == 0
    assert second.duplicates == 2


def test_telegram_ingestion_survives_instagram_failure(db, monkeypatch):
    import app.ingestion.instagram_discovery as ig

    source = _source()
    db.add(source)
    db.commit()
    def failed(_):
        raise RuntimeError("Meta permission not approved")
    monkeypatch.setattr(ig, "fetch_configured_figure_instagram", failed)
    result = ingest_source(db, source, fetcher=lambda url: "<html></html>")
    assert result.status == "ok"
    assert result.errors == 1
    assert result.message == "instagram_discovery_failed"

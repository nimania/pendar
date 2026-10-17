"""Treat distribution channels of the same publisher as one independent source.

Both the site RSS and its Telegram channel retain their separate Article records
and original URLs. Publisher identity is used only when counting corroborating
sources, not when collecting or displaying posts.
"""
from __future__ import annotations

from app.models.article import Article

PUBLISHER_BY_SOURCE_NAME = {
    "خبرآنلاین": "khabaronline",
    "خبرآنلاین — تلگرام": "khabaronline",
}


def publisher_identity(article: Article) -> str:
    publisher = PUBLISHER_BY_SOURCE_NAME.get(article.source_name)
    return f"publisher:{publisher}" if publisher else f"source:{article.source_id}"

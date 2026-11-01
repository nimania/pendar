#!/usr/bin/env python3
"""Produce source-linked Pendar editorial assignments, NOT published reports."""
from __future__ import annotations
import argparse
import json
import uuid
from pathlib import Path
try:
    from backend.scripts.simorgh_intake import approved
except ImportError:
    from simorgh_intake import approved

ROOT = Path(__file__).resolve().parents[1]
IN = ROOT / "data/simorgh-leads.json"
OUT = ROOT / "data/simorgh-editorial-briefs.json"


def prepare(queue):
    if not isinstance(queue, dict) or not isinstance(queue.get("leads"), list):
        raise ValueError("Invalid editorial source queue")
    briefs = []
    for item in queue["leads"]:
        if not approved(item):
            continue
        news_id = str(uuid.uuid5(uuid.NAMESPACE_URL,
                                 "jan-kalam/simorgh/" + item["source_url"]))
        briefs.append({
            "id": "simorgh-" + item["id"],
            "type": "editorial_assignment",
            "status": "awaiting_authored_report",
            "reviewed_by": item["reviewed_by"],
            "source_published_at": item["source_published_at"],
            "approved_at": item["approved_at"],
            "working_title": item["approved_headline_fa"],
            "verified_lead": item["approved_summary_fa"],
            "significance": item["why_it_matters_fa"],
            "original_telegram_lead": item["source_url"],
            "independent_sources": item["independent_sources"],
            "jan_kalam_news_url": "https://nimania.github.io/jan-kalam/?story=" + news_id,
            "reporting_questions": [
                "زمینه و سابقه این رویداد بر اساس منابع معتبر چیست؟",
                "روایت‌ها و شواهد مستقل چه تفاوت‌هایی دارند؟",
                "چه نکاتی هنوز تأیید نشده‌اند و باید صریحاً مشروط بیان شوند؟",
                "پیامدهای قابل بررسی برای ایران و شهروندان چیست؟"
            ],
            "instructions": "گزارش مستقل با نام نویسنده واقعی تولید شود؛ صرفاً داده‌های قابل استناد را به کار ببرید. این فایل، گزارش منتشرشده نیست.",
            "destinations_after_approval": ["Pendar authored report", "@pendario Telegram"],
        })
    return {"version": 1, "briefs": sorted(briefs, key=lambda x: x["approved_at"], reverse=True)}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", type=Path, default=IN)
    p.add_argument("--out", type=Path, default=OUT)
    args = p.parse_args()
    briefs = prepare(json.loads(args.input.read_text(encoding="utf-8")))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(briefs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(len(briefs["briefs"]), "verified leads assigned for authored reporting; nothing published")


if __name__ == "__main__":
    main()

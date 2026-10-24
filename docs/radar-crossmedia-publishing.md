# Radar Iran: shared three-output publishing contract (pilot)

Single editorial dossier → **Pendar Persian daily report**, **IranSignal English brief**, **YouTube Persian narration**.

This is a **staging-only** tool, not a scheduler or site publisher. It refuses drafts and short narration; however, `approved` is a human editorial assertion, not independent verification by the script.

## Prepare input
Write UTF-8 JSON with these fields:

```json
{
  "report_id": "2026-10-24-radar-v1",
  "date": "2026-10-24",
  "slug": "iran-scenario-update",
  "status": "approved",
  "headline_fa": "عنوان بازبینی‌شده",
  "summary_fa": "خلاصهٔ بازبینی‌شده",
  "article_fa": "پاراگراف‌های گزارش فارسی...",
  "headline_en": "Reviewed English headline",
  "summary_en": "Reviewed English summary",
  "article_en": "Independent English adaptation...",
  "narration_fa": "نقشهٔ امروز ... جان کلام ... فردا چه چیزی را زیر نظر بگیریم ...",
  "sources": [
    {"title":"Original source A","url":"https://example.com/a","published_at":"2026-10-24T08:00:00Z"},
    {"title":"Independent source B","url":"https://example.org/b","published_at":"2026-10-24T09:00:00Z"}
  ]
}
```

Example entries are **schema examples, not actual journalism**. Add real attributed sources only after checking them. Duplicated syndications do not count as independent.

## Stage assets
```bash
python backend/scripts/package_radar_daily.py approved-dossier.json --out /tmp/radar-day --wpm 130
```
The package contains `pendar-article.html`, `iransignal-article.html`, `youtube-narration-fa.md`, `iransignal-manifest-entry.json`, and `preflight.json`.

The word count is an estimate; actual speech must be **at least eight minutes**. Target 10–12 minutes without filler. An editor must review every source, score interpretation, opposing view, publication time and translation before setting status to approved.

## Release (not yet automated)
- Persian article's intended canonical path: `https://pendar.io/reports/daily/YYYY-MM-DD/slug/`. **Pendar router/build integration is pending; do not upload blindly.**
- English article should become `IranSignal/daily/YYYY-MM-DD/slug/index.html`. Add the generated record to its `daily/manifest.json` only after the article is deployed.
- Publish the YouTube video manually; only then add a verified URL to both articles.
- Use one report ID for all three outputs; maintain corrections and revised forecasts as dated revisions, not silent overwrites.
- Homepage prominent daily slot, cross-repo deploy workflow, and production narration generator remain to be implemented.

**Security:** static HTML escapes dossier strings; the generator never executes content, touches active workflows or publishes to either website.

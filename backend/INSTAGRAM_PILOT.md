# Instagram source ingestion — opt-in pilot

**Status:** code-ready on an isolated feature branch, **not live**. No Meta token,
Instagram session cookie, or application permission is supplied by this repository.

## Goal

Receive short, attributable excerpts of recent captioned Instagram posts and
Reels for **known figures** into the *existing* figure-source/statement workflow.
This does not turn a figure's opinion into independent reporting or into a
verified scenario signal. Keep the original Instagram permalink and timestamp.

## Supported access model

Use **Meta Instagram Graph API — Business Discovery, Facebook Login path**.
It requires an approved Meta app, an authenticated Instagram professional
account linked to a Facebook Page, and appropriate permissions/access level.
The target account must also be an eligible public professional account.
Personal/private accounts, Stories, full audio transcription and general
Instagram search are **not** covered by this implementation.

Use Meta's official docs and app review to verify current requirements:
- https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery
- https://www.postman.com/meta/instagram/folder/u4g5a2a/instagram-api-with-facebook-login

Do not substitute login-cookie scraping, unofficial mobile APIs, or proxy
rotation. This integration uses bearer authentication on server side.

## Setup (only after Meta approvals)

In the server or GitHub Actions Secrets (never checked into the repository),
configure:

```dotenv
PENDAR_IG_USER_ID=<numeric-id-of-the-owned-professional-instagram-account>
PENDAR_IG_ACCESS_TOKEN=<approved-meta-access-token>
PENDAR_IG_GRAPH_VERSION=v26.0
PENDAR_IG_ALLOWLIST=verified_username_1,verified_username_2
```

An allowlisted username must also appear as a valid
`("instagram", "https://instagram.com/<username>")` link in
`backend/app/figures.py`. Re-verify ownership and eligibility before enabling
each one. Empty allowlist or missing credentials results in **zero API calls**.

The first rollout should allowlist **one eligible figure** with a working
Telegram source, then 3–5 accounts after reviewing error rates and app quota.
Run `python -m pytest tests/test_instagram_discovery.py` from `backend/`
before enabling. Confirm in ingestion logs that the new original Instagram
permalink is saved as an Article associated with the *same figure source*,
and that repeated cycles do not duplicate it.

## Stored fields / limitations

- `article_url`: canonical `https://www.instagram.com/p/.../` or `/reel/.../`.
- `title`: first nonempty caption line, max 140 characters.
- `description`: short caption excerpt, max 700 characters.
- `published_at`: original Meta timestamp, if returned.
- `author`: existing Pendar figure source name.
- `raw_content` and media: **not stored**.
- Captionless posts and ineligible/private accounts are skipped. Captions are
  **not** transcriptions or proof of claims.
- Existing Telegram/Bale ingest continues if Instagram's API fails. If Telegram
  itself fails before normalization, this initial pilot does not independently
  recover Instagram posts; a later collector can decouple these fetch paths.
- External-only figures with their Telegram feed disabled are not collected by
  this pilot. Add dedicated source provisioning after the Meta API smoke test.
- No Facebook, hashtag discovery, global search or automatic new-figure creation.

## Acceptance checklist

1. Meta app approved; bearer token works for the configured caller.
2. Manual username allowlist is correct, with no identity ambiguity.
3. Run one test API request: expected username and `media.data` present.
4. Run one ingestion cycle. Posts keep exact permalinks and figure attribution.
5. Re-run: `new=0` for previously ingested posts.
6. Revoke/expire token: Telegram continues; logs record Instagram error.
7. Check copyright, retention, deletion, and Meta platform terms before broad
   enablement. Avoid media rehosting or unlicensed full-text archiving.

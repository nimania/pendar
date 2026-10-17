# Pendar Iran Radar — event-driven edge service

This is a **separate**, optional Cloudflare Worker / SQLite Durable Object, not
a replacement for pendar.io or GitHub Pages. The public site remains readable
when this service is down.

## What becomes live

- A Cron Trigger reads **three preselected publisher RSS feeds each minute**.
  New headlines are deduplicated and shown with the publisher's actual URL.
  They are **neutral, unverified candidates**; the system does not pretend one
  headline confirms a geopolitical event.
- Approved Pendar collectors can send already-scored and attributed events
  with `POST /v1/ingest`, authenticated by `INGEST_TOKEN`. No browser knows it.
- A Durable Object stores events and an append-only publication-observation log;
  active tabs hear a **WebSocket push** and fetch an updated evidence snapshot.
- WebSocket hibernation avoids holding a continuously billed process open. This
  is near-real-time **after the source is polled or the collector pushes**.
  It cannot make upstream news appear before a publisher publishes it.

## Setup (requires Cloudflare account access)

1. In Cloudflare, create an API token authorized to edit Workers for your account.
   In the GitHub repo set Actions secrets `CLOUDFLARE_API_TOKEN` and
   `RADAR_LIVE_INGEST_TOKEN` (a random, strong and unique secret), and set repository
   variable `CLOUDFLARE_ACCOUNT_ID` to the Cloudflare account ID.
2. Configure a Worker endpoint such as `https://<worker>.<account>.workers.dev`.
   Deploy manually with:
   `cd radar-live && npx wrangler@4 deploy`
   and set the Worker secret with
   `npx wrangler@4 secret put INGEST_TOKEN` (same value as GitHub secret).
   Alternatively the gated `radar-live-deploy.yml` workflow deploys on code
   changes using the GitHub repository settings above.
3. Add the public **HTTPS origin**, without `/v1` or trailing path, as GitHub
   repository variable `RADAR_LIVE_ORIGIN`. The next fast Pages deployment
   writes `data/iran-scenario-live-config.json` for the browser and sends
   scored signals using the secret.
4. Confirm `/health` is reachable and, on pendar.io/radar/iran-scenarios/,
   the separate edge/WebSocket indicator says the event stream is connected.

Do not put the ingest secret in the Git repository, public JSON, `wrangler.toml`
or browser code. Do not use an unsafely broad token.

## Operational contracts

- GET `/health` — no secret; service diagnostic.
- GET `/v1/state` — last 1,500 signals, version and observation log.
- GET `/v1/ws` — requires WebSocket upgrade from pendar.io origin.
- POST `/v1/ingest` — bearer-token protected, batches at most 150 signals.
- Minute-level RSS check (three sources): Irna, Isna, Mehr. It is a best-effort
  complement to the longer-running official Pendar news/figures collectors.
- Source claims are not independent validation. Data points are directional
  signal indices, **never probability percentages**.
- The existing static charts and ledger remain the authoritative fallback.
- This Worker is an intentionally **independent service**. Deploying its source
  to GitHub does not provision or activate a Cloudflare account on its own.

Testing: `node --test radar-live/tests/*.test.mjs` (from repo root).

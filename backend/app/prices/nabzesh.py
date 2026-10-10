"""Bounded Nabzesh snapshots for the static market board (no browser API keys)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import json
import math
import os
import time
from urllib.error import HTTPError
from urllib.parse import urlencode, quote as quote_path, urlsplit
from urllib.request import Request, urlopen

BASE = "https://api.nabzesh.ir"
# Explicit units matter: commodity quotes are dollars, not cents or local retail prices.
GROUPS = [
    ("currency", "ارزها", "IRT", "تومان", [
        ("USD", "دلار آمریکا"), ("EUR", "یورو"), ("GBP", "پوند"),
        ("AED", "درهم امارات"), ("TRY", "لیر ترکیه"), ("CNY", "یوان چین"),
        ("CAD", "دلار کانادا"), ("AUD", "دلار استرالیا"), ("CHF", "فرانک سوئیس"),
        ("JPY", "ین ژاپن"), ("IQD", "دینار عراق"), ("MYR", "رینگیت مالزی"),
    ]),
    ("metals", "طلا، نقره و سکه", "IRT", "تومان", [
        ("GOLD18", "طلای ۱۸ عیار · گرم"), ("GOLD24", "طلای ۲۴ عیار · گرم"),
        ("GOLD18_USED", "طلای دست دوم · گرم"), ("SILVER999", "نقره ۹۹۹ · گرم"),
        ("SILVER925", "نقره ۹۲۵ · گرم"), ("COIN_EMAMI", "سکه امامی"),
        ("COIN_BAHAR", "سکه بهار آزادی"), ("COIN_HALF", "نیم‌سکه"),
        ("COIN_QUARTER", "ربع‌سکه"), ("COIN_GERAMI", "سکه گرمی"),
    ]),
    ("indicators", "نرخ رسمی و حباب سکه", "IRT", "تومان", [
        ("USD_OFFICIAL", "دلار · نرخ رسمی منبع"),
        ("BUBBLE_COIN_EMAMI", "حباب سکه امامی"),
        ("BUBBLE_COIN_BAHAR", "حباب سکه بهار آزادی"),
        ("BUBBLE_COIN_HALF", "حباب نیم‌سکه"),
        ("BUBBLE_COIN_QUARTER", "حباب ربع‌سکه"),
    ]),
    ("crypto", "رمزارزها به تومان", "IRT", "تومان", [
        ("USDT", "تتر"), ("BTC", "بیت‌کوین"), ("ETH", "اتریوم"),
        ("SOL", "سولانا"), ("BNB", "بی‌ان‌بی"), ("XRP", "ریپل"), ("DOGE", "دوج‌کوین"),
    ]),
    ("energy", "انرژی و فلزات جهانی", "USD", "دلار", [
        ("BRENT", "نفت برنت · بشکه"), ("WTI", "نفت WTI · بشکه"),
        ("XAU", "طلای جهانی · اونس"), ("XAG", "نقره جهانی · اونس"),
    ]),
    ("food", "مواد اولیهٔ غذا در بازار جهانی", "USD", "دلار", [
        ("COFFEE_US", "قهوه عربیکا · پوند"), ("COFFEE_LONDON", "قهوه روبوستا · تن"),
        ("COCOA", "کاکائو · تن"), ("WHEAT_US", "گندم آمریکا · بوشل"),
        ("CORN_US", "ذرت آمریکا · بوشل"), ("SOYBEAN_OIL", "روغن سویا · پوند"),
        ("SUGAR_US", "شکر آمریکا · پوند"),
    ]),
    ("indexes", "شاخص‌های بورس", "POINT", "واحد شاخص", [
        ("TEDPIX", "شاخص کل بورس تهران"), ("SP500", "اس‌اند‌پی ۵۰۰"),
        ("DJI", "داو جونز"), ("NASDAQ", "نزدک کامپوزیت"),
    ]),
]
DETAILS = [("USD", "IRT"), ("GOLD18", "IRT"), ("COIN_EMAMI", "IRT"),
           ("USDT", "IRT"), ("BRENT", "USD"), ("COFFEE_US", "USD")]


def api_url(path, **params):
    return BASE + path + ("?" + urlencode(params) if params else "")


def provider_metadata(provider):
    """Credit only metadata supplied by Nabzesh, never guess an upstream API."""
    slug = provider.get("slug")
    if not isinstance(slug, str) or not slug:
        return None
    website = provider.get("websiteUrl")
    try:
        parsed = urlsplit(website or "")
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
            website = None
    except ValueError:
        website = None
    names = provider.get("name") or {}
    return {"slug": slug, "name_fa": names.get("fa") or names.get("en") or slug,
            "website_url": website, "role": provider.get("role"),
            "api_url": api_url("/v1/providers/" + quote_path(slug, safe=""))}


def number(value):
    """Missing comparisons must remain missing; never manufacture a zero move."""
    if value is None or isinstance(value, bool):
        return None
    try:
        value = float(Decimal(str(value)))
        return value if math.isfinite(value) else None
    except (InvalidOperation, TypeError, ValueError, OverflowError):
        return None


class Client:
    def __init__(self, timeout=12):
        self.timeout = timeout
        self.last_request = 0.0

    def get(self, path, **params):
        # Anonymous advanced bucket refills at one token/second. Keep the entire
        # bounded snapshot below this even if upstream responses are cached.
        delay = 1.1 - (time.monotonic() - self.last_request)
        if delay > 0:
            time.sleep(delay)
        self.last_request = time.monotonic()
        headers = {"User-Agent": "PendarMarket/1.0", "Accept": "application/json"}
        key = os.environ.get("NABZESH_API_KEY", "").strip()
        if key:
            headers["x-api-key"] = key
        req = Request(BASE + path + ("?" + urlencode(params) if params else ""), headers=headers)
        try:
            with urlopen(req, timeout=self.timeout) as response:
                return json.load(response)
        except HTTPError as exc:
            # Never emit an upstream response, request headers or credentials.
            raise RuntimeError(f"Nabzesh HTTP {exc.code}") from None


def normalize(ticker, label, group, quote, unit, price):
    if not isinstance(price, dict) or price.get("quote") != quote:
        return None
    value = number(price.get("price"))
    if value is None or (value <= 0 and group != "indicators"):
        return None
    change = price.get("change") or {}
    sources = sorted({s["provider"] for hop in price.get("hops", [])
                      for s in hop.get("sources", []) if s.get("used") and s.get("provider")})
    source_hops = [{"from": hop.get("from"), "to": hop.get("to"),
                    "sources": [{"provider": s["provider"], "price_decimal": s.get("price"),
                                 "updated_at": s.get("time"), "is_stale": s.get("isStale", True)}
                                for s in hop.get("sources", []) if s.get("used") and s.get("provider")]}
                   for hop in price.get("hops", [])]
    return {
        "ticker": ticker, "label_fa": label, "group": group, "quote": quote,
        "value": value, "price_decimal": price["price"], "unit_fa": unit,
        "dp": number(change.get("percent")), "delta24": number(change.get("absolute")),
        "dir": change.get("direction"), "updated_at": price.get("updatedAt"),
        "as_of": price.get("asOf"), "is_stale": price.get("isStale", True),
        "sources": sources, "path": price.get("path", []), "strategy": price.get("strategy"),
        "source_hops": source_hops,
        "api": {"price": api_url("/v1/rates", tickers=ticker, quote=quote, compare="24h", strategy="median")},
    }


def fetch_snapshot(client=None):
    client = client or Client()
    now = datetime.now(timezone.utc)
    rows, errors = [], []
    # One batch per quote. IRT contains 34 symbols (<50); it costs two tokens.
    for quote in ("IRT", "USD", "POINT"):
        specs = [(g, u, ticker, label) for g, _, q, u, items in GROUPS if q == quote
                 for ticker, label in items]
        try:
            params = {"tickers": ",".join(x[2] for x in specs), "quote": quote,
                      "compare": "24h", "strategy": "median"}
            data = client.get("/v1/rates", **params)
            found = {r.get("ticker"): r.get("price") for r in data.get("data", [])}
            for group, unit, ticker, label in specs:
                row = normalize(ticker, label, group, quote, unit, found.get(ticker))
                if row:
                    row["api"]["price_batch"] = api_url("/v1/rates", **params)
                    rows.append(row)
                else:
                    errors.append({"ticker": ticker, "kind": "price_unavailable"})
        except Exception:
            errors.append({"quote": quote, "kind": "request_failed"})

    lookup = {(r["ticker"], r["quote"]): r for r in rows}
    for ticker, quote in DETAILS:
        row = lookup.get((ticker, quote))
        if not row:
            continue
        for endpoint in ("stats", "chart"):
            try:
                params = {"quote": quote, "strategy": "median"}
                if endpoint == "chart":
                    params.update(interval="1d", **{"from": (now - timedelta(days=30)).isoformat(), "to": now.isoformat()})
                result = client.get(f"/v1/currencies/{ticker}/{endpoint}", **params)
                if result.get("base") == ticker and result.get("quote") == quote:
                    row[endpoint] = result
                    row["api"][endpoint] = api_url(f"/v1/currencies/{ticker}/{endpoint}", **params)
            except Exception:
                errors.append({"ticker": ticker, "kind": endpoint + "_unavailable"})
        if ticker in ("USD", "GOLD18", "USDT"):
            try:
                result = client.get(f"/v1/currencies/{ticker}/spread", quote=quote)
                if result.get("base") == ticker and result.get("quote") == quote:
                    row["spread"] = result
                    row["api"]["spread"] = api_url(f"/v1/currencies/{ticker}/spread", quote=quote)
            except Exception:
                errors.append({"ticker": ticker, "kind": "spread_unavailable"})

    providers = {}
    try:
        catalog = client.get("/v1/providers")
        for provider in catalog.get("data", []):
            metadata = provider_metadata(provider)
            if metadata:
                providers[metadata["slug"]] = metadata
    except Exception:
        errors.append({"kind": "provider_metadata_unavailable"})

    return {"schema_version": 2, "source": "نبضش", "source_url": BASE + "/docs",
            "generated_at": now.isoformat(), "strategy": "median", "rows": rows,
            "providers": providers, "providers_api_url": api_url("/v1/providers"),
            "groups": [{"id": g, "label_fa": label} for g, label, *_ in GROUPS],
            "errors": errors}

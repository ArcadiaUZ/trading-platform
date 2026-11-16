#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OPEN ma'lumot provayderlari (API kalitsiz, bepul manbalar).

Manbalar (ORDER: mt5 -> yahoo -> stooq -> goldapi):
  1. Yahoo Finance chart JSON - XAUUSD uchun GC=F (gold futures proxy),
     GBPUSD uchun GBPUSD=X. OHLC bar + meta.regularMarketPrice (last price).
  2. Stooq CSV - xauusd / gbpusd (quote CSV; D1 barlar uchun /q/d/l/).
  3. gold-api.com - faqat XAU spot narxi (oxirgi zaxira).

Har bir chaqiruv: timeout 6s (OPEN_HTTP_TIMEOUT), 2 retry (OPEN_HTTP_RETRIES).
Umumiy muvaffaqiyatsizlikda None qaytariladi va hech qachon exception
websocket loop'ga tashlanmaydi.

Bu modul faqat stdlib ishlatadi (requests/httpx kerak emas), shuning uchun
mavjud venv'ga hech narsa o'rnatish talab qilinmaydi.
"""
from __future__ import annotations

import asyncio
import csv
import io
import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

LOG = logging.getLogger("feed.open")

# --- sozlamalar -------------------------------------------------------------
HTTP_TIMEOUT = float(os.getenv("OPEN_HTTP_TIMEOUT", "6"))
HTTP_RETRIES = int(os.getenv("OPEN_HTTP_RETRIES", "2"))
QUOTE_BUDGET_S = float(os.getenv("OPEN_QUOTE_BUDGET", "8"))    # barcha provayderlar uchun umumiy limit
BARS_BUDGET_S = float(os.getenv("OPEN_BARS_BUDGET", "14"))
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

TF_SECONDS: dict[str, int] = {
    "D1": 86400, "H4": 14400, "H1": 3600,
    "M15": 900, "M5": 300, "M3": 180, "M1": 60,
}
DIGITS: dict[str, int] = {"XAUUSD": 3, "GBPUSD": 5}
SUPPORTED: tuple[str, ...] = tuple(DIGITS)
NOTES = {
    "yahoo": "yahoo chart JSON, 1m bar ~1-2 daqiqa kechikishi mumkin, XAU=GC=F (futures)",
    "stooq": "stooq CSV, faqat quote + kunlik (D1) barlar",
    "goldapi": "gold-api.com, faqat XAU spot narxi (bar yo'q)",
}


def _digits(sym: str) -> int:
    return DIGITS.get(str(sym or "").upper(), 5)


# ---------------------------------------------------------------------------
# HTTP (stdlib, thread'da)
# ---------------------------------------------------------------------------
def _sync_fetch(url: str, timeout: float) -> tuple[int, bytes]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": UA, "Accept": "application/json,text/csv,*/*"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return int(response.status), response.read()


async def http_get(url: str, timeout: Optional[float] = None,
                   retries: Optional[int] = None) -> tuple[int, bytes]:
    """GET so'rov: retry bilan. Muhim xatoda HTTPError/URLError tashlaydi."""
    timeout = HTTP_TIMEOUT if timeout is None else timeout
    retries = HTTP_RETRIES if retries is None else retries
    last: Optional[BaseException] = None
    for attempt in range(retries + 1):
        try:
            status, body = await asyncio.wait_for(
                asyncio.to_thread(_sync_fetch, url, timeout), timeout + 1.5
            )
            if status >= 500 and attempt < retries:
                last = RuntimeError(f"HTTP {status}")
            else:
                return status, body
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code < 500 and exc.code != 429:
                raise
        except Exception as exc:  # timeout, DNS, SSL, ...
            last = exc
        if attempt < retries:
            await asyncio.sleep(0.35 * (attempt + 1))
    raise last if last is not None else RuntimeError("http_get failed")


# ---------------------------------------------------------------------------
# Bar yordamchilari
# ---------------------------------------------------------------------------
def _resample(rows: list[tuple], period: int, digits: int) -> list[list]:
    """(t,o,h,l,c,v) -> shu periodga bucketlangan barlar, o'sish tartibida."""
    buckets: dict[int, list] = {}
    order: list[int] = []
    for row in rows:
        t, o, h, l, c, v = row
        try:
            bucket = int(t) - int(t) % period
        except (TypeError, ValueError):
            continue
        bar = buckets.get(bucket)
        if bar is None:
            buckets[bucket] = [bucket, round(float(o), digits), round(float(h), digits),
                               round(float(l), digits), round(float(c), digits), int(v)]
            order.append(bucket)
        else:
            bar[2] = max(bar[2], round(float(h), digits))
            bar[3] = min(bar[3], round(float(l), digits))
            bar[4] = round(float(c), digits)
            bar[5] = int(bar[5]) + int(v)
    return [buckets[b] for b in order]


def _pack(name: str, bars: list[list], delay_s: float) -> dict:
    return {
        "bars": bars,
        "provider": name,
        "delay_s": round(max(0.0, float(delay_s)), 1),
    }


# ---------------------------------------------------------------------------
# 1. Yahoo Finance
# ---------------------------------------------------------------------------
class YahooProvider:
    """Yahoo Finance chart JSON. Kalit kerak emas."""

    name = "yahoo"
    has_bars = True
    supports_quote = frozenset(DIGITS)
    SYMBOLS = {"XAUUSD": "GC=F", "GBPUSD": "GBPUSD=X"}
    BASE = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}"
    # tf -> (yahoo interval, ruxsat etilgan range'lar)
    INTERVALS: dict[str, tuple[str, tuple[str, ...]]] = {
        "M1": ("1m", ("1d", "5d")),
        "M3": ("1m", ("1d", "5d")),
        "M5": ("5m", ("1d", "5d", "1mo")),
        "M15": ("15m", ("1d", "5d", "1mo")),
        "H1": ("60m", ("1d", "5d", "1mo", "3mo", "6mo", "1y", "2y")),
        "H4": ("60m", ("1d", "5d", "1mo", "3mo", "6mo", "1y", "2y")),
        "D1": ("1d", ("1mo", "3mo", "6mo", "1y", "2y", "5y")),
    }
    RANGE_SECONDS = {
        "1d": 86400, "5d": 5 * 86400, "1mo": 30 * 86400, "3mo": 90 * 86400,
        "6mo": 180 * 86400, "1y": 365 * 86400, "2y": 730 * 86400, "5y": 1825 * 86400,
    }

    def supports(self, sym: str) -> bool:
        return str(sym or "").upper() in self.SYMBOLS

    def _pick_range(self, tf: str, n: int) -> str:
        """n bar uchun eng kichik yetarli range (interval limitlarini hisobga oladi)."""
        _, allowed = self.INTERVALS[tf]
        need = max(1, int(n)) * TF_SECONDS[tf] * 2.5
        for range_name in allowed:
            if self.RANGE_SECONDS[range_name] >= need:
                return range_name
        return allowed[-1]

    @staticmethod
    def _parse_chart(payload: dict) -> tuple[list[tuple], dict]:
        chart = payload.get("chart") or {}
        results = chart.get("result") or []
        if not results:
            error = chart.get("error")
            raise ValueError(f"yahoo: natija yo'q ({error})")
        result = results[0]
        meta = result.get("meta") or {}
        timestamps = result.get("timestamp") or []
        indicators = result.get("indicators") or {}
        quote = (indicators.get("quote") or [{}])[0]
        opens = quote.get("open") or []
        highs = quote.get("high") or []
        lows = quote.get("low") or []
        closes = quote.get("close") or []
        volumes = quote.get("volume") or []
        rows: list[tuple] = []
        for index, ts in enumerate(timestamps):
            try:
                o, h, l, c = opens[index], highs[index], lows[index], closes[index]
            except IndexError:
                break
            if None in (o, h, l, c):
                continue
            volume = volumes[index] if index < len(volumes) and volumes[index] is not None else 0
            rows.append((int(ts), float(o), float(h), float(l), float(c), int(volume)))
        return rows, meta

    async def bars(self, sym: str, tf: str, n: int = 600) -> Optional[dict]:
        sym = str(sym or "").upper()
        tf = str(tf or "").upper()
        ticker = self.SYMBOLS.get(sym)
        spec = self.INTERVALS.get(tf)
        if ticker is None or spec is None:
            return None
        interval = spec[0]
        range_name = self._pick_range(tf, n)
        url = (
            self.BASE.format(sym=urllib.parse.quote(ticker, safe=""))
            + f"?interval={interval}&range={range_name}&includePrePost=false"
        )
        status, body = await http_get(url)
        payload = json.loads(body.decode("utf-8", "replace"))
        rows, _meta = self._parse_chart(payload)
        if not rows:
            return None
        bars = _resample(rows, TF_SECONDS[tf], _digits(sym))
        if not bars:
            return None
        bars = bars[-max(1, int(n)):]
        return _pack(self.name, bars, time.time() - bars[-1][0])

    async def quote(self, sym: str) -> Optional[dict]:
        sym = str(sym or "").upper()
        ticker = self.SYMBOLS.get(sym)
        if ticker is None:
            return None
        url = (
            self.BASE.format(sym=urllib.parse.quote(ticker, safe=""))
            + "?interval=1m&range=1d&includePrePost=false"
        )
        _status, body = await http_get(url)
        payload = json.loads(body.decode("utf-8", "replace"))
        rows, meta = self._parse_chart(payload)
        price = meta.get("regularMarketPrice")
        ts = meta.get("regularMarketTime")
        if price is None and rows:
            price, ts = rows[-1][4], rows[-1][0]
        if price is None:
            return None
        return {
            "last": round(float(price), _digits(sym)),
            "ts": int(ts or (rows[-1][0] if rows else time.time())),
            "provider": self.name,
        }


# ---------------------------------------------------------------------------
# 2. Stooq CSV
# ---------------------------------------------------------------------------
class StooqProvider:
    """Stooq CSV: quote har doim, bar faqat kunlik (D1)."""

    name = "stooq"
    has_bars = True
    supports_quote = frozenset(DIGITS)
    SYMBOLS = {"XAUUSD": "xauusd", "GBPUSD": "gbpusd"}
    QUOTE = "https://stooq.com/q/l/?s={s}&f=sd2t2ohlc&h&e=csv"
    DAILY = "https://stooq.com/q/d/l/?s={s}&i=d"

    def __init__(self) -> None:
        try:
            from zoneinfo import ZoneInfo

            self._zone = ZoneInfo("Europe/Warsaw")
        except Exception:  # pragma: no cover - tzdata yo'q
            self._zone = timezone(timedelta(hours=1))

    def supports(self, sym: str) -> bool:
        return str(sym or "").upper() in self.SYMBOLS

    @staticmethod
    def _rows(body: bytes) -> list[list[str]]:
        text = body.decode("utf-8", "replace")
        reader = csv.reader(io.StringIO(text))
        return [row for row in reader if row]

    def _to_ts(self, date_text: str, time_text: str) -> Optional[int]:
        try:
            moment = datetime.strptime(f"{date_text} {time_text}", "%Y-%m-%d %H:%M:%S")
        except (TypeError, ValueError):
            return None
        return int(moment.replace(tzinfo=self._zone).timestamp())

    async def bars(self, sym: str, tf: str, n: int = 600) -> Optional[dict]:
        sym = str(sym or "").upper()
        tf = str(tf or "").upper()
        ticker = self.SYMBOLS.get(sym)
        if ticker is None or tf != "D1":
            return None  # stooq kunlik CSV'dan boshqa TF bermaydi
        status, body = await http_get(self.DAILY.format(s=ticker))
        rows = self._rows(body)
        if not rows:
            return None
        header = [cell.strip().lower() for cell in rows[0]]
        if "date" not in header:
            return None  # JS-challenge HTML yoki boshqa javob
        index = {name: header.index(name) for name in header}
        out: list[list] = []
        for row in rows[1:]:
            try:
                date_text = row[index["date"]]
                o = float(row[index["open"]])
                h = float(row[index["high"]])
                l = float(row[index["low"]])
                c = float(row[index["close"]])
            except (KeyError, IndexError, TypeError, ValueError):
                continue
            try:
                volume = int(float(row[index["volume"]])) if "volume" in index else 0
            except (IndexError, TypeError, ValueError):
                volume = 0
            try:
                ts = int(datetime.strptime(date_text, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp())
            except (TypeError, ValueError):
                continue
            digits = _digits(sym)
            out.append([ts, round(o, digits), round(h, digits), round(l, digits), round(c, digits), volume])
        if not out:
            return None
        out.sort(key=lambda bar: bar[0])
        out = out[-max(1, int(n)):]
        return _pack(self.name, out, time.time() - out[-1][0])

    async def quote(self, sym: str) -> Optional[dict]:
        sym = str(sym or "").upper()
        ticker = self.SYMBOLS.get(sym)
        if ticker is None:
            return None
        _status, body = await http_get(self.QUOTE.format(s=ticker))
        rows = self._rows(body)
        if len(rows) < 2:
            return None
        header = [cell.strip().lower() for cell in rows[0]]
        if "close" not in header:
            return None
        index = {name: header.index(name) for name in header}
        row = rows[1]
        try:
            close = float(row[index["close"]])
        except (KeyError, IndexError, TypeError, ValueError):
            return None
        try:
            ts = self._to_ts(row[index["date"]], row[index["time"]])
        except (KeyError, IndexError):
            ts = None
        return {
            "last": round(close, _digits(sym)),
            "ts": int(ts or time.time()),
            "provider": self.name,
        }


# ---------------------------------------------------------------------------
# 3. gold-api.com (spot, faqat XAU)
# ---------------------------------------------------------------------------
class GoldApiProvider:
    """https://api.gold-api.com/price/XAU - bepul spot narx, bar yo'q."""

    name = "goldapi"
    has_bars = False
    supports_quote = frozenset({"XAUUSD"})
    URL = "https://api.gold-api.com/price/XAU"

    def supports(self, sym: str) -> bool:
        return str(sym or "").upper() in self.supports_quote

    async def bars(self, sym: str, tf: str, n: int = 600) -> Optional[dict]:
        return None  # gold-api faqat spot

    async def quote(self, sym: str) -> Optional[dict]:
        if not self.supports(sym):
            return None
        sym = str(sym or "").upper()
        _status, body = await http_get(self.URL)
        payload = json.loads(body.decode("utf-8", "replace"))
        try:
            price = float(payload.get("price"))
        except (TypeError, ValueError):
            return None
        ts = None
        raw_ts = payload.get("updatedAt")
        if raw_ts:
            try:
                ts = int(datetime.fromisoformat(str(raw_ts).replace("Z", "+00:00")).timestamp())
            except (TypeError, ValueError):
                ts = None
        return {
            "last": round(price, _digits(sym)),
            "ts": int(ts or time.time()),
            "provider": self.name,
        }


# ---------------------------------------------------------------------------
# Menejer
# ---------------------------------------------------------------------------
class OpenProviders:
    """ORDER bo'yicha ishlaydigan provayderlar + holat (status) yuritish."""

    ORDER: tuple[str, ...] = ("mt5", "yahoo", "stooq", "goldapi")

    def __init__(self) -> None:
        self.providers: dict[str, Any] = {
            "yahoo": YahooProvider(),
            "stooq": StooqProvider(),
            "goldapi": GoldApiProvider(),
        }
        self.status: dict[str, dict] = {
            name: {"name": name, "ok": None, "last_ok_ts": None,
                   "last_err": None, "latency_ms": None}
            for name in self.ORDER
        }
        self._forced: Optional[str] = None
        self.active = "mt5"

    # -- holat -------------------------------------------------------------
    @property
    def forced(self) -> Optional[str]:
        return self._forced

    def select(self, name: Optional[str]) -> bool:
        """POST /api/provider uchun: 'mt5' -> force tozalash."""
        candidate = str(name or "").strip().lower()
        if candidate not in self.ORDER:
            return False
        self._forced = None if candidate == "mt5" else candidate
        self.active = candidate
        return True

    def _mark_ok(self, name: str, latency_s: float) -> None:
        state = self.status[name]
        state["ok"] = True
        state["last_ok_ts"] = int(time.time())
        state["last_err"] = None
        state["latency_ms"] = int(round(max(0.0, latency_s) * 1000))
        self.active = name

    def _mark_err(self, name: str, error: BaseException) -> None:
        state = self.status[name]
        state["ok"] = False
        state["last_err"] = f"{type(error).__name__}: {error}"[:300]

    def _open_order(self) -> list[str]:
        names = [name for name in self.ORDER if name != "mt5"]
        if self._forced and self._forced in self.providers:
            names = [self._forced] + [name for name in names if name != self._forced]
        return names

    def status_json(self) -> dict:
        rows = []
        for name in self.ORDER:
            state = self.status[name]
            rows.append({
                "name": name,
                "ok": state["ok"],
                "latency_ms": state["latency_ms"],
                "last_ok": state["last_ok_ts"],
                "last_err": state["last_err"],
                "note": NOTES.get(name, "MetaTrader5 (asosiy manba)" if name == "mt5" else ""),
            })
        return {
            "active": self.active,
            "forced": self._forced,
            "providers": rows,
            "note": "open data, no API key",
        }

    # -- ma'lumot ----------------------------------------------------------
    async def quote(self, sym: str) -> Optional[dict]:
        """Birinchi ishlaydigan provayderdan {last, ts, provider, latency_ms}."""
        deadline = time.monotonic() + QUOTE_BUDGET_S
        for name in self._open_order():
            provider = self.providers[name]
            if not provider.supports(sym):
                continue
            remaining = deadline - time.monotonic()
            if remaining <= 0.5:
                break
            started = time.monotonic()
            try:
                result = await asyncio.wait_for(
                    provider.quote(sym), max(1.5, remaining)
                )
            except Exception as exc:  # timeout/network/parse - keyingisiga o'tamiz
                self._mark_err(name, exc)
                LOG.debug("open quote %s xato: %r", name, exc)
                continue
            latency = time.monotonic() - started
            if not result or not result.get("last"):
                self._mark_err(name, RuntimeError("bo'sh javob"))
                continue
            result["provider"] = name
            result["latency_ms"] = int(round(latency * 1000))
            self._mark_ok(name, latency)
            return result
        return None

    async def bars(self, sym: str, tf: str, n: int = 600) -> Optional[dict]:
        """Birinchi ishlaydigan provayderdan {bars, provider, delay_s}."""
        deadline = time.monotonic() + BARS_BUDGET_S
        for name in self._open_order():
            provider = self.providers[name]
            if not getattr(provider, "has_bars", False) or not provider.supports(sym):
                continue
            remaining = deadline - time.monotonic()
            if remaining <= 0.5:
                break
            started = time.monotonic()
            try:
                result = await asyncio.wait_for(
                    provider.bars(sym, tf, n), max(1.5, remaining)
                )
            except Exception as exc:
                self._mark_err(name, exc)
                LOG.debug("open bars %s xato: %r", name, exc)
                continue
            latency = time.monotonic() - started
            if not result or not result.get("bars"):
                self._mark_err(name, RuntimeError("bo'sh javob"))
                continue
            result["latency_ms"] = int(round(latency * 1000))
            self._mark_ok(name, latency)
            return result
        return None


# Bitta global menejer (app.py shu nom bilan import qiladi)
OPEN = OpenProviders()

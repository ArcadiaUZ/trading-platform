#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OPEN data provayderlari testi (server talab qilinmaydi).

    python test_open.py
    python test_open.py --host 127.0.0.1 --port 8765   # serverdagi /api/providers ni ham tekshiradi

Chiqish kodi: 0 - yahoo ishladi (asosiy manba), 1 - yahoo ham ishlamadi.
stooq / goldapi ishlamasa bu FAIL emas - "unavailable" deb halol yoziladi.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SERVER_DIR))

import providers_open as po  # noqa: E402

RAW_PROBES = {
    "yahoo": "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1m&range=1d",
    "stooq": "https://stooq.com/q/l/?s=xauusd&f=sd2t2ohlc&h&e=csv",
    "goldapi": "https://api.gold-api.com/price/XAU",
}
ROWS: list[tuple[str, str, str]] = []


def row(provider: str, detail: str, ok: bool | None) -> None:
    status = "PASS" if ok else ("FAIL" if ok is False else "INFO")
    ROWS.append((provider, status, detail))
    print(f"{provider:9} {status:5} {detail}", flush=True)


def http_probe(url: str) -> tuple[int | None, int, str]:
    """Xom HTTP: (status, latency_ms, izoh)."""
    started = time.time()
    try:
        request = urllib.request.Request(url, headers={"User-Agent": po.UA})
        with urllib.request.urlopen(request, timeout=po.HTTP_TIMEOUT) as response:
            body = response.read(2000)
            return int(response.status), int((time.time() - started) * 1000), f"{len(body)}B"
    except urllib.error.HTTPError as exc:
        return exc.code, int((time.time() - started) * 1000), f"HTTP {exc.code}"
    except Exception as exc:  # noqa: BLE001
        return None, int((time.time() - started) * 1000), f"{type(exc).__name__}: {exc}"


async def test_provider(name: str) -> bool | None:
    provider = po.OPEN.providers[name]
    symbol = "XAUUSD"
    status, latency, extra = await asyncio.to_thread(http_probe, RAW_PROBES[name])
    http_txt = f"http={status if status is not None else '-'} ({latency}ms, {extra})"

    t0 = time.time()
    quote = await provider.quote(symbol)
    quote_ms = int((time.time() - t0) * 1000)
    quote_txt = (f"quote={quote['last']} ({quote_ms}ms)" if quote
                 else f"quote=None ({getattr(provider, 'last_error', None) or 'xato'})")

    bars_txt = "bars=-"
    bars_ok = True
    if getattr(provider, "has_bars", False):
        t0 = time.time()
        result = await provider.bars(symbol, "M1", 600)
        bars_ms = int((time.time() - t0) * 1000)
        if result and result.get("bars"):
            bars = result["bars"]
            bars_ok = len(bars) >= 100
            bars_txt = f"bars={len(bars)} last={bars[-1][4]} delay={result['delay_s']}s ({bars_ms}ms)"
        else:
            bars_txt = f"bars=None ({bars_ms}ms)"

    detail = f"{http_txt} | {quote_txt} | {bars_txt}"
    if name == "yahoo":
        ok = bool(quote) and bars_ok
        row(name, detail, ok)
        return ok
    if quote:
        row(name, detail, True)
        return True
    row(name, detail + "  [unavailable - halol holat]", False)
    return False


async def test_manager() -> bool:
    started = time.time()
    bars = await po.OPEN.bars("XAUUSD", "M1", 600)
    elapsed = int((time.time() - started) * 1000)
    if bars and bars.get("bars"):
        row("manager", f"bars={len(bars['bars'])} provider={bars['provider']} "
                       f"delay={bars['delay_s']}s last={bars['bars'][-1][4]} ({elapsed}ms)", True)
        return True
    row("manager", f"bars=None ({elapsed}ms)", False)
    return False


async def test_fallback_hook() -> bool:
    """app.py hook'i: MT5 yo'q deb hisoblab, open fallback bar olinishini tekshiradi."""
    import app as feed_app  # noqa: F811

    feed_app.manager.connected = False
    started = time.time()
    fallback = await feed_app.open_bars_or_none("XAUUSD", "M1", 600)
    elapsed = int((time.time() - started) * 1000)
    if fallback and fallback.get("bars"):
        row("app hook", f"open_bars_or_none -> {len(fallback['bars'])} bar, "
                        f"provider={fallback['provider']}, delay={fallback['delay_s']}s ({elapsed}ms)", True)
        return True
    row("app hook", f"open_bars_or_none -> None ({elapsed}ms)", False)
    return False


def check_server(host: str, port: int) -> None:
    base = f"http://{host}:{port}"
    try:
        with urllib.request.urlopen(base + "/api/providers", timeout=10) as response:
            body = json.loads(response.read().decode("utf-8"))
        print("\n/api/providers ->", json.dumps(body, ensure_ascii=False, indent=1))
        row("server", f"active={body.get('active')} note={body.get('note')!r}", True)
    except Exception as exc:  # noqa: BLE001
        row("server", f"/api/providers xato: {type(exc).__name__}: {exc} (server ishlamayapti?)", None)


async def main_async(args: argparse.Namespace) -> int:
    print(f"OPEN data test: timeout={po.HTTP_TIMEOUT}s retries={po.HTTP_RETRIES}\n")
    yahoo_ok = False
    for name in ("yahoo", "stooq", "goldapi"):
        ok = await test_provider(name)
        if name == "yahoo":
            yahoo_ok = bool(ok)
    await test_manager()
    await test_fallback_hook()
    if args.port:
        await asyncio.to_thread(check_server, args.host, args.port)

    print("\n" + "=" * 100)
    print(f"{'PROVAYDER':<10} {'NATIJA':<6} IZOH")
    print("-" * 100)
    failed = 0
    for provider, status, detail in ROWS:
        if status == "FAIL":
            failed += 1
        print(f"{provider:<10} {status:<6} {detail}")
    print("-" * 100)
    print(f"Jami: {len(ROWS) - failed}/{len(ROWS)} PASS, {failed} FAIL")
    print("=" * 100)
    return 0 if yahoo_ok else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="OPEN data provayderlari testi")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=0,
                        help="server porti (0 -> server tekshiruvi o'tkazilmaydi)")
    args = parser.parse_args()
    try:
        return asyncio.run(main_async(args))
    except KeyboardInterrupt:
        return 1


if __name__ == "__main__":
    sys.exit(main())

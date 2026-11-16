#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""XAUUSD/GBPUSD feed server uchun integratsion testlar.

Foydalanish:
    python test_feed.py                # asosiy bandlar
    python test_feed.py --soak 60      # + 5 parallel WS klient 60 sekund
    python test_feed.py --host 192.168.1.10 --port 8765

Har band uchun konsolga PASS/FAIL yoziladi, oxirida jadval chiqadi.
Exit code: 0 - hammasi PASS, 1 - kamida bitta FAIL.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import statistics
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

try:
    from websockets.asyncio.client import connect as ws_connect
except ImportError:  # pragma: no cover
    from websockets.client import connect as ws_connect

SERVER_DIR = Path(__file__).resolve().parent
ALERTS_FILE = SERVER_DIR / "alerts.json"

DEFAULT_HOST = os.getenv("FEED_HOST_TEST", "127.0.0.1")
DEFAULT_PORT = int(os.getenv("FEED_PORT_TEST", "8765"))

BASE = ""
WS_BASE = ""
RESULTS: list[tuple[str, str, str]] = []

TFS = ("D1", "H4", "H1", "M15", "M5", "M3", "M1")
SYMBOLS = (("XAUUSD", 3), ("GBPUSD", 5))


def record(name: str, ok: bool, detail: str) -> bool:
    RESULTS.append((name, "PASS" if ok else "FAIL", detail))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}", flush=True)
    return ok


def http(method: str, path: str, payload: dict | None = None, timeout: float = 20.0,
         extra_headers: dict | None = None):
    headers = {"Accept": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    body = None
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(BASE + path, data=body, method=method, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read().decode("utf-8")
        parsed = json.loads(raw) if raw else {}
        return response.status, parsed, dict(response.headers)


async def http_async(method: str, path: str, payload: dict | None = None, timeout: float = 20.0):
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: http(method, path, payload, timeout))


def http_raw(path: str, timeout: float = 20.0):
    request = urllib.request.Request(BASE + path, headers={"Accept": "text/html"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, response.read().decode("utf-8", "replace"), dict(response.headers)


def ws_url(symbol: str, tf: str) -> str:
    return f"{WS_BASE}?symbol={symbol}&tf={tf}"


# ---------------------------------------------------------------------------
# Bandlar
# ---------------------------------------------------------------------------
def band_health() -> None:
    try:
        status, body, headers = http("GET", "/api/health", extra_headers={"Origin": "http://localhost:5173"})
        problems = []
        if status != 200:
            problems.append(f"status={status}")
        if body.get("ok") is not True:
            problems.append("ok != true")
        if body.get("mt5") is not True:
            problems.append("mt5 != true")
        symbols = body.get("symbols") or []
        for symbol in ("XAUUSD", "GBPUSD"):
            if symbol not in symbols:
                problems.append(f"symbols ichida {symbol} yo'q")
        if not isinstance(body.get("time"), int):
            problems.append("time int emas")
        cors = headers.get("access-control-allow-origin")
        if cors != "*":
            problems.append(f"CORS allow-origin={cors!r}")
        detail = "; ".join(problems) if problems else f"mt5=true symbols={symbols} CORS=*"
        record("health", not problems, detail)
    except Exception as exc:
        record("health", False, f"xato: {exc}")


def band_static() -> None:
    try:
        status, text, headers = http_raw("/")
        problems = []
        if status != 200:
            problems.append(f"status={status}")
        content_type = (headers.get("content-type") or "").lower()
        if not (content_type.startswith("text/html") or content_type.startswith("text/plain")):
            problems.append(f"content-type={content_type!r}")
        if len(text) < 10:
            problems.append("javob juda qisqa")
        detail = "; ".join(problems) if problems else f"status=200 content-type={content_type.split(';')[0]}"
        record("static_root", not problems, detail)
    except Exception as exc:
        record("static_root", False, f"xato: {exc}")


def band_candles() -> None:
    problems: list[str] = []
    total_bars = 0
    try:
        for symbol, digits in SYMBOLS:
            for tf in TFS:
                status, body, _ = http("GET", f"/api/candles?symbol={symbol}&tf={tf}&count=500")
                if status != 200:
                    problems.append(f"{symbol}/{tf} status={status}")
                    continue
                bars = body.get("bars") or []
                if len(bars) <= 100:
                    problems.append(f"{symbol}/{tf} bars={len(bars)} (<=100)")
                if body.get("symbol") != symbol or body.get("tf") != tf:
                    problems.append(f"{symbol}/{tf} symbol/tf echo xato")
                ts_list = [bar[0] for bar in bars]
                if any(ts_list[i] >= ts_list[i + 1] for i in range(len(ts_list) - 1)):
                    problems.append(f"{symbol}/{tf} ts o'sish tartibida emas")
                for bar in bars:
                    if len(bar) != 6:
                        problems.append(f"{symbol}/{tf} bar uzunligi != 6")
                        break
                    open_, high, low, close, volume = bar[1], bar[2], bar[3], bar[4], bar[5]
                    if not (high >= max(open_, close) and low <= min(open_, close)):
                        problems.append(f"{symbol}/{tf} H/L nomuvofiq")
                        break
                    if not isinstance(volume, int) or volume < 0:
                        problems.append(f"{symbol}/{tf} volume int emas")
                        break
                    for price in (open_, high, low, close):
                        if abs(round(price, digits) - price) > 1e-6:
                            problems.append(f"{symbol}/{tf} digits={digits} buzilgan: {price}")
                            break
                total_bars += len(bars)
        status, body, _ = http("GET", "/api/candles?symbol=XAUUSD&tf=M1&count=5000")
        n5000 = len(body.get("bars") or [])
        if status != 200 or n5000 <= 100:
            problems.append(f"count=5000 -> {n5000}")
        # noto'g'ri tf uchun 400
        try:
            http("GET", "/api/candles?symbol=XAUUSD&tf=XXX&count=10")
            problems.append("noto'g'ri tf uchun 400 emas")
        except urllib.error.HTTPError as exc:
            if exc.code != 400:
                problems.append(f"noto'g'ri tf status={exc.code}")
        detail = "; ".join(problems[:6]) if problems else (
            f"7 TF x 2 symbol, jami {total_bars} bar, count=5000 -> {n5000}"
        )
        record("candles", not problems, detail)
    except Exception as exc:
        record("candles", False, f"xato: {exc}")


async def band_ws_ticks() -> None:
    problems: list[str] = []
    ticks: list[tuple[float, dict]] = []
    try:
        async with ws_connect(ws_url("XAUUSD", "M1"), open_timeout=10, close_timeout=5) as websocket:
            snapshot = json.loads(await asyncio.wait_for(websocket.recv(), 10))
            if snapshot.get("type") != "snapshot":
                problems.append(f"birinchi xabar type={snapshot.get('type')}")
            if snapshot.get("symbol") != "XAUUSD":
                problems.append("snapshot symbol")
            if snapshot.get("tf") != "M1":
                problems.append("snapshot tf")
            if snapshot.get("digits") != 3:
                problems.append(f"snapshot digits={snapshot.get('digits')}")
            snapshot_bars = snapshot.get("bars") or []
            if len(snapshot_bars) < 100:
                problems.append(f"snapshot bars={len(snapshot_bars)}")
            snapshot_ts = [bar[0] for bar in snapshot_bars]
            if any(snapshot_ts[i] >= snapshot_ts[i + 1] for i in range(len(snapshot_ts) - 1)):
                problems.append("snapshot ts tartibsiz")

            started = time.monotonic()
            while time.monotonic() - started < 3.0:
                try:
                    raw = await asyncio.wait_for(websocket.recv(), 1.5)
                except asyncio.TimeoutError:
                    problems.append("3 sekund ichida frame kelmadi")
                    break
                message = json.loads(raw)
                if message.get("type") == "tick":
                    ticks.append((time.monotonic(), message))
    except Exception as exc:
        record("ws_ticks", False, f"xato: {exc}")
        return

    if len(ticks) < 8:
        problems.append(f"tick soni {len(ticks)} < 8")
    intervals = [
        (ticks[i][0] - ticks[i - 1][0]) * 1000.0 for i in range(1, len(ticks))
    ]
    mean_interval = statistics.mean(intervals) if intervals else 0.0
    if intervals and not (250.0 <= mean_interval <= 350.0):
        problems.append(f"o'rtacha oraliq {mean_interval:.0f}ms (300+-50 emas)")
    if intervals:
        inside = sum(1 for value in intervals if 250.0 <= value <= 350.0)
        if inside / len(intervals) < 0.9:
            problems.append(f"oraliqlarning {inside}/{len(intervals)} tasi 250-350ms ichida")

    if ticks:
        message = ticks[-1][1]
        for field in ("symbol", "tf", "bid", "ask", "price", "time", "bar", "new_bar"):
            if field not in message:
                problems.append(f"tick ichida {field} yo'q")
        bar = message.get("bar") or []
        if len(bar) != 6:
            problems.append(f"bar uzunligi={len(bar)}")
        else:
            if not (bar[0] <= message["time"] < bar[0] + 60):
                problems.append("bar ts va tick time mos emas")
            if not (bar[2] >= max(bar[1], bar[4]) and bar[3] <= min(bar[1], bar[4])):
                problems.append("bar H/L nomuvofiq")
        bid, ask = message.get("bid"), message.get("ask")
        if not (isinstance(bid, (int, float)) and isinstance(ask, (int, float)) and 0 < bid <= ask):
            problems.append("bid/ask noto'g'ri")
        if abs(float(message.get("price", 0)) - float(bid)) > 1e-9:
            problems.append("price != bid")
        if not isinstance(message.get("new_bar"), bool):
            problems.append("new_bar bool emas")

    detail = "; ".join(problems[:6]) if problems else (
        f"{len(ticks)} tick / 3s, oraliq mean={mean_interval:.0f}ms, "
        f"min={min(intervals):.0f}ms, max={max(intervals):.0f}ms"
    )
    record("ws_ticks", not problems, detail)


def _cleanup_test_alerts() -> None:
    try:
        _, body, _ = http("GET", "/api/alerts")
        for alert in body.get("alerts") or []:
            if str(alert.get("note", "")).startswith("test_feed"):
                try:
                    http("DELETE", f"/api/alerts/{alert['id']}")
                except Exception:
                    pass
    except Exception:
        pass


async def band_ws_alerts() -> None:
    problems: list[str] = []
    created_id: str | None = None
    latency: float | None = None
    _cleanup_test_alerts()
    try:
        async with ws_connect(ws_url("XAUUSD", "M1"), open_timeout=10, close_timeout=5) as websocket:
            snapshot = json.loads(await asyncio.wait_for(websocket.recv(), 10))
            if snapshot.get("type") != "snapshot":
                problems.append("snapshot kelmadi")

            tick = None
            deadline = time.monotonic() + 5.0
            while time.monotonic() < deadline:
                raw = await asyncio.wait_for(websocket.recv(), 2.0)
                message = json.loads(raw)
                if message.get("type") == "tick":
                    tick = message
                    break
            if tick is None:
                record("alert_trigger", False, "joriy narx olinmadi (tick yo'q)")
                return
            current = float(tick["price"])
            target = round(current - 1.0, 3)
            posted_at = time.monotonic()
            status, body, _ = await http_async(
                "POST", "/api/alerts",
                {"symbol": "XAUUSD", "dir": "above", "price": target,
                 "note": "test_feed trigger"},
            )
            if status != 200 or not body.get("alert"):
                record("alert_trigger", False, f"POST status={status}")
                return
            created_id = body["alert"]["id"]
            if body["alert"].get("active") is not True or body["alert"].get("triggered") is not None:
                problems.append("yangi alert active=true/triggered=null emas")

            alert_frame = None
            while time.monotonic() - posted_at < 5.0:
                remaining = 5.0 - (time.monotonic() - posted_at)
                raw = await asyncio.wait_for(websocket.recv(), max(0.2, remaining))
                message = json.loads(raw)
                if message.get("type") == "alert":
                    alert_frame = message
                    break
            latency = time.monotonic() - posted_at
            if alert_frame is None:
                problems.append("WS'da type=alert kelmadi")
            else:
                alert = alert_frame.get("alert") or {}
                if alert.get("id") != created_id:
                    problems.append("alert id mos emas")
                for field in ("id", "symbol", "message", "price", "ts"):
                    if field not in alert_frame:
                        problems.append(f"WS xabarida top-level {field} yo'q")
                if alert_frame.get("id") != created_id:
                    problems.append("WS top-level id mos emas")
                if alert_frame.get("symbol") != "XAUUSD":
                    problems.append("WS top-level symbol xato")
                if not isinstance(alert_frame.get("message"), str) or not alert_frame.get("message"):
                    problems.append("WS message bo'sh")
                if alert_frame.get("ts") != alert.get("triggered_at"):
                    problems.append("WS ts != alert.triggered_at")
                for field in ("id", "symbol", "dir", "price", "note", "triggered", "price_at"):
                    if field not in alert:
                        problems.append(f"alert ichida {field} yo'q")
                if alert.get("dir") != "above":
                    problems.append("alert dir xato")
                if not isinstance(alert.get("triggered"), int):
                    problems.append("triggered int emas")
                if abs(float(alert.get("price_at") or 0)) <= 0:
                    problems.append("price_at noto'g'ri")
                if latency > 1.0:
                    problems.append(f"trigger kechikishi {latency * 1000:.0f}ms > 1000ms")
    except Exception as exc:
        record("alert_trigger", False, f"xato: {exc}")
        if created_id:
            try:
                await http_async("DELETE", f"/api/alerts/{created_id}")
            except Exception:
                pass
        return

    # GET: triggered/active holati va faylga saqlanishi
    try:
        _, body, _ = await http_async("GET", "/api/alerts")
        found = [alert for alert in body.get("alerts") or [] if alert.get("id") == created_id]
        if not found:
            problems.append("GET /api/alerts da alert topilmadi")
        else:
            alert = found[0]
            if alert.get("active") is not False:
                problems.append("triggerdan keyin active=false emas")
            if not isinstance(alert.get("triggered"), int):
                problems.append("faylda triggered int emas")
        if ALERTS_FILE.exists():
            raw_file = json.loads(ALERTS_FILE.read_text(encoding="utf-8"))
            stored = raw_file.get("alerts") if isinstance(raw_file, dict) else raw_file
            if not any(item.get("id") == created_id for item in stored or []):
                problems.append("alerts.json ichida alert yo'q")
        else:
            problems.append("alerts.json yaratilmadi")
    except Exception as exc:
        problems.append(f"GET/fayl tekshiruvi xatosi: {exc}")

    # DELETE
    try:
        status, body, _ = await http_async("DELETE", f"/api/alerts/{created_id}")
        if status != 200 or body.get("deleted") is not True:
            problems.append(f"DELETE javobi xato: {body}")
        _, body, _ = await http_async("GET", "/api/alerts")
        if any(alert.get("id") == created_id for alert in body.get("alerts") or []):
            problems.append("o'chirilgandan keyin ham ro'yxatda")
    except Exception as exc:
        problems.append(f"DELETE xatosi: {exc}")

    latency_text = f"{latency * 1000:.0f}ms" if latency is not None else "n/a"
    detail = "; ".join(problems[:6]) if problems else (
        f"POST->WS type=alert {latency_text}, GET active=false, fayl OK, DELETE OK"
    )
    record("alert_trigger", not problems, detail)


def band_persistence() -> None:
    problems: list[str] = []
    alert_id = None
    try:
        status, body, _ = http(
            "POST", "/api/alerts",
            {"symbol": "GBPUSD", "dir": "below", "price": 0.5,
             "note": "test_feed persistence"},
        )
        if status != 200:
            record("persistence", False, f"POST status={status}")
            return
        alert_id = body["alert"]["id"]
        if not ALERTS_FILE.exists():
            problems.append("alerts.json yo'q")
        else:
            raw_file = json.loads(ALERTS_FILE.read_text(encoding="utf-8"))
            stored = raw_file.get("alerts") if isinstance(raw_file, dict) else raw_file
            item = next((entry for entry in stored or [] if entry.get("id") == alert_id), None)
            if item is None:
                problems.append("alert faylda yo'q")
            else:
                for field in ("id", "symbol", "dir", "price", "note", "created", "triggered", "active"):
                    if field not in item:
                        problems.append(f"faylda {field} yo'q")
                if item.get("symbol") != "GBPUSD" or item.get("dir") != "below":
                    problems.append("faylda symbol/dir xato")
        # fayl orqali qayta yuklash (server restart bilan bir xil o'qish)
        _, body, _ = http("GET", "/api/alerts")
        if not any(alert.get("id") == alert_id for alert in body.get("alerts") or []):
            problems.append("GET ro'yxatida yo'q")
        status, body, _ = http("DELETE", f"/api/alerts/{alert_id}")
        if status != 200 or body.get("deleted") is not True:
            problems.append("DELETE xato")
        alert_id = None
        detail = "; ".join(problems) if problems else "POST -> alerts.json -> GET -> DELETE OK"
        record("persistence", not problems, detail)
    except Exception as exc:
        record("persistence", False, f"xato: {exc}")
    finally:
        if alert_id:
            try:
                http("DELETE", f"/api/alerts/{alert_id}")
            except Exception:
                pass


async def band_soak(seconds: float) -> None:
    specs = [
        (1, "XAUUSD", "M1"),
        (2, "XAUUSD", "M5"),
        (3, "GBPUSD", "M1"),
        (4, "GBPUSD", "M15"),
        (5, "XAUUSD", "M1"),
    ]
    counts: dict[int, int] = {}
    errors: list[str] = []

    async def client(index: int, symbol: str, tf: str) -> None:
        count = 0
        try:
            async with ws_connect(ws_url(symbol, tf), open_timeout=10, close_timeout=5) as websocket:
                snapshot = json.loads(await asyncio.wait_for(websocket.recv(), 10))
                if snapshot.get("type") != "snapshot":
                    raise RuntimeError("snapshot kelmadi")
                last_bar_ts = None
                deadline = time.monotonic() + seconds
                while time.monotonic() < deadline:
                    raw = await asyncio.wait_for(websocket.recv(), 5.0)
                    message = json.loads(raw)
                    if message.get("type") != "tick":
                        continue
                    count += 1
                    bar = message.get("bar") or []
                    if bar:
                        if last_bar_ts is not None and bar[0] < last_bar_ts:
                            raise RuntimeError("bar ts orqaga ketdi")
                        last_bar_ts = bar[0]
                    if count == 1:
                        await asyncio.sleep(0)  # klientlar bir vaqtda ishlashi uchun
                counts[index] = count
        except Exception as exc:
            errors.append(f"klient{index} ({symbol}/{tf}): {exc}")

    await asyncio.gather(*[client(index, symbol, tf) for index, symbol, tf in specs])
    expected = seconds / 0.30
    problems = list(errors)
    for index, symbol, tf in specs:
        got = counts.get(index)
        if got is None:
            problems.append(f"klient{index} ({symbol}/{tf}) tick olmadi")
        elif got < expected * 0.75:
            problems.append(f"klient{index} ({symbol}/{tf}) tick={got} (kutilgan ~{expected:.0f})")
    summary = ", ".join(
        f"k{index}:{counts.get(index, 0)}" for index, _, _ in specs
    )
    detail = "; ".join(problems[:6]) if problems else (
        f"5 klient x {seconds:.0f}s xatosiz, ticklar {summary}"
    )
    record(f"soak_{int(seconds)}s", not problems, detail)


# ---------------------------------------------------------------------------
# Yangi alert turlari (zone / sweep / session) testlari
# ---------------------------------------------------------------------------
def _load_app_module():
    """Server modulini unit-testlar uchun import qiladi (log faylini yopadi)."""
    import app as feed_app  # lokal import ataylab

    feed_app.logger.setLevel(logging.CRITICAL)
    for handler in list(feed_app.logger.handlers):
        if isinstance(handler, logging.FileHandler):
            feed_app.logger.removeHandler(handler)
            handler.close()
    return feed_app


def _last_trading_day(today: date) -> date:
    day = today - timedelta(days=1)
    while day.weekday() >= 5:  # shanba/yakshanba
        day -= timedelta(days=1)
    return day


def _fetch_alert(alert_id: str, timeout: float = 10.0):
    alert = None
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        time.sleep(0.2)
        _, listing, _ = http("GET", "/api/alerts")
        alert = next((item for item in listing.get("alerts") or []
                      if item.get("id") == alert_id), None)
        if alert and (alert.get("range") or {}).get("high") is not None:
            return alert
    return alert


def band_asia_range_live() -> None:
    """Sweep alert uchun Asia HIGH/LOW haqiqiy MT5 ma'lumotidan hisoblanishi (after_date + bugun)."""
    problems: list[str] = []
    alert_id = None
    alert = None
    day = None
    try:
        day = _last_trading_day(datetime.now(timezone(timedelta(hours=5))).date())
        status, body, _ = http("POST", "/api/alerts", {
            "symbol": "XAUUSD", "type": "sweep",
            "after_date": day.isoformat(), "note": "test_feed sweep range",
        })
        if status != 200 or not body.get("alert"):
            record("sweep_asia_range", False, f"POST status={status}")
            return
        alert_id = body["alert"]["id"]
        post_alert = body["alert"]
        post_range = post_alert.get("range") or {}
        if post_range.get("high") is None or post_range.get("low") is None:
            problems.append("POST javobida range darhol bo'sh (null)")
        if "sides" not in post_alert:
            problems.append("POST javobida sides yo'q")
        alert = _fetch_alert(alert_id)
        if not alert:
            problems.append("alert GET'da topilmadi")
        else:
            rng = alert.get("range") or {}
            high, low = rng.get("high"), rng.get("low")
            if high is None or low is None:
                problems.append("Asia HIGH/LOW hisoblanmadi (range=null)")
            elif not (float(high) > float(low)):
                problems.append(f"high<=low ({high}/{low})")
            if alert.get("type") != "sweep":
                problems.append(f"type={alert.get('type')}")
            if alert.get("status") != "armed":
                problems.append(f"status={alert.get('status')} (armed emas)")
            if alert.get("after_date") != day.isoformat():
                problems.append("after_date echo xato")
            sides = alert.get("sides") or {}
            if sides.get("bsl") is not False or sides.get("ssl") is not False:
                problems.append(f"sides={sides}")
            if not isinstance(alert.get("created"), int):
                problems.append("created int emas")
            if alert.get("triggered_at") is not None:
                problems.append("triggered_at null emas")
        rng = (alert or {}).get("range") or {}
        detail = (f"after_date {day.isoformat()}: high={rng.get('high')} "
                  f"low={rng.get('low')} (MT5 M15, POST javobida darhol)")

        # 2) after_date'siz (bugungi kun) sweep ham hisoblanishi kerak
        if alert_id:
            http("DELETE", f"/api/alerts/{alert_id}")
            alert_id = None
        today = datetime.now(timezone(timedelta(hours=5))).date().isoformat()
        status, body, _ = http("POST", "/api/alerts", {
            "symbol": "XAUUSD", "type": "sweep", "note": "test_feed sweep today"})
        if status != 200 or not body.get("alert"):
            problems.append(f"bugungi sweep POST status={status}")
        else:
            alert_id = body["alert"]["id"]
            today_post_range = body["alert"].get("range") or {}
            if today_post_range.get("high") is None:
                problems.append("bugungi POST javobida range darhol bo'sh")
            current = _fetch_alert(alert_id)
            rng2 = (current or {}).get("range") or {}
            if rng2.get("day") != today:
                problems.append(f"bugungi range.day={rng2.get('day')} != {today}")
            if rng2.get("high") is None or rng2.get("low") is None:
                problems.append("bugungi Asia range hisoblanmadi")
            elif not (float(rng2["high"]) > float(rng2["low"])):
                problems.append(f"bugungi high<=low ({rng2.get('high')}/{rng2.get('low')})")
            detail += f"; bugun {today}: high={rng2.get('high')} low={rng2.get('low')}"
        if problems:
            detail = "; ".join(problems[:6])
        record("sweep_asia_range", not problems, detail)
    except Exception as exc:
        record("sweep_asia_range", False, f"xato: {exc}")
    finally:
        if alert_id:
            try:
                http("DELETE", f"/api/alerts/{alert_id}")
            except Exception:
                pass


async def band_alert_zone() -> None:
    """Zone alert E2E: POST -> darhol trigger -> WS xabar -> GET -> DELETE."""
    problems: list[str] = []
    alert_id = None
    frame = None
    latency = 0.0
    try:
        async with ws_connect(ws_url("XAUUSD", "M1"), open_timeout=10, close_timeout=5) as websocket:
            snapshot = json.loads(await asyncio.wait_for(websocket.recv(), 10))
            if snapshot.get("type") != "snapshot":
                problems.append("snapshot kelmadi")
            tick = None
            deadline = time.monotonic() + 5.0
            while time.monotonic() < deadline:
                message = json.loads(await asyncio.wait_for(websocket.recv(), 2.0))
                if message.get("type") == "tick":
                    tick = message
                    break
            if tick is None:
                record("zone_trigger", False, "joriy narx olinmadi (tick yo'q)")
                return
            price = float(tick["price"])
            lo = round(price - 0.6, 3)
            hi = round(price + 0.6, 3)
            posted_at = time.monotonic()
            status, body, _ = await http_async("POST", "/api/alerts", {
                "symbol": "XAUUSD", "type": "zone", "tf": "M15",
                "lo": lo, "hi": hi, "label": "test zona",
                "repeat": False, "note": "test_feed zone",
            })
            if status != 200 or not body.get("alert"):
                record("zone_trigger", False, f"POST status={status}")
                return
            alert_id = body["alert"]["id"]
            created = body["alert"]
            if created.get("type") != "zone" or created.get("status") != "armed":
                problems.append(f"POST javobi type={created.get('type')} status={created.get('status')}")
            while time.monotonic() - posted_at < 3.0:
                remaining = 3.0 - (time.monotonic() - posted_at)
                message = json.loads(await asyncio.wait_for(websocket.recv(), max(0.2, remaining)))
                if message.get("type") == "alert" and message.get("id") == alert_id:
                    frame = message
                    break
            latency = time.monotonic() - posted_at
            if frame is None:
                problems.append("WS'da zone alert kelmadi")
            else:
                for field in ("id", "symbol", "message", "price", "ts"):
                    if field not in frame:
                        problems.append(f"top-level {field} yo'q")
                if frame.get("symbol") != "XAUUSD":
                    problems.append("symbol xato")
                message_text = str(frame.get("message") or "")
                if not message_text or "zonasiga kirdi" not in message_text:
                    problems.append(f"message matni kutilgan emas: {message_text!r}")
                nested = frame.get("alert") or {}
                if nested.get("type") != "zone":
                    problems.append(f"nested type={nested.get('type')}")
                if nested.get("status") != "triggered":
                    problems.append(f"nested status={nested.get('status')}")
                if not isinstance(frame.get("ts"), int):
                    problems.append("ts int emas")
                if not isinstance(frame.get("price"), (int, float)):
                    problems.append("price son emas")
                if latency > 2.0:
                    problems.append(f"latency {latency * 1000:.0f}ms > 2000ms")
        _, listing, _ = await http_async("GET", "/api/alerts")
        found = next((item for item in listing.get("alerts") or []
                      if item.get("id") == alert_id), None)
        if not found:
            problems.append("GET'da alert yo'q")
        else:
            if found.get("status") != "triggered":
                problems.append(f"GET status={found.get('status')}")
            if not isinstance(found.get("triggered_at"), int):
                problems.append("GET triggered_at int emas")
            if not isinstance(found.get("distance"), (int, float)):
                problems.append(f"GET distance={found.get('distance')}")
    except Exception as exc:
        record("zone_trigger", False, f"xato: {exc}")
    finally:
        if alert_id:
            try:
                await http_async("DELETE", f"/api/alerts/{alert_id}")
            except Exception:
                pass
    if problems:
        detail = "; ".join(problems[:6])
    elif frame is not None:
        detail = f"POST -> WS alert {latency * 1000:.0f}ms, message={frame.get('message')!r}"
    else:
        detail = "OK"
    record("zone_trigger", not problems, detail)



async def band_zone_on_cross() -> None:
    """on_cross=true zone: narx ichkarida bo'lsa ham POST'da trigger bo'lmaydi."""
    problems: list[str] = []
    alert_id = None
    try:
        async with ws_connect(ws_url("XAUUSD", "M1"), open_timeout=10, close_timeout=5) as websocket:
            snapshot = json.loads(await asyncio.wait_for(websocket.recv(), 10))
            if snapshot.get("type") != "snapshot":
                problems.append("snapshot kelmadi")
            tick = None
            deadline = time.monotonic() + 5.0
            while time.monotonic() < deadline:
                message = json.loads(await asyncio.wait_for(websocket.recv(), 2.0))
                if message.get("type") == "tick":
                    tick = message
                    break
            if tick is None:
                record("zone_on_cross", False, "joriy narx olinmadi")
                return
            price = float(tick["price"])
            lo = round(price - 0.6, 3)
            hi = round(price + 0.6, 3)
            status, body, _ = await http_async("POST", "/api/alerts", {
                "symbol": "XAUUSD", "type": "zone", "tf": "M15",
                "lo": lo, "hi": hi, "label": "cross zona",
                "repeat": False, "on_cross": True, "note": "test_feed on_cross",
            })
            if status != 200 or not body.get("alert"):
                record("zone_on_cross", False, f"POST status={status}")
                return
            alert_id = body["alert"]["id"]
            created = body["alert"]
            if created.get("on_cross") is not True:
                problems.append("POST javobida on_cross=true emas")
            if created.get("status") != "armed":
                problems.append(f"POST status={created.get('status')} (armed bo'lishi kerak)")
            fired = False
            watch_until = time.monotonic() + 1.5
            while time.monotonic() < watch_until:
                try:
                    remaining = max(0.05, watch_until - time.monotonic())
                    message = json.loads(await asyncio.wait_for(websocket.recv(), remaining))
                except asyncio.TimeoutError:
                    break
                if message.get("type") == "alert" and message.get("id") == alert_id:
                    fired = True
                    break
            if fired:
                problems.append("on_cross=true bo'lsa ham darhol trigger bo'ldi")
        _, listing, _ = await http_async("GET", "/api/alerts")
        found = next((item for item in listing.get("alerts") or []
                      if item.get("id") == alert_id), None)
        if not found:
            problems.append("GET'da alert yo'q")
        else:
            if found.get("status") != "armed":
                problems.append(f"GET status={found.get('status')} (armed bo'lishi kerak)")
            if found.get("on_cross") is not True:
                problems.append("GET on_cross=true emas")
    except Exception as exc:
        record("zone_on_cross", False, f"xato: {exc}")
    finally:
        if alert_id:
            try:
                await http_async("DELETE", f"/api/alerts/{alert_id}")
            except Exception:
                pass
    detail = "; ".join(problems[:6]) if problems else (
        "on_cross=true: ichkarida trigger bo'lmadi, status armed")
    record("zone_on_cross", not problems, detail)


def band_alerts_schema() -> None:
    """GET /api/alerts maydonlari (type, status, created, triggered_at, distance) + DELETE all."""
    problems: list[str] = []
    created: list[str] = []
    try:
        _, body, _ = http("POST", "/api/alerts", {
            "symbol": "XAUUSD", "dir": "above", "price": 99999.0,
            "note": "test_feed schema price"})
        created.append(body["alert"]["id"])
        _, body, _ = http("POST", "/api/alerts", {
            "symbol": "GBPUSD", "type": "zone", "tf": "M5",
            "lo": 0.1, "hi": 0.2, "label": "past zona", "repeat": True,
            "on_cross": True, "note": "test_feed schema zone"})
        created.append(body["alert"]["id"])
        _, body, _ = http("POST", "/api/alerts", {
            "symbol": "XAUUSD", "type": "session", "which": "london",
            "note": "test_feed schema session"})
        created.append(body["alert"]["id"])

        _, listing, _ = http("GET", "/api/alerts")
        by_id = {item.get("id"): item for item in listing.get("alerts") or []}
        required = ("type", "status", "created", "triggered_at", "distance")
        for alert_id in created:
            item = by_id.get(alert_id)
            if item is None:
                problems.append(f"{alert_id} GET'da yo'q")
                continue
            for field in required:
                if field not in item:
                    problems.append(f"{alert_id}: {field} yo'q")
            if not isinstance(item.get("created"), int):
                problems.append(f"{alert_id}: created int emas")
            if item.get("triggered_at") is not None:
                problems.append(f"{alert_id}: triggered_at null emas")
            if not isinstance(item.get("status"), str):
                problems.append(f"{alert_id}: status str emas")

        price_item = by_id.get(created[0]) or {}
        if price_item.get("type") != "price":
            problems.append("price type xato")
        if not isinstance(price_item.get("distance"), (int, float)):
            problems.append("price distance son emas")
        zone_item = by_id.get(created[1]) or {}
        if (zone_item.get("type") != "zone" or zone_item.get("tf") != "M5"
                or zone_item.get("repeat") is not True
                or zone_item.get("on_cross") is not True):
            problems.append("zone maydonlari xato")
        if not isinstance(zone_item.get("distance"), (int, float)):
            problems.append("zone distance son emas")
        session_item = by_id.get(created[2]) or {}
        if session_item.get("type") != "session" or session_item.get("which") != "london":
            problems.append("session maydonlari xato")
        if not isinstance(session_item.get("target_ts"), int):
            problems.append("session target_ts int emas")
        if session_item.get("distance") is not None:
            problems.append("session distance null emas")

        others = [item for item in listing.get("alerts") or []
                  if not str(item.get("note", "")).startswith("test_feed")]
        if others:
            detail_note = f"boshqa {len(others)} ta alert bor - DELETE all tegmadik"
        else:
            status, body, _ = http("DELETE", "/api/alerts")
            if status != 200 or body.get("deleted") is not True:
                problems.append(f"DELETE all javobi xato: {body}")
            _, after, _ = http("GET", "/api/alerts")
            if after.get("alerts"):
                problems.append("DELETE all dan keyin alertlar qoldi")
            created = []
            detail_note = "DELETE /api/alerts ishladi"
        detail = "; ".join(problems[:6]) if problems else (
            f"price/zone/session maydonlari OK; {detail_note}")
        record("alert_schema", not problems, detail)
    except Exception as exc:
        record("alert_schema", False, f"xato: {exc}")
    finally:
        for alert_id in created:
            try:
                http("DELETE", f"/api/alerts/{alert_id}")
            except Exception:
                pass


async def band_sweep_unit() -> None:
    """Sweep hisoblash funksiyalari + eval_sweep (fake data) unit testlari."""
    problems: list[str] = []
    feed_app = None
    saved: dict = {}
    try:
        feed_app = _load_app_module()
        saved = {
            "save_alerts": feed_app.save_alerts,
            "broadcast_alert": feed_app.broadcast_alert,
            "get_asia_range": feed_app.get_asia_range,
            "bars_for": feed_app.bars_for,
        }

        async def _noop(*args, **kwargs):
            return None

        feed_app.save_alerts = _noop
        feed_app.broadcast_alert = lambda alert: None

        start = 1_700_000_000
        end = start + 6 * 3600
        bars = [
            [start, 1.0, 2.0, 0.5, 1.5, 10],
            [start + 900, 1.5, 3.0, 1.0, 2.0, 12],
            [start + 1800, 2.0, 5.0, 1.5, 4.0, 15],
            [end, 9.0, 9.0, 9.0, 9.0, 9],
        ]
        rng = feed_app.asia_range_from_bars(bars, start, end, 3)
        if not rng or rng.get("high") != 5.0 or rng.get("low") != 0.5 or rng.get("bars") != 3:
            problems.append(f"asia_range_from_bars: {rng}")
        if feed_app.asia_range_from_bars(bars[:2], start, end, 3) is not None:
            problems.append("asia_range_from_bars 2 bar bilan None emas")

        sweep_bars = [
            [start + 3600, 4.0, 5.5, 3.8, 4.5, 5],
            [start + 3660, 0.8, 1.0, 0.3, 0.9, 5],
            [start + 3720, 4.0, 4.2, 3.9, 4.1, 5],
        ]
        events = feed_app.detect_sweeps(sweep_bars, 5.0, 0.5, 3)
        sides = [event["side"] for event in events]
        if sides != ["bsl", "ssl"]:
            problems.append(f"detect_sweeps sides={sides}")
        else:
            if events[0]["wick"] != 5.5 or events[1]["wick"] != 0.3:
                problems.append(f"detect_sweeps wick={events}")
        if feed_app.detect_sweeps(sweep_bars, 5.0, 0.5, 3, after_ts=start + 3700):
            problems.append("detect_sweeps after_ts filtri ishlamadi")

        base = int(time.time()) // 60 * 60
        day_str = "2026-11-13"
        holder = {"bars": []}

        async def fake_range(symbol, day):
            return {"high": 100.0, "low": 90.0, "bars": 24, "source": "M15"}

        async def fake_bars(broker, tf, count, digits):
            return list(holder["bars"])

        feed_app.get_asia_range = fake_range
        feed_app.bars_for = fake_bars
        alert = {
            "id": "unitsweep", "type": "sweep", "symbol": "XAUUSD",
            "status": "armed", "active": True, "created": 0,
            "triggered_at": None, "triggered": None, "price_at": None,
            "message": None, "trigger_count": 0, "note": "",
            "after_date": day_str,
            "state": {"day": day_str,
                      "sides": {"bsl": {"done": False}, "ssl": {"done": False}},
                      "last_bar_ts": base - 120, "range": None},
        }
        holder["bars"] = [[base - 60, 92.0, 101.0, 91.0, 99.0, 10],
                          [base - 120, 91.0, 95.0, 90.0, 94.0, 10]]
        await feed_app.eval_sweep(alert, base + 30)
        if alert["status"] != "triggered" or alert["trigger_count"] != 1:
            problems.append(f"BSL trigger bo'lmadi: {alert['status']}/{alert['trigger_count']}")
        elif "Asia HIGH sweep" not in str(alert.get("message")) or "dan qaytdi" not in str(alert.get("message")):
            problems.append(f"BSL message: {alert.get('message')!r}")
        elif alert.get("price_at") != 99.0:
            problems.append(f"BSL price_at={alert.get('price_at')}")
        if not alert["state"]["sides"]["bsl"]["done"]:
            problems.append("BSL side done emas")

        holder["bars"] = [[base, 91.0, 92.0, 89.0, 91.0, 10]]
        await feed_app.eval_sweep(alert, base + 90)
        if alert["trigger_count"] != 2:
            problems.append(f"SSL trigger bo'lmadi: count={alert['trigger_count']}")
        elif "Asia LOW sweep" not in str(alert.get("message")):
            problems.append(f"SSL message: {alert.get('message')!r}")
        if not alert["state"]["sides"]["ssl"]["done"]:
            problems.append("SSL side done emas")

        holder["bars"] = [[base + 60, 91.0, 105.0, 91.0, 99.0, 10]]
        await feed_app.eval_sweep(alert, base + 150)
        if alert["trigger_count"] != 2:
            problems.append(f"dedupe ishlamadi: count={alert['trigger_count']}")

        alert["state"]["day"] = "2026-11-12"
        await feed_app.eval_sweep(alert, base + 180)
        if alert["status"] != "armed" or alert["state"]["sides"]["bsl"]["done"] is not False:
            problems.append("yangi kun reset ishlamadi")

        detail = "; ".join(problems[:6]) if problems else (
            "asia_range/detect_sweeps/eval_sweep: BSL+SSL, dedupe, kun reset OK")
        record("sweep_unit", not problems, detail)
    except Exception as exc:
        record("sweep_unit", False, f"xato: {exc}")
    finally:
        if feed_app:
            for name, original in saved.items():
                setattr(feed_app, name, original)


async def band_zone_repeat_unit() -> None:
    """Zone repeat=true: kirish -> trigger, chiqish -> re-arm, qayta kirish -> yana trigger."""
    problems: list[str] = []
    feed_app = None
    saved: dict = {}
    try:
        feed_app = _load_app_module()
        saved = {"save_alerts": feed_app.save_alerts,
                 "broadcast_alert": feed_app.broadcast_alert}

        async def _noop(*args, **kwargs):
            return None

        feed_app.save_alerts = _noop
        feed_app.broadcast_alert = lambda alert: None
        alert = {
            "id": "unitzone", "type": "zone", "symbol": "XAUUSD",
            "status": "armed", "active": True, "created": 0,
            "triggered_at": None, "triggered": None, "price_at": None,
            "message": None, "trigger_count": 0, "note": "",
            "tf": "M15", "lo": 100.0, "hi": 101.0, "label": "",
            "repeat": True, "state": {},
        }

        def set_price(price: float) -> None:
            feed_app.TICKS.update("XAUUSD", bid=price, ask=price + 0.1,
                                  price=price, last=0.0, tick_time=int(time.time()))

        set_price(100.5)
        await feed_app.eval_zone(alert, time.time())
        if alert["status"] != "triggered" or alert["trigger_count"] != 1:
            problems.append(f"1-kirish trigger emas: {alert['status']}/{alert['trigger_count']}")
        set_price(105.0)
        await feed_app.eval_zone(alert, time.time())
        if alert["status"] != "armed":
            problems.append(f"chiqishdan keyin re-arm emas: {alert['status']}")
        set_price(100.5)
        await feed_app.eval_zone(alert, time.time())
        if alert["status"] != "triggered" or alert["trigger_count"] != 2:
            problems.append(f"2-kirish trigger emas: {alert['trigger_count']}")
        set_price(100.8)
        await feed_app.eval_zone(alert, time.time())
        if alert["trigger_count"] != 2:
            problems.append(f"zona ichida dedupe ishlamadi: {alert['trigger_count']}")
        detail = "; ".join(problems[:6]) if problems else (
            "zone: kirish->trigger, chiqish->re-arm, qayta kirish->2-trigger, dedupe OK")
        record("zone_repeat_unit", not problems, detail)
    except Exception as exc:
        record("zone_repeat_unit", False, f"xato: {exc}")
    finally:
        if feed_app:
            for name, original in saved.items():
                setattr(feed_app, name, original)


async def band_session_unit() -> None:
    """Session alert: killzone vaqtini hisoblash va trigger (fake target_ts)."""
    problems: list[str] = []
    feed_app = None
    saved: dict = {}
    tz5 = timezone(timedelta(hours=5))
    try:
        feed_app = _load_app_module()
        saved = {"save_alerts": feed_app.save_alerts,
                 "broadcast_alert": feed_app.broadcast_alert}

        async def _noop(*args, **kwargs):
            return None

        feed_app.save_alerts = _noop
        feed_app.broadcast_alert = lambda alert: None

        morning = datetime(2026, 11, 16, 10, 0, tzinfo=tz5)
        expected = int(datetime(2026, 11, 16, 11, 30, tzinfo=tz5).timestamp())
        if feed_app.session_target_ts("london", now=morning.timestamp()) != expected:
            problems.append("london 11:30 UTC+5 hisoblanmadi")
        afternoon = datetime(2026, 11, 16, 12, 0, tzinfo=tz5)
        expected_next = int(datetime(2026, 11, 17, 11, 30, tzinfo=tz5).timestamp())
        if feed_app.session_target_ts("london", now=afternoon.timestamp()) != expected_next:
            problems.append("london ertasiga o'tmadi")
        ny_expected = int(datetime(2026, 11, 16, 16, 30, tzinfo=tz5).timestamp())
        if feed_app.session_target_ts("ny", now=morning.timestamp()) != ny_expected:
            problems.append("ny 16:30 UTC+5 hisoblanmadi")

        alert = {
            "id": "unitsession", "type": "session", "symbol": "XAUUSD",
            "status": "armed", "active": True, "created": 0,
            "triggered_at": None, "triggered": None, "price_at": None,
            "message": None, "trigger_count": 0, "note": "",
            "which": "london", "state": {"target_ts": int(time.time()) - 5},
        }
        await feed_app.eval_session(alert, time.time())
        if alert["status"] != "triggered" or alert["trigger_count"] != 1:
            problems.append(f"session trigger bo'lmadi: {alert['status']}/{alert['trigger_count']}")
        elif "London killzone ochildi (11:30 UTC+5)" not in str(alert.get("message")):
            problems.append(f"session message: {alert.get('message')!r}")
        detail = "; ".join(problems[:6]) if problems else (
            "killzone vaqtlari (London 11:30, NY 16:30 UTC+5) + eval_session trigger OK")
        record("session_unit", not problems, detail)
    except Exception as exc:
        record("session_unit", False, f"xato: {exc}")
    finally:
        if feed_app:
            for name, original in saved.items():
                setattr(feed_app, name, original)



async def band_zone_on_cross_unit() -> None:
    """on_cross zone: ichkarida trigger yo'q, chiqib qayta kirganda trigger."""
    problems: list[str] = []
    feed_app = None
    saved: dict = {}
    try:
        feed_app = _load_app_module()
        saved = {"save_alerts": feed_app.save_alerts,
                 "broadcast_alert": feed_app.broadcast_alert}

        async def _noop(*args, **kwargs):
            return None

        feed_app.save_alerts = _noop
        feed_app.broadcast_alert = lambda alert: None
        alert = {
            "id": "unitzonecross", "type": "zone", "symbol": "XAUUSD",
            "status": "armed", "active": True, "created": 0,
            "triggered_at": None, "triggered": None, "price_at": None,
            "message": None, "trigger_count": 0, "note": "",
            "tf": "M15", "lo": 100.0, "hi": 101.0, "label": "",
            "repeat": False, "on_cross": True, "state": {"inside": True},
        }

        def set_price(price: float) -> None:
            feed_app.TICKS.update("XAUUSD", bid=price, ask=price + 0.1,
                                  price=price, last=0.0, tick_time=int(time.time()))

        set_price(100.5)
        await feed_app.eval_zone(alert, time.time())
        if alert["status"] != "armed" or alert["trigger_count"] != 0:
            problems.append(f"ichkarida trigger bo'ldi: {alert['status']}/{alert['trigger_count']}")
        set_price(105.0)
        await feed_app.eval_zone(alert, time.time())
        if alert["status"] != "armed":
            problems.append(f"tashqarida status={alert['status']}")
        set_price(100.5)
        await feed_app.eval_zone(alert, time.time())
        if alert["status"] != "triggered" or alert["trigger_count"] != 1:
            problems.append(f"qayta kirishda trigger bo'lmadi: {alert['status']}/{alert['trigger_count']}")
        detail = "; ".join(problems[:6]) if problems else (
            "on_cross: ichkarida trigger yo'q, chiqib qayta kirganda trigger")
        record("zone_on_cross_unit", not problems, detail)
    except Exception as exc:
        record("zone_on_cross_unit", False, f"xato: {exc}")
    finally:
        if feed_app:
            for name, original in saved.items():
                setattr(feed_app, name, original)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def summarize() -> int:
    print("\n" + "=" * 78)
    print(f"{'#':>2}  {'BAND':<16} {'NATIJA':<7} IZOH")
    print("-" * 78)
    failed = 0
    for index, (name, status, detail) in enumerate(RESULTS, start=1):
        if status != "PASS":
            failed += 1
        print(f"{index:>2}  {name:<16} {status:<7} {detail}")
    print("-" * 78)
    print(f"Jami: {len(RESULTS) - failed}/{len(RESULTS)} PASS, {failed} FAIL")
    print("=" * 78)
    return 0 if failed == 0 else 1


async def main_async(args: argparse.Namespace) -> int:
    global BASE, WS_BASE
    BASE = f"http://{args.host}:{args.port}"
    WS_BASE = f"ws://{args.host}:{args.port}/ws"
    print(f"Test qilinayotgan server: {BASE}\n")

    band_health()
    band_static()
    band_candles()
    await band_ws_ticks()
    await band_ws_alerts()
    band_asia_range_live()
    await band_alert_zone()
    await band_zone_on_cross()
    band_alerts_schema()
    await band_sweep_unit()
    await band_zone_repeat_unit()
    await band_zone_on_cross_unit()
    await band_session_unit()
    band_persistence()
    if args.soak > 0:
        await band_soak(float(args.soak))
    return summarize()


def main() -> int:
    parser = argparse.ArgumentParser(description="Feed server integratsion testlari")
    parser.add_argument("--host", default=DEFAULT_HOST, help="server host (default 127.0.0.1)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="server port (default 8765)")
    parser.add_argument("--soak", type=float, default=0.0,
                        help="5 parallel WS klient bilan soak test davomiyligi (sekund)")
    args = parser.parse_args()
    try:
        return asyncio.run(main_async(args))
    except KeyboardInterrupt:
        print("\nTo'xtatildi")
        return 1


if __name__ == "__main__":
    sys.exit(main())
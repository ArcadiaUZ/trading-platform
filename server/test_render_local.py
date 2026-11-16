#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render (Linux) muhitini mahalliy simulyatsiya qilib XAUView feed'ni tekshirish.

Nima qiladi:
  1. MetaTrader5 modulini import darajasida BLOKLAYDI (Linux/Render'da u yo'q).
  2. XAUVIEW_DATA=open bilan server/app.py'ni alohida uvicorn jarayonida ko'taradi
     (standart port 8766 - mavjud 8765 serverga TEGMAYDI).
  3. /api/health, /, /api/candles, /api/providers va /ws ni tekshiradi.
  4. PASS/FAIL jadvalini chop etadi; hammasi PASS bo'lsa exit code 0.

Ishlatilishi:
    python test_render_local.py
    python test_render_local.py --port 8777
    python test_render_local.py --url https://xauview.onrender.com   # masofadan

Talablar: fastapi, uvicorn[standard] (websockets bilan). MT5 kerak emas.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Optional

BASE_DIR = Path(__file__).resolve().parent
HERE = BASE_DIR
DEFAULT_PORT = 8766
EXPECTED_BARS = 600

# MetaTrader5'ni "yo'q" qilib ko'rsatadigan bootstrap: Linux'dagi ImportError.
BOOTSTRAP = r'''
import sys

class _NoMetaTrader5:
    """Linux/Render simulyatsiyasi: MetaTrader5 umuman o'rnatilmagan."""

    def find_spec(self, name, path=None, target=None):
        if name == "MetaTrader5":
            raise ImportError("MetaTrader5 bloklandi (Render/Linux simulyatsiyasi)")
        return None

sys.meta_path.insert(0, _NoMetaTrader5())

import uvicorn

uvicorn.run(
    "app:app",
    host="127.0.0.1",
    port=__PORT__,
    log_level="info",
    access_log=False,
)
'''

ROWS: list[dict[str, Any]] = []


def check(name: str, expected: str, actual: Any, ok: bool) -> bool:
    text = str(actual)
    if len(text) > 150:
        text = text[:147] + "..."
    ROWS.append({"name": name, "expected": expected, "actual": text, "ok": bool(ok)})
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}: {text}")
    return bool(ok)


def http_json(url: str, timeout: float = 10.0) -> tuple[int, Any]:
    request = urllib.request.Request(url, headers={"User-Agent": "xauview-render-test/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
        return response.status, json.loads(body.decode("utf-8", "replace"))


def http_status(url: str, timeout: float = 10.0) -> tuple[int, str, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "xauview-render-test/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
        return response.status, response.headers.get("Content-Type", ""), body.decode("utf-8", "replace")


def wait_health(base: str, timeout_s: float) -> Optional[dict]:
    """Server (yoki Render cold start) tayyor bo'lguncha /api/health ni so'raydi."""
    deadline = time.time() + timeout_s
    last_error: Optional[str] = None
    while time.time() < deadline:
        try:
            status, payload = http_json(base + "/api/health", timeout=8.0)
            if status == 200 and isinstance(payload, dict) and payload.get("ok"):
                return payload
            last_error = f"status={status} payload={str(payload)[:120]}"
        except Exception as exc:  # urllib.error / timeout / json
            last_error = f"{type(exc).__name__}: {exc}"
        time.sleep(1.0)
    print(f"  [FAIL] /api/health {timeout_s:.0f}s ichida javob bermadi ({last_error})")
    return None


def check_rest(base: str) -> list[bool]:
    results: list[bool] = []

    # 1) /api/health
    health = wait_health(base, 60.0 if base.startswith("http://127.0.0.1") else 150.0)
    if health is None:
        results.append(check("/api/health", "200 + ok=true", "javob yo'q", False))
        return results
    results.append(check("/api/health", "200 + ok=true", f"200 ok={health.get('ok')}", health.get("ok") is True))
    results.append(check("data_mode", "open (MT5 yo'q)", health.get("data_mode"), health.get("data_mode") == "open"))
    results.append(check("mt5 ulanishi", "false", health.get("mt5"), health.get("mt5") is False))
    results.append(check("mt5_available", "false (Linux)", health.get("mt5_available", "yo'q maydon"), health.get("mt5_available") is False))
    results.append(check("open_available", "true", health.get("open_available"), health.get("open_available") is True))

    # 2) / (mobil ilova)
    try:
        status, ctype, body = http_status(base + "/")
        results.append(check("GET /", "200 + text/html", f"{status} {ctype}", status == 200 and "text/html" in ctype))
        results.append(check("GET / kontenti", "HTML sahifa", f"{len(body)} bayt", "<html" in body.lower()))
    except Exception as exc:
        results.append(check("GET /", "200 + text/html", f"{type(exc).__name__}: {exc}", False))

    # 3) /api/candles (open provayder)
    try:
        status, payload = http_json(base + "/api/candles?symbol=XAUUSD&tf=M1&count=100")
        bars = payload.get("bars") or []
        provider = payload.get("provider")
        results.append(check("/api/candles holati", "200", status, status == 200))
        results.append(check("/api/candles barlar", "100", len(bars), len(bars) == 100))
        results.append(check("/api/candles provider", "!= mt5", provider, provider != "mt5"))
    except Exception as exc:
        results.append(check("/api/candles", "200 + 100 bar", f"{type(exc).__name__}: {exc}", False))

    # 4) /api/providers (open provayderlar holati)
    try:
        status, payload = http_json(base + "/api/providers")
        providers = payload.get("providers") or []
        names = [row.get("name") for row in providers]
        ok_names = [row.get("name") for row in providers if row.get("ok") is True]
        open_ticks = payload.get("open_ticks") or {}
        xau = open_ticks.get("XAUUSD") or {}
        results.append(check("/api/providers holati", "200", status, status == 200))
        results.append(check("/api/providers active", "!= mt5", payload.get("active"), payload.get("active") != "mt5"))
        results.append(check("provayderlar ro'yxati", "mt5,yahoo,stooq,goldapi", ",".join(str(n) for n in names),
                             all(n in names for n in ("mt5", "yahoo"))))
        results.append(check("ishlayotgan provayder", "kamida 1 ta open", ",".join(str(n) for n in ok_names) or "yo'q",
                             len(ok_names) >= 1))
        results.append(check("open tick XAUUSD", "narx > 0", xau.get("price"), isinstance(xau.get("price"), (int, float)) and float(xau["price"]) > 0))
    except Exception as exc:
        results.append(check("/api/providers", "200 + open holat", f"{type(exc).__name__}: {exc}", False))
    return results


async def check_ws_async(base: str) -> list[bool]:
    """WS: snapshot 600 bar va keyingi tick ikkalasi open provayderdan."""
    result: list[bool] = []
    try:
        import websockets  # uvicorn[standard] bilan keladi
    except Exception as exc:
        result.append(check("websockets kutubxonasi", "o'rnatilgan", f"{type(exc).__name__}: {exc}", False))
        return result

    ws_base = base.replace("https://", "wss://").replace("http://", "ws://").rstrip("/")
    url = ws_base + "/ws?symbol=XAUUSD&tf=M1"
    snapshot: Optional[dict] = None
    tick: Optional[dict] = None
    extra: list[str] = []
    try:
        async with websockets.connect(url, open_timeout=30, close_timeout=5, max_size=16 * 1024 * 1024) as ws:
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline and (snapshot is None or tick is None):
                raw = await asyncio.wait_for(ws.recv(), timeout=35)
                message = json.loads(raw)
                kind = message.get("type")
                if kind == "snapshot" and snapshot is None:
                    snapshot = message
                elif kind == "tick" and tick is None:
                    tick = message
                elif kind == "error":
                    extra.append(str(message.get("error")))
                    break
    except Exception as exc:
        result.append(check("WS ulanish", f"{url} ochiladi", f"{type(exc).__name__}: {exc}", False))
        return result

    result.append(check("WS ulanish", "accept", url, True))
    if snapshot is None:
        result.append(check("WS snapshot", "type=snapshot", f"yo'q (errors={extra})", False))
    else:
        bars = snapshot.get("bars") or []
        provider = snapshot.get("provider")
        result.append(check("WS snapshot turi", "snapshot", snapshot.get("type"), snapshot.get("type") == "snapshot"))
        result.append(check("WS snapshot barlar", str(EXPECTED_BARS), len(bars), len(bars) == EXPECTED_BARS))
        result.append(check("WS snapshot provider", "!= mt5", provider, provider != "mt5"))
        valid_bar = bool(bars) and len(bars[0]) == 6 and float(bars[-1][4]) > 0
        result.append(check("WS snapshot OHLCV", "6 ustun, close>0", (bars[0] if bars else [])[:6], valid_bar))

    if tick is None:
        result.append(check("WS tick", "type=tick", "45s ichida kelmadi", False))
    else:
        price = tick.get("price")
        provider = tick.get("provider")
        result.append(check("WS tick turi", "tick", tick.get("type"), tick.get("type") == "tick"))
        result.append(check("WS tick narxi", "> 0", price, isinstance(price, (int, float)) and float(price) > 0))
        result.append(check("WS tick provider", "!= mt5", provider, provider != "mt5"))
        bar = tick.get("bar") or []
        result.append(check("WS tick bari", "joriy bar (6 ustun)", bar[:6], len(bar) == 6))
    return result


def check_ws(base: str) -> list[bool]:
    return asyncio.run(check_ws_async(base))


def free_port(preferred: int) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def start_local_server(port: int) -> tuple[subprocess.Popen, Path]:
    log_path = Path(tempfile.gettempdir()) / f"xauview_render_test_{port}.log"
    log_file = open(log_path, "w", encoding="utf-8")
    env = dict(os.environ)
    env.update({
        "XAUVIEW_DATA": "open",          # MT5 ishlatilmaydi
        "XAUVIEW_OPEN_POLL_S": "2",
        "PYTHONUNBUFFERED": "1",
        "PYTHONPATH": str(HERE),
    })
    code = BOOTSTRAP.replace("__PORT__", str(port))
    proc = subprocess.Popen(
        [sys.executable, "-c", code],
        cwd=str(HERE),
        env=env,
        stdout=log_file,
        stderr=subprocess.STDOUT,
    )
    return proc, log_path


def tail(path: Path, lines: int = 40) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return "(log o'qilmadi)"
    return "\n".join(text.splitlines()[-lines:])


def main() -> int:
    parser = argparse.ArgumentParser(description="XAUView Render/Linux simulyatsiya testi")
    parser.add_argument("--url", help="masofadagi server (masalan https://xauview.onrender.com); bo'sh bo'lsa lokal ko'tariladi")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"lokal port (default {DEFAULT_PORT})")
    parser.add_argument("--keep", action="store_true", help="testdan keyin lokal serverni o'chirmaslik")
    args = parser.parse_args()

    print("=" * 78)
    print("XAUView - Render FREE (Linux, MT5 yo'q) mahalliy simulyatsiya testi")
    print("=" * 78)

    proc: Optional[subprocess.Popen] = None
    log_path: Optional[Path] = None
    base = (args.url or "").rstrip("/")
    if base:
        print(f"Rejim: MASOFA  {base}")
    else:
        port = free_port(args.port)
        base = f"http://127.0.0.1:{port}"
        print(f"Rejim: LOKAL   {base}  (MetaTrader5 bloklangan, XAUVIEW_DATA=open)")
        proc, log_path = start_local_server(port)

    started = time.time()
    try:
        results = check_rest(base)
        try:
            results += check_ws(base)
        except Exception as exc:
            results.append(check("WS tekshiruvi", "bajarildi", f"{type(exc).__name__}: {exc}", False))
    finally:
        if proc is not None:
            if args.keep:
                print(f"\nServer ishlab turibdi: {base}  (PID {proc.pid})")
            else:
                proc.terminate()
                try:
                    proc.wait(timeout=15)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=10)

    elapsed = time.time() - started
    passed = sum(1 for row in ROWS if row["ok"])
    failed = [row for row in ROWS if not row["ok"]]

    print("\n" + "=" * 78)
    print("NATIJALAR JADVALI")
    print("=" * 78)
    print(f"{'#':>2}  {'TEKSHIRUV':<26} {'KUTILGAN':<24} {'NATIJA':<28} HOLAT")
    print("-" * 78)
    for index, row in enumerate(ROWS, 1):
        print(f"{index:>2}  {row['name']:<26} {row['expected']:<24} {row['actual']:<28} {'PASS' if row['ok'] else 'FAIL'}")
    print("-" * 78)
    print(f"JAMI: {passed}/{len(ROWS)} PASS, {len(failed)} FAIL  ({elapsed:.1f}s)")

    if failed and log_path is not None and log_path.exists():
        print("\n--- server log (oxirgi 40 satr) ---")
        print(tail(log_path))

    if failed:
        print("\nNATIJA: FAIL")
        return 1
    print("\nNATIJA: PASS - server Render/Linux muhitida (MT5'siz) ishlaydi")
    if log_path is not None and log_path.exists():
        try:
            log_path.unlink()
        except OSError:
            pass
    return 0


if __name__ == "__main__":
    sys.exit(main())

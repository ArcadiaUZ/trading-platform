#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""XAUUSD / GBPUSD LIVE feed server (FastAPI + MetaTrader5).

Faqat o'qish (market data) API'lari ishlatiladi:
    symbol_info, symbol_info_tick, symbol_select, copy_rates_from_pos
Trading API'lari (order_send, positions, history, ...) ishlatilmaydi.

Ishga tushirish:
    python -m uvicorn app:app --host 0.0.0.0 --port 8765
yoki:
    pwsh -File run.ps1

REST:  /api/health, /api/candles, /api/alerts
WS:    /ws?symbol=XAUUSD&tf=M1
"""
from __future__ import annotations

import asyncio
import json
import logging
import logging.handlers
import os
import socket
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

import MetaTrader5 as mt5
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator

# ---------------------------------------------------------------------------
# Konfiguratsiya
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
MOBILE_DIR = ROOT_DIR / "mobile"
ALERTS_FILE = BASE_DIR / "alerts.json"
LOG_FILE = BASE_DIR / "server.log"

HOST = os.getenv("FEED_HOST", "0.0.0.0")
PORT = int(os.getenv("FEED_PORT", "8765"))

# logik symbol -> broker symbol
SYMBOLS: dict[str, str] = {
    "XAUUSD": os.getenv("XAU_SYMBOL", "XAUUSDm"),
    "GBPUSD": os.getenv("GBP_SYMBOL", "GBPUSDm"),
}
DEFAULT_DIGITS: dict[str, int] = {"XAUUSD": 3, "GBPUSD": 5}

TF_VALUES: dict[str, int] = {
    "D1": mt5.TIMEFRAME_D1,
    "H4": mt5.TIMEFRAME_H4,
    "H1": mt5.TIMEFRAME_H1,
    "M15": mt5.TIMEFRAME_M15,
    "M5": mt5.TIMEFRAME_M5,
    "M3": mt5.TIMEFRAME_M3,
    "M1": mt5.TIMEFRAME_M1,
}
TF_SECONDS: dict[str, int] = {
    "D1": 86400, "H4": 14400, "H1": 3600,
    "M15": 900, "M5": 300, "M3": 180, "M1": 60,
}
DEFAULT_TF = "M1"
DEFAULT_SYMBOL = "XAUUSD"

# --- Alert turlari konfiguratsiyasi ----------------------------------------
TZ_UTC5 = timezone(timedelta(hours=5))          # Toshkent vaqti (UTC+5)
ASIA_START_HOUR = 5                             # Asia diapazoni: 05:00-11:00 UTC+5
ASIA_END_HOUR = 11
SESSION_KILLZONE_UTC5: dict[str, tuple[int, int]] = {
    "london": (11, 30),                         # 11:30 UTC+5 (chart: London KZ 11:30-14:00)
    "ny": (16, 30),                             # 16:30 UTC+5 (chart: NY KZ 16:30-19:00)
}
SESSION_LABELS = {"london": "London", "ny": "New York"}
ALERT_TYPES = ("price", "zone", "sweep", "session")

TICK_INTERVAL = 0.30          # WS tick yuborish oraligi (soniya)
TICK_POLL_INTERVAL = 0.10     # MT5 tick cache yangilash oraligi
ALERT_CHECK_INTERVAL = 0.10   # alert tekshirish oraligi
BAR_REFRESH_INTERVAL = 15.0   # oxirgi 3 barni MT5'dan qayta o'qish oraligi
SNAPSHOT_BARS = 600           # WS ulanishda yuboriladigan bar soni
MAX_CANDLES = 5000
MAX_WS_CLIENTS = 64
VERSION = "1.0.0"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_FORMAT = "%(asctime)s %(levelname)-7s %(message)s"


def setup_logging() -> logging.Logger:
    log = logging.getLogger("feed")
    log.setLevel(logging.INFO)
    log.propagate = False
    if log.handlers:
        return log
    formatter = logging.Formatter(LOG_FORMAT, datefmt="%Y-%m-%d %H:%M:%S")
    stream = logging.StreamHandler(sys.stdout)
    stream.setFormatter(formatter)
    log.addHandler(stream)
    try:
        file_handler = logging.handlers.RotatingFileHandler(
            str(LOG_FILE), maxBytes=5 * 1024 * 1024, backupCount=2, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        log.addHandler(file_handler)
    except OSError as exc:  # pragma: no cover
        log.warning("Log faylini ochish imkonsiz: %s", exc)
    return log


logger = setup_logging()

# ---------------------------------------------------------------------------
# Yordamchi funksiyalar
# ---------------------------------------------------------------------------
_MT5_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="mt5")


async def mt5_async(fn, *args):
    """Barcha MT5 chaqiruvlari bitta alohida thread'da va ketma-ket bajariladi."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_MT5_EXECUTOR, fn, *args)


async def mt5_wait(fn, *args, timeout: float = 10.0):
    """Timeout bilan MT5 chaqiruvi: terminal qotib qolsa asosiy loop bloklanmaydi."""
    try:
        return await asyncio.wait_for(mt5_async(fn, *args), timeout)
    except asyncio.TimeoutError:
        logger.warning("MT5 chaqiruv timeout (%.0fs): %s", timeout, getattr(fn, "__name__", fn))
        manager.connected = False
        return None


def lan_ips() -> list[str]:
    """Mashinaning IPv4 manzillari: 192.168.x -> route IP -> 10.x -> boshqalar."""
    candidates: list[str] = []
    route_ip: Optional[str] = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            sock.connect(("8.8.8.8", 80))
            route_ip = sock.getsockname()[0]
        finally:
            sock.close()
    except OSError:
        route_ip = None
    try:
        infos = socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET)
        for info in infos:
            ip = info[4][0]
            if ip and ip not in candidates:
                candidates.append(ip)
    except OSError:
        pass
    if route_ip and route_ip not in candidates:
        candidates.insert(0, route_ip)

    def usable(ip: str) -> bool:
        return not (ip.startswith("127.") or ip.startswith("169.254.") or ip == "0.0.0.0")

    filtered = [ip for ip in candidates if usable(ip)]
    if not filtered:
        return ["127.0.0.1"]

    def score(ip: str) -> int:
        if ip.startswith("192.168."):
            return 0
        if ip == route_ip:
            return 1
        if ip.startswith("10."):
            return 2
        return 3

    filtered.sort(key=score)
    return filtered


def lan_ip() -> str:
    return lan_ips()[0]


def set_timer_resolution(begin: bool) -> None:
    """Windows'da asyncio sleep aniqligini 1 ms gacha oshiradi."""
    if sys.platform != "win32":
        return
    try:
        import ctypes

        winmm = ctypes.WinDLL("winmm")
        winmm.timeBeginPeriod(1) if begin else winmm.timeEndPeriod(1)
    except Exception:  # pragma: no cover
        pass


def rate_to_bar(rate: Any, digits: int) -> list:
    return [
        int(rate["time"]),
        round(float(rate["open"]), digits),
        round(float(rate["high"]), digits),
        round(float(rate["low"]), digits),
        round(float(rate["close"]), digits),
        int(rate["tick_volume"]),
    ]


def fetch_bars_sync(broker: str, tf_value: int, count: int, digits: int) -> Optional[list]:
    """MT5'dan bar o'qish. None -> MT5 xato; [] -> bar yo'q."""
    try:
        rates = mt5.copy_rates_from_pos(broker, tf_value, 0, count)
    except Exception:
        logger.exception("copy_rates_from_pos xatosi (%s)", broker)
        return None
    if rates is None:
        logger.warning("copy_rates_from_pos None qaytardi (%s): %s", broker, mt5.last_error())
        return None
    if len(rates) == 0:
        return []
    return [rate_to_bar(rate, digits) for rate in rates]


async def bars_for(broker: str, tf_value: int, count: int, digits: int) -> Optional[list]:
    bars = await mt5_wait(fetch_bars_sync, broker, tf_value, count, digits, timeout=15.0)
    if bars is None:
        await manager.ensure()
        bars = await mt5_wait(fetch_bars_sync, broker, tf_value, count, digits, timeout=15.0)
    return bars


# ---------------------------------------------------------------------------
# Tick cache
# ---------------------------------------------------------------------------
class TickStore:
    """Eng oxirgi tick'lar (asyncio loop ichida, lock kerak emas)."""

    def __init__(self) -> None:
        self._data: dict[str, dict] = {}
        self._mono: dict[str, float] = {}

    def update(self, symbol: str, bid: float, ask: float, price: float,
               last: float, tick_time: int) -> None:
        self._data[symbol] = {
            "symbol": symbol,
            "bid": bid,
            "ask": ask,
            "price": price,
            "last": last,
            "time": int(tick_time),
        }
        self._mono[symbol] = time.monotonic()

    def get(self, symbol: str) -> Optional[dict]:
        return self._data.get(symbol)

    def age(self, symbol: str) -> float:
        mono = self._mono.get(symbol)
        return float("inf") if mono is None else time.monotonic() - mono


TICKS = TickStore()


# ---------------------------------------------------------------------------
# MT5 ulanish menejeri
# ---------------------------------------------------------------------------
class MT5Manager:
    def __init__(self) -> None:
        self.connected = False
        self.digits: dict[str, int] = {}
        self.account: Optional[dict] = None
        self._stop = False
        self._last_connect_attempt = 0.0

    # -- sync qism (executor thread) ---------------------------------------
    def _connect_sync(self) -> bool:
        self._last_connect_attempt = time.monotonic()
        try:
            ok = mt5.initialize()
            if not ok:
                logger.warning("mt5.initialize() muvaffaqiyatsiz: %s", mt5.last_error())
                try:
                    mt5.shutdown()
                except Exception:
                    pass
                time.sleep(0.3)
                ok = mt5.initialize()
            if not ok:
                logger.error("MT5 qayta ulanmadi: %s", mt5.last_error())
                return False

            account = mt5.account_info()
            if account is None:
                logger.warning("account_info() None - terminal tayyor emas")
                return False

            digits: dict[str, int] = {}
            for logical, broker in SYMBOLS.items():
                if not mt5.symbol_select(broker, True):
                    logger.warning("symbol_select(%s) muvaffaqiyatsiz", broker)
                info = mt5.symbol_info(broker)
                if info is None or int(info.digits) <= 0:
                    logger.error("symbol_info(%s) topilmadi", broker)
                    continue
                digits[logical] = int(info.digits)
                mt5.symbol_info_tick(broker)
            if not digits:
                logger.error("Hech qanday symbol tayyor emas")
                return False

            self.digits = digits
            self.account = {
                "login": int(account.login),
                "server": account.server,
                "balance": float(account.balance),
                "currency": account.currency,
            }
            logger.info(
                "MT5 ulandi: login=%s server=%s balance=%.2f digits=%s",
                account.login, account.server, account.balance, digits,
            )
            return True
        except Exception:
            logger.exception("MT5 ulanish xatosi")
            return False

    def _health_sync(self) -> bool:
        try:
            terminal = mt5.terminal_info()
            if terminal is None or not getattr(terminal, "connected", False):
                return False
            return mt5.account_info() is not None
        except Exception:
            logger.exception("MT5 health xatosi")
            return False

    def _shutdown_sync(self) -> None:
        try:
            mt5.shutdown()
        except Exception:
            logger.debug("mt5.shutdown xatosi", exc_info=True)

    # -- async qism --------------------------------------------------------
    async def connect(self) -> bool:
        if self.connected:
            return True
        ok = bool(await mt5_wait(self._connect_sync, timeout=30.0))
        if ok:
            self.connected = True
        return ok

    async def ensure(self) -> bool:
        if self.connected:
            return True
        return await self.connect()

    async def loop(self) -> None:
        backoff = 1.0
        while not self._stop:
            if self.connected:
                await asyncio.sleep(1.0)
                continue
            ok = await self.connect()
            if ok:
                logger.info("MT5 ulanish tiklandi")
                backoff = 1.0
                continue
            logger.warning("MT5 reconnect %.0f s dan keyin qayta urinadi", backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2.0, 30.0)

    async def watchdog(self) -> None:
        while not self._stop:
            await asyncio.sleep(5.0)
            if not self.connected:
                continue
            try:
                healthy = bool(await mt5_wait(self._health_sync, timeout=8.0))
            except Exception:
                logger.exception("MT5 watchdog xatosi")
                healthy = False
            if not healthy:
                logger.warning("MT5 health check muvaffaqiyatsiz - qayta ulanish")
                self.connected = False

    async def poll_ticks(self) -> None:
        """symbol_info_tick ma'lumotlarini cache'ga yig'adi."""
        failures = {symbol: 0 for symbol in SYMBOLS}
        while not self._stop:
            started = time.monotonic()
            for logical, broker in SYMBOLS.items():
                tick = None
                try:
                    tick = await mt5_wait(mt5.symbol_info_tick, broker, timeout=5.0)
                except Exception:
                    logger.exception("symbol_info_tick xatosi (%s)", broker)
                if tick is None:
                    failures[logical] = failures.get(logical, 0) + 1
                    if failures[logical] in (3, 10, 30):
                        logger.warning("Tick yo'q: %s (%d marta ketma-ket)", broker, failures[logical])
                    if failures[logical] >= 3:
                        self.connected = False
                    continue
                failures[logical] = 0
                digits = self.digits.get(logical) or DEFAULT_DIGITS.get(logical, 5)
                bid = float(tick.bid)
                ask = float(tick.ask)
                last = float(getattr(tick, "last", 0.0) or 0.0)
                price = round(last if last > 0 else bid, digits)
                TICKS.update(
                    logical,
                    bid=round(bid, digits),
                    ask=round(ask, digits),
                    price=price,
                    last=round(last, digits) if last > 0 else 0.0,
                    tick_time=int(tick.time),
                )
            elapsed = time.monotonic() - started
            await asyncio.sleep(max(0.0, TICK_POLL_INTERVAL - elapsed))


manager = MT5Manager()


# ---------------------------------------------------------------------------
# Alertlar (alerts.json)
# ---------------------------------------------------------------------------
ALERTS: list[dict] = []


def _normalize_alert(item: dict) -> Optional[dict]:
    """alerts.json yozuvini joriy sxemaga keltiradi (eski 'price' yozuvlar ham)."""
    if not isinstance(item, dict):
        return None
    symbol = str(item.get("symbol", "")).upper()
    if symbol not in SYMBOLS:
        return None
    alert_type = str(item.get("type") or "price").lower()
    if alert_type not in ALERT_TYPES:
        return None
    digits = DEFAULT_DIGITS.get(symbol, 5)
    triggered_at = item.get("triggered_at")
    if triggered_at is None:
        triggered_at = item.get("triggered")
    try:
        triggered_at = int(triggered_at) if triggered_at else None
    except (TypeError, ValueError):
        triggered_at = None
    status = str(item.get("status") or "").lower()
    if status not in ("armed", "triggered"):
        status = "triggered" if triggered_at else "armed"
    price_at = item.get("price_at")
    try:
        price_at = float(price_at) if price_at is not None else None
    except (TypeError, ValueError):
        price_at = None
    alert: dict = {
        "id": str(item.get("id") or uuid.uuid4().hex[:8]),
        "type": alert_type,
        "symbol": symbol,
        "status": status,
        "active": status == "armed",
        "created": int(item.get("created") or time.time()),
        "triggered_at": triggered_at,
        "triggered": triggered_at,
        "price_at": price_at,
        "message": item.get("message"),
        "trigger_count": int(item.get("trigger_count") or 0),
        "note": str(item.get("note") or ""),
    }
    if alert_type == "price":
        direction = str(item.get("dir", "")).lower()
        if direction not in ("above", "below"):
            return None
        try:
            price = float(item.get("price"))
        except (TypeError, ValueError):
            return None
        if price <= 0:
            return None
        alert.update({"dir": direction, "price": round(price, digits)})
    elif alert_type == "zone":
        try:
            lo = float(item.get("lo"))
            hi = float(item.get("hi"))
        except (TypeError, ValueError):
            return None
        if not (0 < lo < hi):
            return None
        tf = str(item.get("tf") or "M15").upper()
        if tf not in TF_VALUES:
            return None
        alert.update({
            "tf": tf,
            "lo": round(lo, digits),
            "hi": round(hi, digits),
            "label": str(item.get("label") or ""),
            "repeat": bool(item.get("repeat", False)),
            "on_cross": bool(item.get("on_cross", False)),
            "state": item.get("state") if isinstance(item.get("state"), dict) else {},
        })
    elif alert_type == "sweep":
        after = item.get("after_date")
        if after:
            try:
                after = date.fromisoformat(str(after)).isoformat()
            except ValueError:
                after = None
        alert.update({
            "after_date": after or None,
            "state": item.get("state") if isinstance(item.get("state"), dict) else {},
        })
    elif alert_type == "session":
        which = str(item.get("which") or "").lower()
        if which not in SESSION_KILLZONE_UTC5:
            return None
        state = item.get("state") if isinstance(item.get("state"), dict) else {}
        if not state.get("target_ts"):
            state["target_ts"] = session_target_ts(which)
        alert.update({"which": which, "state": state})
    return alert


def load_alerts() -> None:
    global ALERTS
    ALERTS = []
    if not ALERTS_FILE.exists():
        logger.info("alerts.json yo'q - bo'sh ro'yxatdan boshlanadi")
        return
    try:
        raw = json.loads(ALERTS_FILE.read_text(encoding="utf-8"))
        items = raw.get("alerts") if isinstance(raw, dict) else raw
        if not isinstance(items, list):
            raise ValueError("kutilmagan format")
        result: list[dict] = []
        for item in items:
            normalized = _normalize_alert(item)
            if normalized is not None:
                result.append(normalized)
        ALERTS = result
        logger.info("alerts.json yuklandi: %d ta alert", len(ALERTS))
    except Exception:
        logger.exception("alerts.json o'qish xatosi - bo'sh ro'yxat")


ALERTS_SAVE_LOCK = asyncio.Lock()   # parallel yozuvlarni serializatsiya qiladi


def _write_text_atomic_sync(path: Path, text: str) -> None:
    tmp = path.with_name(f"{path.name}.{uuid.uuid4().hex[:8]}.tmp")
    try:
        tmp.write_text(text, encoding="utf-8")
        os.replace(tmp, path)
    finally:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass


async def save_alerts() -> None:
    """Alertlarni alerts.json ga atomik yozadi (parallel yozuvlar xavfsiz)."""
    async with ALERTS_SAVE_LOCK:
        try:
            text = json.dumps({"alerts": ALERTS}, ensure_ascii=False, indent=2)
            await asyncio.to_thread(_write_text_atomic_sync, ALERTS_FILE, text)
        except Exception:
            logger.exception("alerts.json yozish xatosi")


def _alert_digits(symbol: str) -> int:
    return manager.digits.get(symbol) or DEFAULT_DIGITS.get(symbol, 5)


# ---------------------------------------------------------------------------
# Alert turlari uchun hisob-kitoblar (sof funksiyalar - unit test uchun)
# ---------------------------------------------------------------------------
ASIA_CACHE: dict[tuple[str, str], dict] = {}


def today_utc5() -> str:
    return datetime.now(TZ_UTC5).strftime("%Y-%m-%d")


def asia_window_bounds(day: date) -> tuple[int, int]:
    """Asia sessiyasi (05:00-11:00 UTC+5) = UTC 00:00-06:00."""
    start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
    start_ts = int(start.timestamp())
    return start_ts, start_ts + (ASIA_END_HOUR - ASIA_START_HOUR) * 3600


def asia_range_from_bars(bars: list, start_ts: int, end_ts: int, digits: int) -> Optional[dict]:
    """Bar ro'yxatidan Asia HIGH/LOW (kamida 3 bar bo'lsa)."""
    selected = [bar for bar in bars if start_ts <= int(bar[0]) < end_ts]
    if len(selected) < 3:
        return None
    high = max(float(bar[2]) for bar in selected)
    low = min(float(bar[3]) for bar in selected)
    return {"high": round(high, digits), "low": round(low, digits), "bars": len(selected)}


def detect_sweeps(bars: list, range_high: float, range_low: float, digits: int,
                  after_ts: int = 0) -> list[dict]:
    """M1 barlarda BSL/SSL sweep: wick diapazondan chiqib, close ichkariga qaytgan."""
    events: list[dict] = []
    for bar in bars:
        bar_ts = int(bar[0])
        if bar_ts < after_ts:
            continue
        high = float(bar[2])
        low = float(bar[3])
        close = float(bar[4])
        if high > range_high and close <= range_high:
            events.append({"side": "bsl", "bar_ts": bar_ts,
                           "wick": round(high, digits), "close": round(close, digits)})
        if low < range_low and close >= range_low:
            events.append({"side": "ssl", "bar_ts": bar_ts,
                           "wick": round(low, digits), "close": round(close, digits)})
    return events


def session_target_ts(which: str, now: Optional[float] = None) -> int:
    """Keyingi killzone ochilishi (UTC+5) epoch sekundda."""
    hour, minute = SESSION_KILLZONE_UTC5[which]
    current = time.time() if now is None else float(now)
    local_now = datetime.fromtimestamp(current, TZ_UTC5)
    target = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if target.timestamp() <= current:
        target += timedelta(days=1)
    return int(target.timestamp())


async def get_asia_range(symbol: str, day_str: str) -> Optional[dict]:
    """Kun uchun Asia HIGH/LOW (M15, kerak bo'lsa H1) - cache bilan."""
    key = (symbol, day_str)
    if key in ASIA_CACHE:
        return ASIA_CACHE[key]
    try:
        day = date.fromisoformat(day_str)
    except ValueError:
        return None
    start_ts, end_ts = asia_window_bounds(day)
    if time.time() < end_ts:
        return None
    broker = SYMBOLS[symbol]
    digits = _alert_digits(symbol)
    for tf_value, tf_name in ((mt5.TIMEFRAME_M15, "M15"), (mt5.TIMEFRAME_H1, "H1")):
        rates = await mt5_wait(
            mt5.copy_rates_range, broker, tf_value,
            datetime.fromtimestamp(start_ts, timezone.utc),
            datetime.fromtimestamp(end_ts, timezone.utc),
            timeout=15.0,
        )
        if rates is None or len(rates) == 0:
            continue
        bars = [rate_to_bar(rate, digits) for rate in rates]
        rng = asia_range_from_bars(bars, start_ts, end_ts, digits)
        if rng is not None:
            rng["source"] = tf_name
            ASIA_CACHE[key] = rng
            if len(ASIA_CACHE) > 64:
                for stale in list(ASIA_CACHE)[:-32]:
                    ASIA_CACHE.pop(stale, None)
            logger.info("Asia diapazon (%s %s): high=%s low=%s (%s bar, %s)",
                        symbol, day_str, rng["high"], rng["low"], rng["bars"], tf_name)
            return rng
    return None


async def prepare_sweep_alert(alert: dict, now: Optional[float] = None) -> None:
    """POST paytida sweep holatini darhol to'ldiradi: day/sides/range/last_bar_ts."""
    current = time.time() if now is None else float(now)
    day_str = alert.get("after_date") or today_utc5()
    state = alert.setdefault("state", {})
    state.clear()
    state.update({
        "day": day_str,
        "sides": {"bsl": {"done": False}, "ssl": {"done": False}},
        "last_bar_ts": int(current) // 60 * 60 - 60,
        "range": None,
    })
    rng = await get_asia_range(alert["symbol"], day_str)
    if rng is not None:
        state["range"] = {
            "high": rng["high"],
            "low": rng["low"],
            "day": day_str,
            "bars": rng.get("bars"),
            "source": rng.get("source"),
        }


async def prepare_alert(alert: dict) -> None:
    """Alert yaratilganda turga mos dastlabki holatni hisoblaydi."""
    if alert.get("type") == "sweep":
        await prepare_sweep_alert(alert)


def _current_price(symbol: str) -> Optional[float]:
    tick = TICKS.get(symbol)
    return float(tick["price"]) if tick else None


def alert_distance(alert: dict, price: Optional[float]) -> Optional[float]:
    """Joriy narxdan alertgacha masofa (digits bo'yicha)."""
    if price is None:
        return None
    digits = _alert_digits(alert["symbol"])
    alert_type = alert.get("type", "price")
    if alert_type == "price":
        return round(abs(float(price) - float(alert["price"])), digits)
    if alert_type == "zone":
        lo = float(alert["lo"])
        hi = float(alert["hi"])
        if lo <= price <= hi:
            return 0.0
        return round(min(abs(price - lo), abs(price - hi)), digits)
    if alert_type == "sweep":
        rng = (alert.get("state") or {}).get("range") or {}
        high = rng.get("high")
        low = rng.get("low")
        if high is None or low is None:
            return None
        if float(low) <= price <= float(high):
            return 0.0
        return round(min(abs(price - float(high)), abs(price - float(low))), digits)
    return None


def alert_public(alert: dict, price: Optional[float] = None) -> dict:
    """API/WS uchun alert nusxasi (ichki 'state' yashiriladi)."""
    public = {key: value for key, value in alert.items() if key != "state"}
    public["status"] = alert.get("status") or ("triggered" if alert.get("triggered_at") else "armed")
    public["active"] = public["status"] == "armed"
    public["triggered_at"] = alert.get("triggered_at")
    public["triggered"] = alert.get("triggered_at")   # eski maydon (backward compat)
    if alert.get("type") == "sweep":
        state = alert.get("state") or {}
        rng = state.get("range") or {}
        public["range"] = {"high": rng.get("high"), "low": rng.get("low"), "day": rng.get("day")}
        sides = state.get("sides") or {}
        public["sides"] = {
            "bsl": bool((sides.get("bsl") or {}).get("done")),
            "ssl": bool((sides.get("ssl") or {}).get("done")),
        }
    if alert.get("type") == "session":
        public["target_ts"] = (alert.get("state") or {}).get("target_ts")
    public["distance"] = alert_distance(alert, price)
    return public


def _alert_summary(alert: dict) -> str:
    alert_type = alert.get("type", "price")
    if alert_type == "price":
        return f"{alert.get('dir')} {alert.get('price')}"
    if alert_type == "zone":
        return f"zone {alert.get('lo')}-{alert.get('hi')} ({alert.get('tf')})"
    if alert_type == "sweep":
        return f"sweep after_date={alert.get('after_date')}"
    if alert_type == "session":
        return f"session {alert.get('which')}"
    return alert_type


async def fire_alert(alert: dict, message: str, price_at: Optional[float]) -> None:
    """Alertni trigger holatiga o'tkazadi, faylga yozadi va WS'ga yuboradi."""
    now = int(time.time())
    alert["status"] = "triggered"
    alert["active"] = False
    alert["triggered_at"] = now
    alert["triggered"] = now
    alert["price_at"] = price_at
    alert["message"] = message
    alert["trigger_count"] = int(alert.get("trigger_count") or 0) + 1
    logger.info("ALERT trigger [%s]: %s", alert.get("type"), message)
    await save_alerts()
    broadcast_alert(alert)


def broadcast_alert(alert: dict) -> None:
    price_at = alert.get("price_at")
    payload = {
        "type": "alert",
        "id": alert.get("id"),
        "symbol": alert.get("symbol"),
        "message": alert.get("message") or "",
        "price": price_at,
        "ts": alert.get("triggered_at"),
        "alert": alert_public(alert, price_at),
    }
    broadcast(payload)


# ---------------------------------------------------------------------------
# WS klientlari
# ---------------------------------------------------------------------------
class WSClient:
    __slots__ = ("id", "websocket", "symbol", "broker", "tf", "tf_value",
                 "period", "digits", "queue", "state", "closed")

    def __init__(self, websocket: WebSocket, symbol: str, broker: str, tf: str,
                 tf_value: int, period: int, digits: int) -> None:
        self.id = uuid.uuid4().hex[:8]
        self.websocket = websocket
        self.symbol = symbol
        self.broker = broker
        self.tf = tf
        self.tf_value = tf_value
        self.period = period
        self.digits = digits
        self.queue: asyncio.Queue = asyncio.Queue(maxsize=2000)
        self.state = BarState(symbol, broker, tf, tf_value, period, digits)
        self.closed = False


CLIENTS: set[WSClient] = set()


def broadcast(payload: dict) -> int:
    sent = 0
    for client in list(CLIENTS):
        if client.closed:
            continue
        try:
            client.queue.put_nowait(payload)
            sent += 1
        except asyncio.QueueFull:
            logger.warning("WS queue to'la, xabar tashlandi (id=%s)", client.id)
        except Exception:
            logger.exception("broadcast xatosi (id=%s)", client.id)
    return sent


# ---------------------------------------------------------------------------
# Joriy (shakllanayotgan) bar holati
# ---------------------------------------------------------------------------
class BarState:
    def __init__(self, symbol: str, broker: str, tf: str, tf_value: int,
                 period: int, digits: int) -> None:
        self.symbol = symbol
        self.broker = broker
        self.tf = tf
        self.tf_value = tf_value
        self.period = period
        self.digits = digits
        self.bar: Optional[list] = None
        self.pending_new_bar = False
        self.last_tick_time = 0

    @staticmethod
    def _bucket(ts: int, period: int) -> int:
        ts = int(ts)
        return ts - ts % period

    async def load(self, count: int) -> list:
        bars = await bars_for(self.broker, self.tf_value, count, self.digits)
        if not bars:
            return []
        self.bar = list(bars[-1])
        return bars

    async def refresh(self, count: int = 3) -> bool:
        """Oxirgi barlarni MT5'dan qayta o'qib tuzatadi. True -> yangi bar boshlangan."""
        bars = await bars_for(self.broker, self.tf_value, count, self.digits)
        if not bars:
            return False
        last = bars[-1]
        if self.bar is None:
            self.bar = list(last)
            self.pending_new_bar = True
            return True
        if last[0] > self.bar[0]:
            self.bar = list(last)
            self.pending_new_bar = True
            return True
        if last[0] == self.bar[0]:
            bar = self.bar
            bar[1] = last[1]
            bar[2] = max(bar[2], last[2])
            bar[3] = min(bar[3], last[3])
            bar[4] = last[4]
            bar[5] = last[5]
        return False

    def tick(self, price: float, tick_time: int) -> bool:
        """Tick'ni joriy barga qo'shadi. True -> yangi bar boshlandi."""
        price = round(float(price), self.digits)
        tick_time = int(tick_time or 0)
        new_bar = False
        if self.bar is None:
            ts = self._bucket(tick_time, self.period) if tick_time else self._bucket(int(time.time()), self.period)
            self.bar = [ts, price, price, price, price, 1]
            new_bar = True
        elif tick_time and tick_time >= self.bar[0] + self.period:
            ts = self.bar[0] + self.period
            if tick_time >= ts + self.period:
                ts = self._bucket(tick_time, self.period)
            self.bar = [ts, price, price, price, price, 1]
            new_bar = True
        else:
            bar = self.bar
            if price > bar[2]:
                bar[2] = price
            if price < bar[3]:
                bar[3] = price
            bar[4] = price
            if tick_time > self.last_tick_time:
                bar[5] = int(bar[5]) + 1
        self.last_tick_time = tick_time
        if new_bar:
            self.pending_new_bar = True
        return new_bar

    def overlay(self, price: float) -> None:
        """MT5 refresh'dan keyin joriy tick narxini barga qayta singdirish."""
        if self.bar is None:
            return
        price = round(float(price), self.digits)
        bar = self.bar
        if price > bar[2]:
            bar[2] = price
        if price < bar[3]:
            bar[3] = price
        bar[4] = price

    def consume_new_bar(self) -> bool:
        if self.pending_new_bar:
            self.pending_new_bar = False
            return True
        return False


# ---------------------------------------------------------------------------
# Alert baholash (price / zone / sweep / session)
# ---------------------------------------------------------------------------
async def eval_price(alert: dict, now: float) -> None:
    tick = TICKS.get(alert["symbol"])
    if tick is None:
        return
    price = float(tick["price"])
    target = float(alert["price"])
    hit = (alert["dir"] == "above" and price >= target) or (
        alert["dir"] == "below" and price <= target
    )
    if not hit:
        return
    digits = _alert_digits(alert["symbol"])
    direction = "yuqoriga" if alert["dir"] == "above" else "pastga"
    message = f"{alert['symbol']} {round(target, digits)} dan {direction} o'tdi: {round(price, digits)}"
    await fire_alert(alert, message, round(price, digits))


async def eval_zone(alert: dict, now: float) -> None:
    tick = TICKS.get(alert["symbol"])
    if tick is None:
        return
    price = float(tick["price"])
    lo = float(alert["lo"])
    hi = float(alert["hi"])
    digits = _alert_digits(alert["symbol"])
    state = alert.setdefault("state", {})
    inside = lo <= price <= hi
    if inside and not state.get("inside"):
        state["inside"] = True
        label = alert.get("label") or f"{alert.get('tf', 'M15')} zona"
        message = f"{alert['symbol']} {label} zonasiga kirdi ({lo}-{hi}): {round(price, digits)}"
        await fire_alert(alert, message, round(price, digits))
        return
    if not inside:
        was_inside = bool(state.get("inside"))
        state["inside"] = False
        if was_inside and alert.get("repeat") and alert.get("status") == "triggered":
            alert["status"] = "armed"
            alert["active"] = True
            await save_alerts()
            logger.info("Zone alert qayta qurolandi: id=%s", alert.get("id"))


async def eval_sweep(alert: dict, now: float) -> None:
    symbol = alert["symbol"]
    digits = _alert_digits(symbol)
    day_str = alert.get("after_date") or today_utc5()
    state = alert.setdefault("state", {})
    sides = state.get("sides") if isinstance(state.get("sides"), dict) else None
    if state.get("day") != day_str or not sides:
        state.clear()
        state.update({
            "day": day_str,
            "sides": {"bsl": {"done": False}, "ssl": {"done": False}},
            "last_bar_ts": 0,
            "range": None,
        })
        alert["status"] = "armed"
        alert["active"] = True
        await save_alerts()
    sides = state["sides"]
    if sides["bsl"]["done"] and sides["ssl"]["done"]:
        return
    rng = await get_asia_range(symbol, day_str)
    if rng is None:
        return
    state["range"] = {"high": rng["high"], "low": rng["low"], "day": day_str, "bars": rng.get("bars")}
    now_ts = int(now)
    current_bar_ts = now_ts // 60 * 60
    last_bar_ts = int(state.get("last_bar_ts") or 0)
    if last_bar_ts <= 0:
        state["last_bar_ts"] = current_bar_ts - 60
        last_bar_ts = state["last_bar_ts"]
    need = int(min(500, max(3, (current_bar_ts - last_bar_ts) // 60 + 2)))
    bars = await bars_for(SYMBOLS[symbol], mt5.TIMEFRAME_M1, need, digits)
    if not bars:
        return
    closed = [bar for bar in bars if bar[0] + 60 <= now_ts and bar[0] > last_bar_ts]
    if not closed:
        return
    events = detect_sweeps(closed, float(rng["high"]), float(rng["low"]), digits)
    state["last_bar_ts"] = max(int(bar[0]) for bar in closed)
    await save_alerts()
    for event in events:
        side = event["side"]
        if sides[side]["done"]:
            continue
        sides[side]["done"] = True
        side_name = "HIGH" if side == "bsl" else "LOW"
        message = f"{symbol} Asia {side_name} sweep: {event['wick']} dan qaytdi"
        await fire_alert(alert, message, round(float(event["close"]), digits))
        break


async def eval_session(alert: dict, now: float) -> None:
    state = alert.setdefault("state", {})
    if not state.get("target_ts"):
        state["target_ts"] = session_target_ts(str(alert.get("which")), now=now)
        await save_alerts()
    target = int(state["target_ts"])
    if now < target:
        return
    which = str(alert.get("which"))
    label = SESSION_LABELS.get(which, which)
    hour, minute = SESSION_KILLZONE_UTC5[which]
    message = f"{alert['symbol']}: {label} killzone ochildi ({hour:02d}:{minute:02d} UTC+5)"
    await fire_alert(alert, message, _current_price(alert["symbol"]))


async def check_alerts() -> None:
    now = time.time()
    for alert in list(ALERTS):
        alert_type = alert.get("type", "price")
        try:
            if alert_type == "sweep":
                await eval_sweep(alert, now)
            elif alert_type == "zone":
                if alert.get("status") == "armed" or alert.get("repeat"):
                    await eval_zone(alert, now)
            elif alert_type == "session":
                if alert.get("status") == "armed":
                    await eval_session(alert, now)
            else:
                if alert.get("status") == "armed":
                    await eval_price(alert, now)
        except Exception:
            logger.exception("alert baholash xatosi id=%s type=%s", alert.get("id"), alert_type)


async def alert_loop() -> None:
    while not manager._stop:
        try:
            await check_alerts()
        except Exception:
            logger.exception("alert tekshirish xatosi")
        await asyncio.sleep(ALERT_CHECK_INTERVAL)


# ---------------------------------------------------------------------------
# WS endpoint yordamchilari
# ---------------------------------------------------------------------------
def tick_message(client: WSClient, tick: dict) -> dict:
    digits = client.digits
    bar = client.state.bar
    return {
        "type": "tick",
        "symbol": client.symbol,
        "tf": client.tf,
        "bid": round(float(tick["bid"]), digits),
        "ask": round(float(tick["ask"]), digits),
        "price": round(float(tick["price"]), digits),
        "time": int(tick["time"]),
        "bar": list(bar) if bar else [],
        "new_bar": client.state.consume_new_bar(),
    }


async def ws_sender(client: WSClient) -> None:
    try:
        while True:
            payload = await client.queue.get()
            await client.websocket.send_json(payload)
    except asyncio.CancelledError:
        raise
    except Exception:
        client.closed = True
        logger.info("WS yuborish to'xtadi (id=%s)", client.id)


async def ws_reader(client: WSClient) -> None:
    try:
        while True:
            message = await client.websocket.receive()
            if message.get("type") == "websocket.disconnect":
                return
            text = message.get("text")
            if not text:
                continue
            try:
                data = json.loads(text)
            except (TypeError, ValueError):
                continue
            if isinstance(data, dict) and data.get("type") == "ping":
                try:
                    client.queue.put_nowait({"type": "pong", "time": int(time.time())})
                except asyncio.QueueFull:
                    pass
    except WebSocketDisconnect:
        return
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.debug("WS reader xatosi (id=%s)", client.id, exc_info=True)


def _log_task_error(task: asyncio.Task) -> None:
    if task.cancelled():
        return
    error = task.exception()
    if error is not None:
        logger.warning("Fon vazifa xatosi: %r", error)


async def ws_tick_loop(client: WSClient) -> None:
    state = client.state
    bars = await state.load(SNAPSHOT_BARS)
    if not bars:
        logger.warning("Snapshot uchun bar yo'q (id=%s symbol=%s tf=%s)", client.id, client.symbol, client.tf)
    await client.queue.put({
        "type": "snapshot",
        "symbol": client.symbol,
        "tf": client.tf,
        "digits": client.digits,
        "bars": bars,
    })
    loop = asyncio.get_running_loop()
    next_at = loop.time()
    last_refresh = time.monotonic()
    last_no_tick_log = 0.0
    refresh_task: Optional[asyncio.Task] = None
    try:
        while not client.closed:
            next_at += TICK_INTERVAL
            now = loop.time()
            delay = next_at - now
            if delay > 0:
                await asyncio.sleep(delay)
            elif delay < -TICK_INTERVAL:
                next_at = now
            tick = TICKS.get(client.symbol)
            if tick is None:
                if time.monotonic() - last_no_tick_log > 10.0:
                    logger.warning("Tick ma'lumoti yo'q: %s", client.symbol)
                    last_no_tick_log = time.monotonic()
                continue
            price = float(tick["price"])
            state.tick(price, tick["time"])
            mono = time.monotonic()
            if (mono - last_refresh >= BAR_REFRESH_INTERVAL) and (refresh_task is None or refresh_task.done()):
                last_refresh = mono
                refresh_task = asyncio.create_task(state.refresh(3))
                refresh_task.add_done_callback(_log_task_error)
            await client.queue.put(tick_message(client, tick))
    finally:
        if refresh_task is not None and not refresh_task.done():
            refresh_task.cancel()
            await asyncio.gather(refresh_task, return_exceptions=True)


async def ws_reject(websocket: WebSocket, reason: str) -> None:
    try:
        await websocket.send_json({"type": "error", "error": reason})
        await websocket.close(code=1008)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    set_timer_resolution(True)
    load_alerts()
    logger.info("Feed server ishga tushmoqda (versiya %s, port %s)", VERSION, PORT)

    connected = False
    for attempt in range(1, 4):
        connected = await manager.connect()
        if connected:
            break
        logger.warning("MT5 ulanish urinishi %d/3 muvaffaqiyatsiz", attempt)
        await asyncio.sleep(1.0)
    if not connected:
        logger.error("MT5 hozircha ulanmadi - fonda qayta urinish davom etadi")

    tasks = [
        asyncio.create_task(manager.loop(), name="mt5-loop"),
        asyncio.create_task(manager.watchdog(), name="mt5-watchdog"),
        asyncio.create_task(manager.poll_ticks(), name="mt5-ticks"),
        asyncio.create_task(alert_loop(), name="alert-loop"),
    ]

    local_ip = lan_ip()
    logger.info("Mahalliy: http://127.0.0.1:%s", PORT)
    logger.info("LAN:      http://%s:%s", local_ip, PORT)
    for extra_ip in lan_ips()[1:]:
        logger.info("Boshqa interfeys: http://%s:%s", extra_ip, PORT)
    logger.info("WS:       ws://%s:%s/ws?symbol=XAUUSD&tf=M1", local_ip, PORT)
    print(
        "\n  XAUUSD/GBPUSD feed server tayyor"
        f"\n    http://127.0.0.1:{PORT}"
        f"\n    http://{local_ip}:{PORT}"
        f"\n    ws://{local_ip}:{PORT}/ws?symbol=XAUUSD&tf=M1"
        f"\n    mobile/: {MOBILE_DIR} ({'bor' if MOBILE_DIR.is_dir() else 'yoq'})\n",
        flush=True,
    )
    try:
        yield
    finally:
        manager._stop = True
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        for client in list(CLIENTS):
            client.closed = True
        logger.info("Feed server to'xtamoqda")
        try:
            await asyncio.wait_for(mt5_async(manager._shutdown_sync), timeout=10.0)
        except Exception:
            logger.warning("mt5.shutdown bajarilmadi")
        _MT5_EXECUTOR.shutdown(wait=False, cancel_futures=True)
        set_timer_resolution(False)


# ---------------------------------------------------------------------------
# FastAPI ilovasi
# ---------------------------------------------------------------------------
app = FastAPI(title="XAUUSD/GBPUSD live feed", version=VERSION, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AlertCreate(BaseModel):
    symbol: str
    type: str = "price"
    # price alert
    dir: Optional[str] = None
    price: Optional[float] = None
    # zone alert
    tf: Optional[str] = None
    lo: Optional[float] = None
    hi: Optional[float] = None
    label: Optional[str] = None
    repeat: bool = False
    on_cross: bool = False   # true -> faqat tashqaridan ICHKARIGA kirganda trigger
    # sweep alert
    after_date: Optional[str] = None
    # session alert
    which: Optional[str] = None
    note: str = ""

    @field_validator("symbol")
    @classmethod
    def _normalize_symbol(cls, value: str) -> str:
        return str(value or "").strip().upper()

    @field_validator("type")
    @classmethod
    def _normalize_type(cls, value: str) -> str:
        normalized = str(value or "price").strip().lower()
        if normalized not in ALERT_TYPES:
            raise ValueError(f"type {ALERT_TYPES} dan biri bo'lishi kerak")
        return normalized

    @field_validator("repeat", mode="before")
    @classmethod
    def _normalize_repeat(cls, value):
        if value is None:
            return False
        if isinstance(value, str):
            return value.strip().lower() in ("1", "true", "yes", "ha", "on")
        return bool(value)

    @field_validator("on_cross", mode="before")
    @classmethod
    def _normalize_on_cross(cls, value):
        if value is None:
            return False
        if isinstance(value, str):
            return value.strip().lower() in ("1", "true", "yes", "ha", "on")
        return bool(value)


def _build_alert(payload: AlertCreate) -> dict:
    """POST /api/alerts tanasini tekshiradi va saqlanadigan alert yozuvini yasaydi."""
    if payload.symbol not in SYMBOLS:
        raise HTTPException(status_code=400, detail=f"Noma'lum symbol: {payload.symbol}. Ruxsat: {list(SYMBOLS)}")
    digits = _alert_digits(payload.symbol)
    now = int(time.time())
    alert: dict = {
        "id": uuid.uuid4().hex[:8],
        "type": payload.type,
        "symbol": payload.symbol,
        "status": "armed",
        "active": True,
        "created": now,
        "triggered_at": None,
        "triggered": None,
        "price_at": None,
        "message": None,
        "trigger_count": 0,
        "note": payload.note or "",
    }
    if payload.type == "price":
        direction = str(payload.dir or "").strip().lower()
        if direction not in ("above", "below"):
            raise HTTPException(status_code=400, detail="price alert uchun dir 'above' yoki 'below' bo'lishi kerak")
        if payload.price is None:
            raise HTTPException(status_code=400, detail="price alert uchun price majburiy")
        target = float(payload.price)
        if target != target or target <= 0:
            raise HTTPException(status_code=400, detail="price musbat son bo'lishi kerak")
        alert.update({"dir": direction, "price": round(target, digits)})
    elif payload.type == "zone":
        if payload.lo is None or payload.hi is None:
            raise HTTPException(status_code=400, detail="zone alert uchun lo va hi majburiy")
        lo = float(payload.lo)
        hi = float(payload.hi)
        if lo != lo or hi != hi or lo <= 0 or hi <= 0:
            raise HTTPException(status_code=400, detail="lo/hi musbat sonlar bo'lishi kerak")
        if lo >= hi:
            raise HTTPException(status_code=400, detail="lo < hi bo'lishi kerak")
        tf = str(payload.tf or "M15").strip().upper()
        if tf not in TF_VALUES:
            raise HTTPException(status_code=400, detail=f"Noma'lum tf: {payload.tf}. Ruxsat: {list(TF_VALUES)}")
        on_cross = bool(payload.on_cross)
        zone_state: dict = {}
        if on_cross:
            # Agar narx allaqachon zona ichida bo'lsa, darhol trigger bo'lmasin:
            # avval zonadan chiqishi, keyin qayta kirishi kerak.
            price_now = _current_price(payload.symbol)
            zone_state["inside"] = bool(price_now is not None and lo <= price_now <= hi)
        alert.update({
            "tf": tf,
            "lo": round(lo, digits),
            "hi": round(hi, digits),
            "label": str(payload.label or ""),
            "repeat": bool(payload.repeat),
            "on_cross": on_cross,
            "state": zone_state,
        })
    elif payload.type == "sweep":
        after = payload.after_date
        if after:
            try:
                parsed = date.fromisoformat(str(after).strip())
            except ValueError:
                raise HTTPException(status_code=400, detail="after_date YYYY-MM-DD formatida bo'lishi kerak")
            if parsed > datetime.now(TZ_UTC5).date():
                raise HTTPException(status_code=400, detail="after_date kelajakda bo'lishi mumkin emas")
            after = parsed.isoformat()
        alert.update({"after_date": after or None, "state": {}})
    elif payload.type == "session":
        which = str(payload.which or "").strip().lower()
        if which not in SESSION_KILLZONE_UTC5:
            raise HTTPException(status_code=400, detail="session alert uchun which 'london' yoki 'ny' bo'lishi kerak")
        alert.update({"which": which, "state": {"target_ts": session_target_ts(which)}})
    return alert


# -- REST -------------------------------------------------------------------
@app.get("/api/health")
async def api_health() -> dict:
    return {
        "ok": True,
        "mt5": bool(manager.connected),
        "symbols": list(SYMBOLS.keys()),
        "time": int(time.time()),
        "digits": {
            symbol: manager.digits.get(symbol) or DEFAULT_DIGITS.get(symbol, 5)
            for symbol in SYMBOLS
        },
        "version": VERSION,
    }


@app.get("/api/candles")
async def api_candles(symbol: str = DEFAULT_SYMBOL, tf: str = DEFAULT_TF, count: int = 500) -> dict:
    sym = str(symbol or "").strip().upper()
    timeframe = str(tf or "").strip().upper()
    if sym not in SYMBOLS:
        raise HTTPException(status_code=400, detail=f"Noma'lum symbol: {symbol}. Ruxsat: {list(SYMBOLS)}")
    if timeframe not in TF_VALUES:
        raise HTTPException(status_code=400, detail=f"Noma'lum tf: {tf}. Ruxsat: {list(TF_VALUES)}")
    try:
        bars_count = int(count)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="count butun son bo'lishi kerak")
    if not 1 <= bars_count <= MAX_CANDLES:
        raise HTTPException(status_code=400, detail=f"count 1..{MAX_CANDLES} oralig'ida bo'lishi kerak")

    digits = _alert_digits(sym)
    bars = await bars_for(SYMBOLS[sym], TF_VALUES[timeframe], bars_count, digits)
    if bars is None or not bars:
        raise HTTPException(status_code=503, detail="MT5 ma'lumot bermadi (terminal ulanganmi?)")
    return {"symbol": sym, "tf": timeframe, "bars": bars}


@app.get("/api/alerts")
async def api_alerts() -> dict:
    prices = {symbol: _current_price(symbol) for symbol in SYMBOLS}
    return {"alerts": [alert_public(alert, prices.get(alert["symbol"])) for alert in ALERTS]}


@app.post("/api/alerts")
async def api_create_alert(payload: AlertCreate) -> dict:
    alert = _build_alert(payload)
    try:
        await asyncio.wait_for(prepare_alert(alert), timeout=10.0)
    except asyncio.TimeoutError:
        logger.warning("Alert tayyorlash timeout (id=%s): range keyinroq to'ladi", alert["id"])
    ALERTS.append(alert)
    await save_alerts()
    logger.info(
        "Alert qo'shildi [%s]: %s id=%s",
        alert["type"], _alert_summary(alert), alert["id"],
    )
    return {"alert": alert_public(alert, _current_price(alert["symbol"]))}


@app.delete("/api/alerts")
async def api_delete_all_alerts() -> dict:
    count = len(ALERTS)
    ALERTS.clear()
    await save_alerts()
    logger.info("Barcha alertlar o'chirildi: %d ta", count)
    return {"deleted": True, "count": count}


@app.delete("/api/alerts/{alert_id}")
async def api_delete_alert(alert_id: str) -> dict:
    for index, alert in enumerate(ALERTS):
        if alert["id"] == alert_id:
            ALERTS.pop(index)
            await save_alerts()
            logger.info("Alert o'chirildi: id=%s", alert_id)
            return {"deleted": True}
    raise HTTPException(status_code=404, detail=f"Alert topilmadi: {alert_id}")


# -- statik hosting ---------------------------------------------------------
@app.get("/")
async def index_page():
    index_file = MOBILE_DIR / "index.html"
    if index_file.is_file():
        return FileResponse(str(index_file), media_type="text/html")
    return PlainTextResponse(
        "XAUUSD/GBPUSD feed server ishlayapti.\n"
        "REST: /api/health, /api/candles?symbol=XAUUSD&tf=M1&count=500, /api/alerts\n"
        f"WS:   ws://<host>:{PORT}/ws?symbol=XAUUSD&tf=M1\n"
        "mobile/index.html topilmadi."
    )


# -- WebSocket --------------------------------------------------------------
@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    symbol = str(websocket.query_params.get("symbol") or DEFAULT_SYMBOL).strip().upper()
    tf = str(websocket.query_params.get("tf") or DEFAULT_TF).strip().upper()
    if symbol not in SYMBOLS:
        await ws_reject(websocket, f"Noma'lum symbol: {symbol}. Ruxsat: {list(SYMBOLS)}")
        return
    if tf not in TF_VALUES:
        await ws_reject(websocket, f"Noma'lum tf: {tf}. Ruxsat: {list(TF_VALUES)}")
        return
    if len(CLIENTS) >= MAX_WS_CLIENTS:
        await ws_reject(websocket, "Server band: ulanishlar soni chegarasiga yetdi")
        return

    digits = _alert_digits(symbol)
    client = WSClient(
        websocket=websocket,
        symbol=symbol,
        broker=SYMBOLS[symbol],
        tf=tf,
        tf_value=TF_VALUES[tf],
        period=TF_SECONDS[tf],
        digits=digits,
    )
    CLIENTS.add(client)
    logger.info(
        "WS ulandi id=%s symbol=%s tf=%s (klientlar=%d)",
        client.id, symbol, tf, len(CLIENTS),
    )
    sender_task = asyncio.create_task(ws_sender(client))
    tick_task = asyncio.create_task(ws_tick_loop(client))
    reader_task = asyncio.create_task(ws_reader(client))
    try:
        done, pending = await asyncio.wait(
            {tick_task, reader_task}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in done:
            if task.cancelled():
                continue
            error = task.exception()
            if error is not None:
                logger.error("WS vazifa xatosi (id=%s): %r", client.id, error)
        for task in pending:
            task.cancel()
        await asyncio.gather(*pending, return_exceptions=True)
    except Exception:
        logger.exception("WS endpoint xatosi (id=%s)", client.id)
    finally:
        client.closed = True
        CLIENTS.discard(client)
        for task in (sender_task, tick_task, reader_task):
            if not task.done():
                task.cancel()
        await asyncio.gather(sender_task, tick_task, reader_task, return_exceptions=True)
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info(
            "WS yopildi id=%s symbol=%s tf=%s (klientlar=%d)",
            client.id, symbol, tf, len(CLIENTS),
        )


# Statik hosting: mos kelmagan yo'llar (/ws, /api oldin ro'yxatga olingan)
app.mount("/", StaticFiles(directory=str(MOBILE_DIR), html=True, check_dir=False), name="mobile")


# ---------------------------------------------------------------------------
# Kirish nuqtasi
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host=HOST, port=PORT, log_level="info")

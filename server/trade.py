#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""XAUView MT5 savdo yadrosi (server/trade.py).

Bu modul app.py'ga /api/trade/* endpointlarini qo'shadi: akkaunt, pozitsiyalar,
pending orderlar, market/limit/stop/stop-limit orderlar, yopish (qismli ham),
SL/TP o'zgartirish, bekor qilish, hammasini yopish va tarix.

Uch rejim (env):
  * "disabled" - XAUVIEW_TRADE=0  -> barcha /api/trade/* 503 trade_disabled,
                  faqat /api/trade/state 200 + mode="disabled".
  * "mock"     - XAUVIEW_TRADE_MOCK=1 -> to'liq paper-trading simulyatori
                  (MT5 kerak emas, Linux/Render'da ham ishlaydi).
  * "live"     - lokal Windows MT5 terminal orqali haqiqiy savdo.
                  MT5 bo'lmasa/ulanmasa: mode="live", why="mt5_unavailable",
                  account=null, bo'sh ro'yxatlar; savdo endpointlari 503.

Xavfsizlik:
  * Parol faqat xotirada, mt5.login()ga uzatiladi - faylga yozilmaydi va logga
    tushmaydi.
  * XAUVIEW_TRADE_TOKEN berilgan bo'lsa barcha mutatsiya endpointlari
    (login/logout/order/close/modify/cancel/flat) X-Trade-Token headerini talab
    qiladi, aks holda 401.
  * flat faqat confirm:true bilan ishlaydi.

app.py tomondan dependency injection (configure()) ishlatiladi, shuning uchun bu
modul MetaTrader5'ni o'zi import qilmaydi va Linux'da ham xavfsiz yuklanadi.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta
from typing import Any, Callable, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("feed.trade")

# ---------------------------------------------------------------------------
# Rejim va env
# ---------------------------------------------------------------------------
MODE_DISABLED = "disabled"
MODE_MOCK = "mock"
MODE_LIVE = "live"

WHY_TRADE_DISABLED = "trade_disabled"
WHY_MT5_UNAVAILABLE = "mt5_unavailable"

_VALID_SIDES = ("buy", "sell")
_VALID_TYPES = ("market", "limit", "stop", "stop_limit")
_ORDER_TYPES = (
    "buy_limit", "sell_limit", "buy_stop", "sell_stop",
    "buy_stop_limit", "sell_stop_limit",
)


def trade_enabled() -> bool:
    """XAUVIEW_TRADE=0 (yoki false/off) -> savdo butunlay o'chirilgan."""
    raw = (os.getenv("XAUVIEW_TRADE", "1") or "1").strip().lower()
    return raw not in ("0", "false", "no", "off", "disabled", "")


def mock_enabled() -> bool:
    """XAUVIEW_TRADE_MOCK=1 -> paper-trading simulyatori (MT5 kerak emas)."""
    raw = (os.getenv("XAUVIEW_TRADE_MOCK", "") or "").strip().lower()
    return raw in ("1", "true", "yes", "on", "ha")


def trade_token() -> str:
    return (os.getenv("XAUVIEW_TRADE_TOKEN", "") or "").strip()


def current_mode() -> str:
    if not trade_enabled():
        return MODE_DISABLED
    if mock_enabled():
        return MODE_MOCK
    return MODE_LIVE


def live_ready() -> bool:
    """Live savdo ishlashi uchun MT5 moduli + ulanish ikkalasi ham kerak."""
    try:
        return _MT5 is not None and bool(_IS_CONNECTED())
    except Exception:
        return False


def current_why() -> Optional[str]:
    mode = current_mode()
    if mode == MODE_DISABLED:
        return WHY_TRADE_DISABLED
    if mode == MODE_MOCK:
        return None
    return None if live_ready() else WHY_MT5_UNAVAILABLE


# ---------------------------------------------------------------------------
# app.py bilan bog'lanish (dependency injection)
# ---------------------------------------------------------------------------
_UNSET = object()

_MT5: Any = None
_MT5_WAIT: Optional[Callable[..., Any]] = None
_SYMBOLS: dict[str, str] = {"XAUUSD": "XAUUSD", "GBPUSD": "GBPUSD"}
_DEFAULT_DIGITS: dict[str, int] = {"XAUUSD": 3, "GBPUSD": 5}
_IS_CONNECTED: Callable[[], bool] = lambda: False
_SET_CONNECTED: Optional[Callable[[bool], Any]] = None
_RECONNECT: Optional[Callable[[], Any]] = None
_PRICE_PROVIDER: Optional[Callable[[str], Optional[dict]]] = None


def configure(*, mt5=_UNSET, mt5_wait=_UNSET, symbols=_UNSET, default_digits=_UNSET,
              connected=_UNSET, set_connected=_UNSET, reconnect=_UNSET,
              price_provider=_UNSET) -> None:
    """app.py'dan haqiqiy MT5 moduli va feed helperlarini uzatadi.

    Bu modul MetaTrader5'ni import qilmaydi: Linux/Render'da mt5=None bo'ladi va
    faqat mock/disabled rejimlar ishlaydi (aynan kerak bo'lgani).
    """
    global _MT5, _MT5_WAIT, _SYMBOLS, _DEFAULT_DIGITS
    global _IS_CONNECTED, _SET_CONNECTED, _RECONNECT, _PRICE_PROVIDER
    if mt5 is not _UNSET:
        _MT5 = mt5
    if mt5_wait is not _UNSET:
        _MT5_WAIT = mt5_wait
    if symbols is not _UNSET and isinstance(symbols, dict):
        # MUHIM: nusxa EMAS, havola - app.py connect() paytida broker symbol
        # nomlarini avto-aniqlab SYMBOLS ni joyida o'zgartiradi (XAUUSDm -> XAUUSD).
        _SYMBOLS = symbols
    if default_digits is not _UNSET and isinstance(default_digits, dict):
        _DEFAULT_DIGITS = dict(default_digits)
    if connected is not _UNSET:
        _IS_CONNECTED = connected
    if set_connected is not _UNSET:
        _SET_CONNECTED = set_connected
    if reconnect is not _UNSET:
        _RECONNECT = reconnect
    if price_provider is not _UNSET:
        _PRICE_PROVIDER = price_provider


def set_price_provider(fn: Optional[Callable[[str], Optional[dict]]]) -> None:
    """Mock narx manbasi (odatda app.current_tick). Testlar ham ishlatadi."""
    global _PRICE_PROVIDER
    _PRICE_PROVIDER = fn


def _const(name: str, fallback: int) -> int:
    """MT5 konstantasi; modul yo'q bo'lsa real MT5 qiymati (fallback)."""
    if _MT5 is None:
        return int(fallback)
    try:
        value = getattr(_MT5, name, None)
    except Exception:
        value = None
    try:
        return int(value) if value is not None else int(fallback)
    except (TypeError, ValueError):
        return int(fallback)


# retcode qiymatlari (MT5 bilan bir xil; mock ham shularni qaytaradi)
_RET_DONE = 10009
_RET_PLACED = 10008
_RET_INVALID = 10013
_RET_INVALID_VOLUME = 10014
_RET_INVALID_PRICE = 10015
_RET_INVALID_STOPS = 10016
_RET_TRADE_DISABLED = 10017
_RET_MARKET_CLOSED = 10018
_RET_NO_MONEY = 10019
_RET_INVALID_CLOSE_VOLUME = 10038

_ORDER_STATE_NAMES = {
    0: "started", 1: "placed", 2: "canceled", 3: "partial",
    4: "filled", 5: "rejected", 6: "expired", 7: "request_add",
    8: "request_modify", 9: "request_cancel",
}
_TRADE_MODE_NAMES = {
    0: "disabled", 1: "longonly", 2: "shortonly", 3: "closeonly", 4: "full",
}

# ---------------------------------------------------------------------------
# Mock bozor spetsifikatsiyasi (MT5 yo'q bo'lganda ishlatiladi)
# ---------------------------------------------------------------------------
# spread - narx birligida (XAUUSD 0.2$, GBPUSD 0.00015); state.symbols.spread esa
# MT5 kabi pointlarda (0.2 / 0.001 = 200 point).
MARKET_SPECS: dict[str, dict] = {
    "XAUUSD": {
        "digits": 3, "point": 0.001, "min_lot": 0.01, "max_lot": 100.0,
        "lot_step": 0.01, "contract": 100.0, "spread": 0.2,
        "stops_level": 0, "freeze_level": 0, "base_price": 3850.0,
    },
    "GBPUSD": {
        "digits": 5, "point": 0.00001, "min_lot": 0.01, "max_lot": 100.0,
        "lot_step": 0.01, "contract": 100000.0, "spread": 0.00015,
        "stops_level": 0, "freeze_level": 0, "base_price": 1.2650,
    },
}


def _r2(value: Any) -> float:
    try:
        return round(float(value), 2)
    except (TypeError, ValueError):
        return 0.0


def _spec(logical: str) -> dict:
    spec = MARKET_SPECS.get(logical)
    if spec:
        return spec
    digits = int(_DEFAULT_DIGITS.get(logical, 5) or 5)
    return {
        "digits": digits, "point": 10.0 ** (-digits), "min_lot": 0.01,
        "max_lot": 100.0, "lot_step": 0.01, "contract": 100000.0,
        "spread": 0.0, "stops_level": 0, "freeze_level": 0, "base_price": 1.0,
    }


def resolve_symbol(value: Any) -> Optional[str]:
    """Logik symbol ("XAUUSD") yoki broker symbol ("XAUUSDm") -> logik symbol."""
    raw = str(value or "").strip()
    if not raw:
        return None
    upper = raw.upper()
    if upper in _SYMBOLS:
        return upper
    for logical, broker in _SYMBOLS.items():
        if upper == str(broker).upper():
            return logical
    if upper in MARKET_SPECS:
        return upper
    return None


def _broker_symbol(logical: str) -> str:
    return str(_SYMBOLS.get(logical) or logical)


def _price_from_provider(symbol: str) -> Optional[float]:
    if _PRICE_PROVIDER is None:
        return None
    try:
        tick = _PRICE_PROVIDER(symbol)
    except Exception:
        logger.debug("price provider xatosi (%s)", symbol, exc_info=True)
        return None
    if not isinstance(tick, dict):
        return None
    for key in ("price", "last", "bid", "ask"):
        try:
            value = float(tick.get(key) or 0.0)
        except (TypeError, ValueError):
            value = 0.0
        if value > 0:
            return value
    return None


def _mock_quote(symbol: str) -> dict:
    """Mock bid/ask: jonli feed narxi (yoki base) atrofida qat'iy spread."""
    spec = _spec(symbol)
    mid = _price_from_provider(symbol) or float(spec["base_price"])
    half = float(spec["spread"]) / 2.0
    digits = int(spec["digits"])
    return {"bid": round(mid - half, digits), "ask": round(mid + half, digits)}


def _normalize_volume(symbol: str, volume: Any) -> tuple[Optional[float], Optional[str]]:
    """Hajmni min/max/step bo'yicha tekshiradi va qadamga yaxlitlaydi."""
    spec = _spec(symbol)
    try:
        value = float(volume)
    except (TypeError, ValueError):
        return None, "Invalid volume"
    if not (value > 0) or value != value:  # 0 yoki NaN
        return None, "Invalid volume"
    step = float(spec["lot_step"] or 0.01)
    min_lot = float(spec["min_lot"] or 0.01)
    max_lot = float(spec["max_lot"] or 100.0)
    if step > 0:
        ratio = value / step
        if abs(ratio - round(ratio)) > 1e-6:
            return None, "Invalid volume: step %s" % ("%g" % step)
        value = round(round(ratio) * step, 8)
    if value < min_lot - 1e-9:
        return None, "Invalid volume: min %.2f" % min_lot
    if value > max_lot + 1e-9:
        return None, "Invalid volume: max %.2f" % max_lot
    return round(value, 4), None


def _stops_error(symbol: str, side: str, ref_price: float, sl: float, tp: float) -> Optional[str]:
    """SL/TP tekshiruvi (mock): yo'nalish + stops_level masofasi."""
    spec = _spec(symbol)
    digits = int(spec["digits"])
    point = float(spec["point"])
    stops_points = int(spec.get("stops_level") or 0)
    min_distance = stops_points * point

    def _too_close(value: float) -> bool:
        return min_distance > 0 and abs(ref_price - value) < min_distance - 1e-12

    if sl:
        if side == "buy":
            if sl >= ref_price - 1e-12:
                return "Invalid stops: SL must be below entry price"
        else:
            if sl <= ref_price + 1e-12:
                return "Invalid stops: SL must be above entry price"
        if _too_close(sl):
            return "Invalid stops: SL too close (stops_level=%d)" % stops_points
    if tp:
        if side == "buy":
            if tp <= ref_price + 1e-12:
                return "Invalid stops: TP must be above entry price"
        else:
            if tp >= ref_price - 1e-12:
                return "Invalid stops: TP must be below entry price"
        if _too_close(tp):
            return "Invalid stops: TP too close (stops_level=%d)" % stops_points
    return None


def _profit_for(symbol: str, side: str, price_open: float, price_close: float,
                volume: float) -> float:
    spec = _spec(symbol)
    diff = (price_close - price_open) if side == "buy" else (price_open - price_close)
    return _r2(diff * float(spec["contract"]) * float(volume))


# ---------------------------------------------------------------------------
# Mock (paper) savdo dvigateli
# ---------------------------------------------------------------------------
class _MockEngine:
    """Xotiradagi to'liq savdo simulyatori: balans, pozitsiya, order, deal."""

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.balance: float = 10000.0
        self.leverage: int = 100
        self.currency: str = "USD"
        self.login: int = 474932446
        self.server: str = "Exness-MT5Trial8"
        self.company: str = "Exness Technologies Ltd"
        self.name: str = "XAUView Paper"
        self.positions: dict[int, dict] = {}
        self.orders: dict[int, dict] = {}
        self.deals: list[dict] = []
        self._ticket: int = 100001
        self._deal_ticket: int = 900001
        self.created: int = int(time.time())

    # -- identifikatorlar ---------------------------------------------------
    def next_ticket(self) -> int:
        ticket = self._ticket
        self._ticket += 1
        return ticket

    def _next_deal_ticket(self) -> int:
        ticket = self._deal_ticket
        self._deal_ticket += 1
        return ticket

    # -- hisob-kitob --------------------------------------------------------
    def _quotes(self) -> dict[str, dict]:
        cache: dict[str, dict] = {}

        def quote(symbol: str) -> dict:
            if symbol not in cache:
                cache[symbol] = _mock_quote(symbol)
            return cache[symbol]

        return {"get": quote}

    def position_profit(self, pos: dict, quote: Callable[[str], dict]) -> float:
        q = quote(pos["symbol"])
        price = q["bid"] if pos["type"] == "buy" else q["ask"]
        return _profit_for(pos["symbol"], pos["type"], float(pos["price_open"]), price,
                           float(pos["volume"]))

    def margin(self) -> float:
        total = 0.0
        quotes = self._quotes()
        for pos in self.positions.values():
            q = quotes["get"](pos["symbol"])
            price = q["bid"] if pos["type"] == "buy" else q["ask"]
            total += self._margin_for(pos["symbol"], float(pos["volume"]), float(price))
        return _r2(total)

    def equity(self) -> float:
        quotes = self._quotes()
        profit = sum(self.position_profit(pos, quotes["get"]) for pos in self.positions.values())
        return _r2(self.balance + profit)

    def _margin_for(self, symbol: str, volume: float, price: float) -> float:
        spec = _spec(symbol)
        return _r2(price * float(spec["contract"]) * volume / max(1, self.leverage))

    # -- ommaviy ko'rinish --------------------------------------------------
    def account(self) -> dict:
        quotes = self._quotes()
        profit = sum(self.position_profit(pos, quotes["get"]) for pos in self.positions.values())
        margin = self.margin()
        equity = _r2(self.balance + profit)
        free = _r2(equity - margin)
        level = _r2(equity / margin * 100.0) if margin > 0 else 0.0
        return {
            "login": self.login,
            "server": self.server,
            "company": self.company,
            "name": self.name,
            "currency": self.currency,
            "leverage": self.leverage,
            "balance": _r2(self.balance),
            "equity": equity,
            "margin": margin,
            "free_margin": free,
            "margin_level": level,
            "profit": _r2(profit),
        }

    def positions_public(self) -> list[dict]:
        quotes = self._quotes()
        out: list[dict] = []
        for ticket in sorted(self.positions):
            pos = self.positions[ticket]
            q = quotes["get"](pos["symbol"])
            price = q["bid"] if pos["type"] == "buy" else q["ask"]
            out.append({
                "ticket": int(pos["ticket"]),
                "symbol": pos["symbol"],
                "type": pos["type"],
                "volume": _r2(pos["volume"]),
                "price_open": float(pos["price_open"]),
                "sl": float(pos["sl"]),
                "tp": float(pos["tp"]),
                "price_current": float(price),
                "profit": self.position_profit(pos, quotes["get"]),
                "swap": _r2(pos.get("swap") or 0.0),
                "magic": int(pos.get("magic") or 0),
                "comment": str(pos.get("comment") or ""),
                "time": int(pos.get("time") or 0),
            })
        return out

    def orders_public(self) -> list[dict]:
        out: list[dict] = []
        for ticket in sorted(self.orders):
            order = self.orders[ticket]
            out.append({
                "ticket": int(order["ticket"]),
                "symbol": order["symbol"],
                "type": order["type"],
                "volume": _r2(order["volume"]),
                "price": float(order["price"]),
                "sl": float(order["sl"]),
                "tp": float(order["tp"]),
                "state": str(order.get("state") or "placed"),
                "expiration": int(order.get("expiration") or 0),
                "magic": int(order.get("magic") or 0),
                "comment": str(order.get("comment") or ""),
                "time": int(order.get("time") or 0),
            })
        return out

    # -- deal/pozitsiya yozuvi ---------------------------------------------
    def _record_deal(self, pos: dict, entry: str, volume: float, price: float,
                     profit: float) -> None:
        self.deals.append({
            "ticket": self._next_deal_ticket(),
            "position_id": int(pos["ticket"]),
            "symbol": pos["symbol"],
            "type": pos["type"],
            "entry": entry,
            "volume": _r2(volume),
            "price": float(price),
            "profit": _r2(profit),
            "commission": 0.0,
            "swap": 0.0,
            "time": int(time.time()),
            "comment": str(pos.get("comment") or ""),
            "magic": int(pos.get("magic") or 0),
        })

    def open_position(self, symbol: str, side: str, volume: float, price: float,
                      sl: float, tp: float, magic: int, comment: str) -> int:
        ticket = self.next_ticket()
        pos = {
            "ticket": ticket,
            "symbol": symbol,
            "type": side,
            "volume": volume,
            "price_open": float(price),
            "sl": float(sl),
            "tp": float(tp),
            "price_current": float(price),
            "profit": 0.0,
            "swap": 0.0,
            "magic": int(magic),
            "comment": str(comment),
            "time": int(time.time()),
        }
        self.positions[ticket] = pos
        self._record_deal(pos, "in", volume, price, 0.0)
        return ticket

    # -- pending orderlar: narx kesib o'tganda bajarish ---------------------
    def evaluate(self) -> None:
        if not self.orders:
            return
        for ticket in sorted(self.orders):
            order = self.orders.get(ticket)
            if order is None:
                continue
            fill_price = self._fill_price(order)
            if fill_price is None:
                continue
            self.positions.pop(ticket, None)
            self.orders.pop(ticket, None)
            self.open_position(order["symbol"], order["side"], float(order["volume"]),
                               float(fill_price), float(order["sl"]), float(order["tp"]),
                               int(order.get("magic") or 0), str(order.get("comment") or ""))

    def _fill_price(self, order: dict) -> Optional[float]:
        q = _mock_quote(order["symbol"])
        bid, ask = q["bid"], q["ask"]
        otype = order["type"]
        price = float(order["price"])
        if otype == "buy_limit":
            return price if ask <= price else None
        if otype == "sell_limit":
            return price if bid >= price else None
        if otype == "buy_stop":
            return ask if ask >= price else None
        if otype == "sell_stop":
            return bid if bid <= price else None
        if otype in ("buy_stop_limit", "sell_stop_limit"):
            stop_price = float(order.get("stop_price") or price)
            if otype == "buy_stop_limit":
                if not order.get("triggered"):
                    if ask >= stop_price:
                        order["triggered"] = True
                if order.get("triggered"):
                    if order.get("simple"):
                        return price
                    if ask <= price:
                        return price
            else:
                if not order.get("triggered"):
                    if bid <= stop_price:
                        order["triggered"] = True
                if order.get("triggered"):
                    if order.get("simple"):
                        return price
                    if bid >= price:
                        return price
        return None

    # -- yopish -------------------------------------------------------------
    def close_position(self, ticket: int, volume: Optional[float]) -> dict:
        pos = self.positions.get(int(ticket))
        if pos is None:
            return {"ok": False, "retcode": _RET_INVALID, "comment": "Position not found", "ticket": None}
        q = _mock_quote(pos["symbol"])
        price = q["bid"] if pos["type"] == "buy" else q["ask"]
        if volume is None or float(volume) <= 0:
            close_volume = float(pos["volume"])
        else:
            try:
                close_volume = float(volume)
            except (TypeError, ValueError):
                return {"ok": False, "retcode": _RET_INVALID_CLOSE_VOLUME,
                        "comment": "Invalid close volume", "ticket": None}
            step = float(_spec(pos["symbol"])["lot_step"] or 0.01)
            if step > 0:
                close_volume = round(round(close_volume / step) * step, 8)
        if close_volume > float(pos["volume"]) + 1e-9:
            return {"ok": False, "retcode": _RET_INVALID_CLOSE_VOLUME,
                    "comment": "Invalid close volume", "ticket": None}
        profit = _profit_for(pos["symbol"], pos["type"], float(pos["price_open"]),
                             float(price), close_volume)
        self.balance = _r2(self.balance + profit)
        self._record_deal(pos, "out", close_volume, price, profit)
        remaining = _r2(float(pos["volume"]) - close_volume)
        if remaining <= 1e-9:
            self.positions.pop(int(ticket), None)
        else:
            pos["volume"] = remaining
        return {"ok": True, "retcode": _RET_DONE, "comment": "Done", "ticket": None}

    # -- o'zgartirish / bekor qilish ----------------------------------------
    def modify(self, ticket: int, sl: Optional[float], tp: Optional[float],
               price: Optional[float]) -> dict:
        ticket = int(ticket)
        pos = self.positions.get(ticket)
        if pos is not None:
            new_sl = float(pos["sl"] if sl is None else sl)
            new_tp = float(pos["tp"] if tp is None else tp)
            q = _mock_quote(pos["symbol"])
            ref = q["bid"] if pos["type"] == "buy" else q["ask"]
            error = _stops_error(pos["symbol"], pos["type"], ref, new_sl, new_tp)
            if error:
                return {"ok": False, "retcode": _RET_INVALID_STOPS, "comment": error}
            pos["sl"] = new_sl
            pos["tp"] = new_tp
            return {"ok": True, "retcode": _RET_DONE, "comment": "Done"}
        order = self.orders.get(ticket)
        if order is not None:
            new_price = float(order["price"] if price in (None, 0) else price)
            new_sl = float(order["sl"] if sl is None else sl)
            new_tp = float(order["tp"] if tp is None else tp)
            side = order["side"]
            q = _mock_quote(order["symbol"])
            bid, ask = q["bid"], q["ask"]
            otype = order["type"]
            error = None
            if otype == "buy_limit" and new_price >= ask:
                error = "Invalid price: buy limit must be below ask"
            elif otype == "sell_limit" and new_price <= bid:
                error = "Invalid price: sell limit must be above bid"
            elif otype == "buy_stop" and new_price <= ask:
                error = "Invalid price: buy stop must be above ask"
            elif otype == "sell_stop" and new_price >= bid:
                error = "Invalid price: sell stop must be below bid"
            if error:
                return {"ok": False, "retcode": _RET_INVALID_PRICE, "comment": error}
            error = _stops_error(order["symbol"], side, new_price, new_sl, new_tp)
            if error:
                return {"ok": False, "retcode": _RET_INVALID_STOPS, "comment": error}
            order["price"] = new_price
            order["sl"] = new_sl
            order["tp"] = new_tp
            return {"ok": True, "retcode": _RET_DONE, "comment": "Done"}
        return {"ok": False, "retcode": _RET_INVALID, "comment": "Order/position not found"}

    def cancel(self, ticket: int) -> dict:
        if int(ticket) in self.orders:
            self.orders.pop(int(ticket), None)
            return {"ok": True, "retcode": _RET_DONE, "comment": "Done"}
        return {"ok": False, "retcode": _RET_INVALID, "comment": "Order not found"}


MOCK = _MockEngine()


def mock_reset() -> None:
    """Testlar uchun: mock hisobni boshlang'ich holatga qaytaradi."""
    MOCK.reset()


# ---------------------------------------------------------------------------
# Mock endpointlar logikasi
# ---------------------------------------------------------------------------
def _order_ok(ticket: Optional[int], *, dry_run: bool = False,
              check: Optional[dict] = None, comment: str = "Done") -> dict:
    return {
        "ok": True, "dry_run": bool(dry_run), "ticket": None if ticket is None else int(ticket),
        "retcode": 0, "comment": comment, "check": check or {},
    }


def _order_fail(retcode: int, comment: str, *, dry_run: bool = False) -> dict:
    return {
        "ok": False, "dry_run": bool(dry_run), "ticket": None,
        "retcode": int(retcode), "comment": str(comment), "check": {},
    }


def _simple_result(ok: bool, retcode: int = 0, comment: str = "Done") -> dict:
    # Muvaffaqiyatda retcode 0 (kontrakt), xatoda MT5'ning haqiqiy kodi saqlanadi.
    return {"ok": bool(ok), "retcode": 0 if ok else int(retcode), "comment": str(comment)}


def _close_result(ok: bool, retcode: int = 0, comment: str = "Done") -> dict:
    return {
        "ok": bool(ok), "retcode": 0 if ok else int(retcode),
        "comment": str(comment), "ticket": None,
    }


def _check_dict(margin: float, free: float, profit: float = 0.0,
                margin_level: float = 0.0, retcode: int = 0, comment: str = "") -> dict:
    return {
        "margin": _r2(margin), "margin_free": _r2(free), "profit": _r2(profit),
        "margin_level": _r2(margin_level), "retcode": int(retcode), "comment": str(comment),
    }


def _mock_check(new_margin: float) -> dict:
    equity = MOCK.equity()
    used = MOCK.margin()
    free = equity - used - new_margin
    total = used + new_margin
    level = (equity / total * 100.0) if total > 0 else 0.0
    return _check_dict(new_margin, free, 0.0, level)


def _mock_symbol_entry(logical: str) -> dict:
    spec = _spec(logical)
    quote = _mock_quote(logical)
    digits = int(spec["digits"])
    point = float(spec["point"])
    contract = float(spec["contract"])
    mid = (quote["bid"] + quote["ask"]) / 2.0
    spread_points = int(round(float(spec["spread"]) / point)) if float(spec["spread"]) > 0 else 0
    return {
        "digits": digits,
        "point": point,
        "min_lot": float(spec["min_lot"]),
        "max_lot": float(spec["max_lot"]),
        "lot_step": float(spec["lot_step"]),
        "contract": contract,
        "spread": spread_points,
        "stops_level": int(spec.get("stops_level") or 0),
        "freeze_level": int(spec.get("freeze_level") or 0),
        "trade_mode": "full",
        "market_open": True,
        "bid": float(quote["bid"]),
        "ask": float(quote["ask"]),
        "tick_value": round(point * contract, 8),
        "margin_per_lot": round(mid * contract / max(1, MOCK.leverage), 2),
    }


def _mock_symbols() -> dict:
    return {logical: _mock_symbol_entry(logical) for logical in _SYMBOLS if logical in MARKET_SPECS}


def _static_symbol_entry(logical: str) -> dict:
    """MT5 bo'lmaganda (live/disabled) statik default symbol ma'lumoti."""
    spec = _spec(logical)
    digits = int(_DEFAULT_DIGITS.get(logical, spec["digits"]) or spec["digits"])
    point = 10.0 ** (-digits)
    mid = _price_from_provider(logical) or float(spec["base_price"])
    half = float(spec["spread"]) / 2.0
    contract = float(spec["contract"])
    leverage = 100
    return {
        "digits": digits,
        "point": point,
        "min_lot": float(spec["min_lot"]),
        "max_lot": float(spec["max_lot"]),
        "lot_step": float(spec["lot_step"]),
        "contract": contract,
        "spread": int(round(float(spec["spread"]) / point)) if float(spec["spread"]) > 0 else int(spec.get("spread") or 0),
        "stops_level": int(spec.get("stops_level") or 0),
        "freeze_level": int(spec.get("freeze_level") or 0),
        "trade_mode": "full",
        "market_open": True,
        "bid": round(mid - half, digits),
        "ask": round(mid + half, digits),
        "tick_value": round(point * contract, 8),
        "margin_per_lot": round(mid * contract / leverage, 2),
    }


def _static_symbols() -> dict:
    return {logical: _static_symbol_entry(logical) for logical in _SYMBOLS}


def _mock_state(now: int) -> dict:
    MOCK.evaluate()
    return {
        "mode": MODE_MOCK, "why": None,
        "account": MOCK.account(),
        "positions": MOCK.positions_public(),
        "orders": MOCK.orders_public(),
        "symbols": _mock_symbols(),
        "time": int(now),
    }


def _mock_place_order(req: dict) -> dict:
    dry_run = bool(req.get("dry_run"))
    logical = str(req["symbol"])
    spec = _spec(logical)
    side = str(req["side"])
    otype = str(req["type"])
    volume, error = _normalize_volume(logical, req.get("volume"))
    if error:
        return _order_fail(_RET_INVALID_VOLUME, error, dry_run=dry_run)
    sl = float(req.get("sl") or 0.0)
    tp = float(req.get("tp") or 0.0)
    magic = int(req.get("magic") or 0)
    comment = str(req.get("comment") or "XAUView")
    quote = _mock_quote(logical)
    bid, ask = quote["bid"], quote["ask"]
    MOCK.evaluate()
    if otype == "market":
        ref = ask if side == "buy" else bid
        error = _stops_error(logical, side, ref, sl, tp)
        if error:
            return _order_fail(_RET_INVALID_STOPS, error, dry_run=dry_run)
        margin = MOCK._margin_for(logical, float(volume), ref)
        check = _mock_check(margin)
        if margin > MOCK.equity():
            return _order_fail(_RET_NO_MONEY, "No money", dry_run=dry_run)
        if dry_run:
            return _order_ok(None, dry_run=True, check=check)
        ticket = MOCK.open_position(logical, side, float(volume), ref, sl, tp, magic, comment)
        logger.info("Mock market %s %s %.2f lot @ %.5f -> #%d", side, logical, volume, ref, ticket)
        return _order_ok(ticket, check=check)
    # pending orderlar
    price = float(req.get("price") or 0.0)
    if price <= 0:
        return _order_fail(_RET_INVALID_PRICE, "Invalid price", dry_run=dry_run)
    order_type = "%s_%s" % (side, otype)  # buy_limit / sell_stop / buy_stop_limit ...
    stop_price = req.get("stop_price")
    simple = otype == "stop_limit" and stop_price in (None, 0, 0.0)
    stop_price_value = float(price if stop_price in (None, 0, 0.0) else stop_price)
    if order_type == "buy_limit" and price >= ask:
        return _order_fail(_RET_INVALID_PRICE, "Invalid price: buy limit must be below ask", dry_run=dry_run)
    if order_type == "sell_limit" and price <= bid:
        return _order_fail(_RET_INVALID_PRICE, "Invalid price: sell limit must be above bid", dry_run=dry_run)
    if order_type == "buy_stop" and price <= ask:
        return _order_fail(_RET_INVALID_PRICE, "Invalid price: buy stop must be above ask", dry_run=dry_run)
    if order_type == "sell_stop" and price >= bid:
        return _order_fail(_RET_INVALID_PRICE, "Invalid price: sell stop must be below bid", dry_run=dry_run)
    if order_type == "buy_stop_limit" and stop_price_value <= ask:
        return _order_fail(_RET_INVALID_PRICE, "Invalid price: buy stop-limit trigger must be above ask", dry_run=dry_run)
    if order_type == "sell_stop_limit" and stop_price_value >= bid:
        return _order_fail(_RET_INVALID_PRICE, "Invalid price: sell stop-limit trigger must be below bid", dry_run=dry_run)
    error = _stops_error(logical, side, price, sl, tp)
    if error:
        return _order_fail(_RET_INVALID_STOPS, error, dry_run=dry_run)
    margin = MOCK._margin_for(logical, float(volume), price)
    check = _mock_check(margin)
    if margin > MOCK.equity():
        return _order_fail(_RET_NO_MONEY, "No money", dry_run=dry_run)
    if dry_run:
        return _order_ok(None, dry_run=True, check=check)
    ticket = MOCK.next_ticket()
    MOCK.orders[ticket] = {
        "ticket": ticket,
        "symbol": logical,
        "type": order_type,
        "side": side,
        "volume": float(volume),
        "price": float(price),
        "stop_price": stop_price_value,
        "simple": bool(simple),
        "triggered": False,
        "sl": sl,
        "tp": tp,
        "state": "placed",
        "expiration": 0,
        "magic": magic,
        "comment": comment,
        "time": int(time.time()),
    }
    logger.info("Mock pending %s %s %.2f lot @ %.5f -> #%d", side, order_type, volume, price, ticket)
    return _order_ok(ticket, check=check)


# ---------------------------------------------------------------------------
# Live (haqiqiy MT5) yordamchilari
# ---------------------------------------------------------------------------
async def _call(fn: Callable[..., Any], *args: Any, timeout: float = 10.0) -> Any:
    """MT5 chaqiruvi app.mt5_wait orqali (bitta thread, timeout bilan)."""
    if _MT5_WAIT is None:
        return fn(*args)
    return await _MT5_WAIT(fn, *args, timeout=timeout)


def _direct_call(fn: Callable[..., Any], *args: Any) -> Any:
    """order_send / order_check MT5 worker-thread'ida ishlamaydi.

    Amalda tekshirildi: ThreadPoolExecutor orqali chaqirilsa last_error
    (-2, 'Unnamed arguments not allowed') qaytadi va None olib qolamiz; xuddi
    shu request bevosita (event-loop oqimida) chaqirilsa (0, 'Done') bo'ladi.
    order_send bir necha millisekund ishlaydi, shuning uchun bevosita chaqiramiz.
    """
    try:
        return fn(*args)
    except Exception:
        logger.exception("MT5 direct call xatosi: %s", getattr(fn, "__name__", fn))
        return None


def _last_error() -> tuple[int, str]:
    if _MT5 is None:
        return (0, "")
    try:
        error = _MT5.last_error()
    except Exception:
        return (0, "")
    if isinstance(error, (tuple, list)) and error:
        try:
            code = int(error[0])
        except (TypeError, ValueError):
            code = 0
        message = str(error[1]) if len(error) > 1 else ""
        return (code, message)
    return (0, str(error or ""))


def _order_state_name(value: int) -> str:
    return _ORDER_STATE_NAMES.get(int(value), "placed")


def _trade_mode_name(value: int) -> str:
    return _TRADE_MODE_NAMES.get(int(value), "full")


def _filling_from_info(info: Any) -> int:
    """symbol_info.filling_mode bitmaskasi -> FOK/IOC, aks holda RETURN."""
    try:
        mask = int(getattr(info, "filling_mode", 0) or 0)
    except (TypeError, ValueError):
        mask = 0
    if mask & 1:  # SYMBOL_FILLING_FOK == 1
        return _const("ORDER_FILLING_FOK", 0)
    if mask & 2:  # SYMBOL_FILLING_IOC == 2
        return _const("ORDER_FILLING_IOC", 1)
    return _const("ORDER_FILLING_RETURN", 2)


def _live_position_public(pos: Any) -> dict:
    logical = resolve_symbol(getattr(pos, "symbol", "")) or str(getattr(pos, "symbol", ""))
    side = "buy" if int(getattr(pos, "type", 0)) == _const("POSITION_TYPE_BUY", 0) else "sell"
    return {
        "ticket": int(getattr(pos, "ticket", 0)),
        "symbol": logical,
        "type": side,
        "volume": _r2(getattr(pos, "volume", 0.0)),
        "price_open": float(getattr(pos, "price_open", 0.0) or 0.0),
        "sl": float(getattr(pos, "sl", 0.0) or 0.0),
        "tp": float(getattr(pos, "tp", 0.0) or 0.0),
        "price_current": float(getattr(pos, "price_current", 0.0) or 0.0),
        "profit": _r2(getattr(pos, "profit", 0.0)),
        "swap": _r2(getattr(pos, "swap", 0.0)),
        "magic": int(getattr(pos, "magic", 0) or 0),
        "comment": str(getattr(pos, "comment", "") or ""),
        "time": int(getattr(pos, "time", 0) or 0),
    }


def _live_order_public(order: Any) -> dict:
    logical = resolve_symbol(getattr(order, "symbol", "")) or str(getattr(order, "symbol", ""))
    type_value = int(getattr(order, "type", 2))
    type_map = {
        0: "buy", 1: "sell", 2: "buy_limit", 3: "sell_limit",
        4: "buy_stop", 5: "sell_stop", 6: "buy_stop_limit", 7: "sell_stop_limit",
    }
    return {
        "ticket": int(getattr(order, "ticket", 0)),
        "symbol": logical,
        "type": type_map.get(type_value, "buy_limit"),
        "volume": _r2(getattr(order, "volume_current", 0.0)),
        "price": float(getattr(order, "price_open", 0.0) or 0.0),
        "sl": float(getattr(order, "sl", 0.0) or 0.0),
        "tp": float(getattr(order, "tp", 0.0) or 0.0),
        "state": _order_state_name(int(getattr(order, "state", 1) or 0)),
        "expiration": int(getattr(order, "time_expiration", 0) or 0),
        "magic": int(getattr(order, "magic", 0) or 0),
        "comment": str(getattr(order, "comment", "") or ""),
        "time": int(getattr(order, "time_setup", 0) or 0),
    }


async def _live_account() -> Optional[dict]:
    if _MT5 is None:
        return None
    account = await _call(_MT5.account_info, timeout=8.0)
    if account is None:
        return None
    return {
        "login": int(getattr(account, "login", 0) or 0),
        "server": str(getattr(account, "server", "") or ""),
        "company": str(getattr(account, "company", "") or ""),
        "name": str(getattr(account, "name", "") or ""),
        "currency": str(getattr(account, "currency", "") or ""),
        "leverage": int(getattr(account, "leverage", 0) or 0),
        "balance": _r2(getattr(account, "balance", 0.0)),
        "equity": _r2(getattr(account, "equity", 0.0)),
        "margin": _r2(getattr(account, "margin", 0.0)),
        "free_margin": _r2(getattr(account, "margin_free", 0.0)),
        "margin_level": _r2(getattr(account, "margin_level", 0.0)),
        "profit": _r2(getattr(account, "profit", 0.0)),
    }


async def _live_positions() -> list[dict]:
    if _MT5 is None:
        return []
    positions = await _call(_MT5.positions_get, timeout=10.0)
    return [_live_position_public(pos) for pos in (positions or [])]


async def _live_orders() -> list[dict]:
    if _MT5 is None:
        return []
    orders = await _call(_MT5.orders_get, timeout=10.0)
    return [_live_order_public(order) for order in (orders or [])]


async def _live_symbols() -> dict:
    out: dict[str, dict] = {}
    for logical, broker in _SYMBOLS.items():
        info = await _call(_MT5.symbol_info, broker, timeout=5.0) if _MT5 is not None else None
        if info is None:
            out[logical] = _static_symbol_entry(logical)
            continue
        tick = await _call(_MT5.symbol_info_tick, broker, timeout=5.0)
        digits = int(getattr(info, "digits", 0) or 0) or int(_DEFAULT_DIGITS.get(logical, 5))
        point = float(getattr(info, "point", 0) or 0) or 10.0 ** (-digits)
        trade_mode = int(getattr(info, "trade_mode", 4) or 0)
        bid = float(getattr(tick, "bid", 0.0) or 0.0) if tick is not None else 0.0
        ask = float(getattr(tick, "ask", 0.0) or 0.0) if tick is not None else 0.0
        fresh = False
        if tick is not None:
            try:
                fresh = (time.time() - int(getattr(tick, "time", 0) or 0)) < 180
            except (TypeError, ValueError):
                fresh = False
        contract = float(getattr(info, "trade_contract_size", 0) or 0)
        margin_initial = float(getattr(info, "margin_initial", 0) or 0)
        if margin_initial <= 0 and bid > 0:
            margin_initial = bid * contract / 100.0
        out[logical] = {
            "digits": digits,
            "point": point,
            "min_lot": float(getattr(info, "volume_min", 0.01) or 0.01),
            "max_lot": float(getattr(info, "volume_max", 100.0) or 100.0),
            "lot_step": float(getattr(info, "volume_step", 0.01) or 0.01),
            "contract": contract,
            "spread": int(getattr(info, "spread", 0) or 0),
            "stops_level": int(getattr(info, "trade_stops_level", 0) or 0),
            "freeze_level": int(getattr(info, "trade_freeze_level", 0) or 0),
            "trade_mode": _trade_mode_name(trade_mode),
            "market_open": bool(trade_mode != 0 and fresh),
            "bid": bid,
            "ask": ask,
            "tick_value": float(getattr(info, "trade_tick_value", 0) or 0),
            "margin_per_lot": _r2(margin_initial),
        }
    return out


async def _live_state(now: int) -> dict:
    account = await _live_account()
    positions = await _live_positions()
    orders = await _live_orders()
    symbols = await _live_symbols()
    return {
        "mode": MODE_LIVE, "why": None,
        "account": account, "positions": positions, "orders": orders,
        "symbols": symbols, "time": int(now),
    }


def _info_point(info: Any) -> float:
    try:
        point = float(getattr(info, "point", 0) or 0)
    except (TypeError, ValueError):
        point = 0.0
    return point if point > 0 else 0.00001


def _live_stops_error(info: Any, side: str, ref_price: float, sl: float, tp: float) -> Optional[str]:
    point = _info_point(info)
    stops_points = int(getattr(info, "trade_stops_level", 0) or 0)
    min_distance = stops_points * point

    def too_close(value: float) -> bool:
        return min_distance > 0 and abs(ref_price - value) < min_distance - 1e-12

    if sl:
        if side == "buy" and sl >= ref_price - 1e-12:
            return "Invalid stops: SL must be below entry price"
        if side == "sell" and sl <= ref_price + 1e-12:
            return "Invalid stops: SL must be above entry price"
        if too_close(sl):
            return "Invalid stops: SL too close (stops_level=%d)" % stops_points
    if tp:
        if side == "buy" and tp <= ref_price + 1e-12:
            return "Invalid stops: TP must be above entry price"
        if side == "sell" and tp >= ref_price - 1e-12:
            return "Invalid stops: TP must be below entry price"
        if too_close(tp):
            return "Invalid stops: TP too close (stops_level=%d)" % stops_points
    return None


def _live_volume(info: Any, volume: Any) -> tuple[Optional[float], Optional[str]]:
    try:
        value = float(volume)
    except (TypeError, ValueError):
        return None, "Invalid volume"
    step = float(getattr(info, "volume_step", 0.01) or 0.01)
    min_lot = float(getattr(info, "volume_min", 0.01) or 0.01)
    max_lot = float(getattr(info, "volume_max", 100.0) or 100.0)
    if step > 0:
        ratio = value / step
        if abs(ratio - round(ratio)) > 1e-6:
            return None, "Invalid volume: step %s" % ("%g" % step)
        value = round(round(ratio) * step, 8)
    if value < min_lot - 1e-9:
        return None, "Invalid volume: min %.2f" % min_lot
    if value > max_lot + 1e-9:
        return None, "Invalid volume: max %.2f" % max_lot
    return round(value, 4), None


async def _live_place_order(req: dict) -> dict:
    if _MT5 is None:
        raise HTTPException(status_code=503, detail=WHY_MT5_UNAVAILABLE)
    dry_run = bool(req.get("dry_run"))
    logical = str(req["symbol"])
    broker = _broker_symbol(logical)
    side = str(req["side"])
    otype = str(req["type"])
    await _call(_MT5.symbol_select, broker, True, timeout=5.0)
    info = await _call(_MT5.symbol_info, broker, timeout=5.0)
    if info is None:
        return _order_fail(_RET_INVALID, "Symbol not available: %s" % broker, dry_run=dry_run)
    volume, error = _live_volume(info, req.get("volume"))
    if error:
        return _order_fail(_RET_INVALID_VOLUME, error, dry_run=dry_run)
    trade_mode = int(getattr(info, "trade_mode", 4) or 0)
    if trade_mode == 0:
        return _order_fail(_RET_TRADE_DISABLED, "Trade disabled for symbol", dry_run=dry_run)
    tick = await _call(_MT5.symbol_info_tick, broker, timeout=5.0)
    if tick is None:
        return _order_fail(_RET_MARKET_CLOSED, "No tick (market closed?)", dry_run=dry_run)
    sl = float(req.get("sl") or 0.0)
    tp = float(req.get("tp") or 0.0)
    magic = int(req.get("magic") or 0)
    comment = str(req.get("comment") or "XAUView")[:31]
    deviation = int(req.get("deviation") or 20)
    filling = _filling_from_info(info)
    request: dict[str, Any] = {
        "magic": magic,
        "comment": comment,
        "type_time": _const("ORDER_TIME_GTC", 0),
        "type_filling": filling,
    }
    if otype == "market":
        price = float(getattr(tick, "ask", 0.0)) if side == "buy" else float(getattr(tick, "bid", 0.0))
        if price <= 0:
            return _order_fail(_RET_MARKET_CLOSED, "No price (market closed?)", dry_run=dry_run)
        error = _live_stops_error(info, side, price, sl, tp)
        if error:
            return _order_fail(_RET_INVALID_STOPS, error, dry_run=dry_run)
        request.update({
            "action": _const("TRADE_ACTION_DEAL", 1),
            "symbol": broker,
            "volume": float(volume),
            "type": _const("ORDER_TYPE_BUY", 0) if side == "buy" else _const("ORDER_TYPE_SELL", 1),
            "price": price,
            "sl": sl,
            "tp": tp,
            "deviation": deviation,
        })
    else:
        price = float(req.get("price") or 0.0)
        if price <= 0:
            return _order_fail(_RET_INVALID_PRICE, "Invalid price", dry_run=dry_run)
        error = _live_stops_error(info, side, price, sl, tp)
        if error:
            return _order_fail(_RET_INVALID_STOPS, error, dry_run=dry_run)
        type_map = {
            "limit": (_const("ORDER_TYPE_BUY_LIMIT", 2), _const("ORDER_TYPE_SELL_LIMIT", 3)),
            "stop": (_const("ORDER_TYPE_BUY_STOP", 4), _const("ORDER_TYPE_SELL_STOP", 5)),
            "stop_limit": (_const("ORDER_TYPE_BUY_STOP_LIMIT", 6), _const("ORDER_TYPE_SELL_STOP_LIMIT", 7)),
        }
        buy_type, sell_type = type_map[otype]
        request.update({
            "action": _const("TRADE_ACTION_PENDING", 5),
            "symbol": broker,
            "volume": float(volume),
            "type": buy_type if side == "buy" else sell_type,
            "price": price,
            "sl": sl,
            "tp": tp,
        })
        if otype == "stop_limit":
            stop_price = float(req.get("stop_price") or price)
            request["stoplimit"] = stop_price
    if dry_run:
        check_result = _direct_call(_MT5.order_check, request)
        if check_result is None:
            code, message = _last_error()
            return _order_fail(code or _RET_INVALID, message or "order_check failed", dry_run=True)
        retcode = _const("TRADE_RETCODE_DONE", _RET_DONE)
        check_retcode = int(getattr(check_result, "retcode", 0) or 0)
        check = _check_dict(
            getattr(check_result, "margin", 0.0), getattr(check_result, "margin_free", 0.0),
            getattr(check_result, "profit", 0.0), getattr(check_result, "margin_level", 0.0),
            check_retcode, str(getattr(check_result, "comment", "") or ""),
        )
        if check_retcode not in (0, _RET_DONE):
            return _order_fail(check_retcode, str(getattr(check_result, "comment", "") or "Rejected"),
                               dry_run=True)
        return _order_ok(None, dry_run=True, check=check)
    result = _direct_call(_MT5.order_send, request)
    if result is None:
        code, message = _last_error()
        return _order_fail(code or _RET_INVALID, message or "order_send failed", dry_run=False)
    retcode = int(getattr(result, "retcode", 0) or 0)
    comment_out = str(getattr(result, "comment", "") or "")
    order_ticket = int(getattr(result, "order", 0) or 0)
    ticket = order_ticket if order_ticket > 0 else None
    if retcode not in (_RET_DONE, _RET_PLACED, 10010):
        return _order_fail(retcode, comment_out or "Rejected", dry_run=False)
    logger.info("Live order %s %s %.2f lot retcode=%d ticket=%s", side, logical, volume, retcode, ticket)
    return _order_ok(ticket, dry_run=False, comment=comment_out or "Done")


async def _live_close(ticket: int, volume: Optional[float]) -> dict:
    if _MT5 is None:
        raise HTTPException(status_code=503, detail=WHY_MT5_UNAVAILABLE)
    positions = await _call(_MT5.positions_get, timeout=10.0) or []
    pos = None
    for item in positions:
        if int(getattr(item, "ticket", 0) or 0) == int(ticket):
            pos = item
            break
    if pos is None:
        return _close_result(False, _RET_INVALID, "Position not found")
    broker = str(getattr(pos, "symbol", "") or "")
    info = await _call(_MT5.symbol_info, broker, timeout=5.0)
    tick = await _call(_MT5.symbol_info_tick, broker, timeout=5.0)
    if info is None or tick is None:
        return _close_result(False, _RET_INVALID, "Symbol/tick not available")
    position_volume = float(getattr(pos, "volume", 0.0) or 0.0)
    close_volume = position_volume if volume is None or float(volume) <= 0 else float(volume)
    close_volume, error = _live_volume(info, min(close_volume, position_volume))
    if error or close_volume is None:
        return _close_result(False, _RET_INVALID_CLOSE_VOLUME, "Invalid close volume")
    is_buy = int(getattr(pos, "type", 0) or 0) == _const("POSITION_TYPE_BUY", 0)
    request = {
        "action": _const("TRADE_ACTION_DEAL", 1),
        "symbol": broker,
        "position": int(ticket),
        "volume": float(close_volume),
        "type": _const("ORDER_TYPE_SELL", 1) if is_buy else _const("ORDER_TYPE_BUY", 0),
        "price": float(getattr(tick, "bid", 0.0) or 0.0) if is_buy else float(getattr(tick, "ask", 0.0) or 0.0),
        "deviation": 20,
        "magic": int(getattr(pos, "magic", 0) or 0),
        "comment": "XAUView close",
        "type_time": _const("ORDER_TIME_GTC", 0),
        "type_filling": _filling_from_info(info),
    }
    result = _direct_call(_MT5.order_send, request)
    if result is None:
        code, message = _last_error()
        return _close_result(False, code or _RET_INVALID, message or "order_send failed")
    retcode = int(getattr(result, "retcode", 0) or 0)
    comment = str(getattr(result, "comment", "") or "")
    ok = retcode in (_RET_DONE, _RET_PLACED, 10010)
    if ok:
        logger.info("Live close #%s volume=%.2f retcode=%d", ticket, close_volume, retcode)
    return _close_result(ok, retcode, comment or ("Done" if ok else "Rejected"))


async def _live_modify(ticket: int, sl: Optional[float], tp: Optional[float],
                       price: Optional[float]) -> dict:
    if _MT5 is None:
        raise HTTPException(status_code=503, detail=WHY_MT5_UNAVAILABLE)
    positions = await _call(_MT5.positions_get, timeout=10.0) or []
    for pos in positions:
        if int(getattr(pos, "ticket", 0) or 0) == int(ticket):
            new_sl = float(getattr(pos, "sl", 0.0) or 0.0) if sl is None else float(sl)
            new_tp = float(getattr(pos, "tp", 0.0) or 0.0) if tp is None else float(tp)
            request = {
                "action": _const("TRADE_ACTION_SLTP", 6),
                "symbol": str(getattr(pos, "symbol", "") or ""),
                "position": int(ticket),
                "sl": new_sl,
                "tp": new_tp,
            }
            result = _direct_call(_MT5.order_send, request)
            return _send_result(result, "modify")
    orders = await _call(_MT5.orders_get, timeout=10.0) or []
    for order in orders:
        if int(getattr(order, "ticket", 0) or 0) == int(ticket):
            new_price = float(getattr(order, "price_open", 0.0) or 0.0) if price in (None, 0) else float(price)
            new_sl = float(getattr(order, "sl", 0.0) or 0.0) if sl is None else float(sl)
            new_tp = float(getattr(order, "tp", 0.0) or 0.0) if tp is None else float(tp)
            request = {
                "action": _const("TRADE_ACTION_MODIFY", 7),
                "order": int(ticket),
                "price": new_price,
                "sl": new_sl,
                "tp": new_tp,
                "type_time": _const("ORDER_TIME_GTC", 0),
            }
            result = _direct_call(_MT5.order_send, request)
            return _send_result(result, "modify")
    return _simple_result(False, _RET_INVALID, "Order/position not found")


async def _live_cancel(ticket: int) -> dict:
    if _MT5 is None:
        raise HTTPException(status_code=503, detail=WHY_MT5_UNAVAILABLE)
    orders = await _call(_MT5.orders_get, timeout=10.0) or []
    found = any(int(getattr(order, "ticket", 0) or 0) == int(ticket) for order in orders)
    if not found:
        return _simple_result(False, _RET_INVALID, "Order not found")
    request = {"action": _const("TRADE_ACTION_REMOVE", 8), "order": int(ticket)}
    result = _direct_call(_MT5.order_send, request)
    return _send_result(result, "cancel")


def _send_result(result: Any, action: str) -> dict:
    if result is None:
        code, message = _last_error()
        return _simple_result(False, code or _RET_INVALID, message or "%s failed" % action)
    retcode = int(getattr(result, "retcode", 0) or 0)
    comment = str(getattr(result, "comment", "") or "")
    ok = retcode in (_RET_DONE, _RET_PLACED, 10010)
    if ok:
        logger.info("Live %s retcode=%d", action, retcode)
    return _simple_result(ok, retcode, comment or ("Done" if ok else "Rejected"))


async def _live_flat() -> dict:
    closed = 0
    canceled = 0
    errors: list[dict] = []
    if _MT5 is None:
        raise HTTPException(status_code=503, detail=WHY_MT5_UNAVAILABLE)
    for pos in await _call(_MT5.positions_get, timeout=10.0) or []:
        result = await _live_close(int(getattr(pos, "ticket", 0) or 0), None)
        if result.get("ok"):
            closed += 1
        else:
            errors.append({"ticket": int(getattr(pos, "ticket", 0) or 0),
                           "comment": result.get("comment") or "close failed"})
    for order in await _call(_MT5.orders_get, timeout=10.0) or []:
        result = await _live_cancel(int(getattr(order, "ticket", 0) or 0))
        if result.get("ok"):
            canceled += 1
        else:
            errors.append({"ticket": int(getattr(order, "ticket", 0) or 0),
                           "comment": result.get("comment") or "cancel failed"})
    logger.info("Live flat: closed=%d canceled=%d errors=%d", closed, canceled, len(errors))
    return {"ok": True, "closed": closed, "canceled": canceled, "errors": errors}


async def _live_history(days: int) -> dict:
    if _MT5 is None:
        raise HTTPException(status_code=503, detail=WHY_MT5_UNAVAILABLE)
    now = datetime.now()
    start = now - timedelta(days=int(days))
    deals = await _call(_MT5.history_deals_get, start, now, timeout=20.0)
    out: list[dict] = []
    buy_type = _const("DEAL_TYPE_BUY", 0)
    sell_type = _const("DEAL_TYPE_SELL", 1)
    entry_map = {0: "in", 1: "out", 2: "inout", 3: "out_by"}
    for deal in deals or []:
        deal_type = int(getattr(deal, "type", -1) or -1)
        if deal_type not in (buy_type, sell_type):
            continue  # balans/bonus/komissiya deal'lari tarixga kirmaydi
        out.append({
            "ticket": int(getattr(deal, "ticket", 0) or 0),
            "position_id": int(getattr(deal, "position_id", 0) or 0),
            "symbol": resolve_symbol(getattr(deal, "symbol", "")) or str(getattr(deal, "symbol", "") or ""),
            "type": "buy" if deal_type == buy_type else "sell",
            "entry": entry_map.get(int(getattr(deal, "entry", 0) or 0), "in"),
            "volume": _r2(getattr(deal, "volume", 0.0)),
            "price": float(getattr(deal, "price", 0.0) or 0.0),
            "profit": _r2(getattr(deal, "profit", 0.0)),
            "commission": _r2(getattr(deal, "commission", 0.0)),
            "swap": _r2(getattr(deal, "swap", 0.0)),
            "time": int(getattr(deal, "time", 0) or 0),
            "comment": str(getattr(deal, "comment", "") or ""),
            "magic": int(getattr(deal, "magic", 0) or 0),
        })
    out.sort(key=lambda row: (row["time"], row["ticket"]))
    return {"deals": out, "count": len(out)}


def _mock_history(days: int) -> dict:
    cutoff = time.time() - int(days) * 86400
    deals = [dict(deal) for deal in MOCK.deals if int(deal["time"]) >= cutoff]
    deals.sort(key=lambda row: (row["time"], row["ticket"]))
    return {"deals": deals, "count": len(deals)}


# ---------------------------------------------------------------------------
# Guard / auth dependencylar
# ---------------------------------------------------------------------------
def _require_enabled() -> None:
    if not trade_enabled():
        raise HTTPException(status_code=503, detail=WHY_TRADE_DISABLED)


def _require_mt5_live() -> None:
    if mock_enabled():
        return
    if not live_ready():
        raise HTTPException(status_code=503, detail=WHY_MT5_UNAVAILABLE)


def _check_token(header_value: Optional[str]) -> None:
    expected = trade_token()
    if not expected:
        return
    if (header_value or "").strip() != expected:
        raise HTTPException(status_code=401, detail="unauthorized")


def _dep_enabled() -> None:
    _require_enabled()


def _dep_mt5() -> None:
    _require_enabled()
    _require_mt5_live()


def _dep_token(x_trade_token: Optional[str] = Header(default=None, alias="X-Trade-Token")) -> None:
    _check_token(x_trade_token)


def _dep_mutation(x_trade_token: Optional[str] = Header(default=None, alias="X-Trade-Token")) -> None:
    _require_enabled()
    _require_mt5_live()
    _check_token(x_trade_token)


# ---------------------------------------------------------------------------
# So'rov modellari (barcha maydonlar ixtiyoriy: tekshiruv qo'lda, 400 bad_request)
# ---------------------------------------------------------------------------
class TradeLoginIn(BaseModel):
    company: Optional[str] = None
    server: Optional[str] = None
    login: Optional[int] = None
    password: Optional[str] = None


class TradeOrderIn(BaseModel):
    symbol: Optional[str] = None
    side: Optional[str] = None
    type: Optional[str] = "market"
    volume: Optional[float] = None
    price: Optional[float] = None
    stop_price: Optional[float] = None
    sl: Optional[float] = 0.0
    tp: Optional[float] = 0.0
    deviation: Optional[int] = 20
    comment: Optional[str] = "XAUView"
    dry_run: bool = False
    magic: Optional[int] = 777001


class TradeCloseIn(BaseModel):
    ticket: Optional[int] = None
    volume: Optional[float] = None
    dry_run: bool = False


class TradeModifyIn(BaseModel):
    ticket: Optional[int] = None
    sl: Optional[float] = None
    tp: Optional[float] = None
    price: Optional[float] = None
    dry_run: bool = False


class TradeCancelIn(BaseModel):
    ticket: Optional[int] = None
    dry_run: bool = False


class TradeFlatIn(BaseModel):
    confirm: Optional[bool] = False


# ---------------------------------------------------------------------------
# Endpointlar
# ---------------------------------------------------------------------------
router = APIRouter(prefix="/api/trade", tags=["trade"])


@router.get("/state")
async def trade_state() -> dict:
    """/api/trade/state - to'liq holat (mobile UI asosiy manbai)."""
    mode = current_mode()
    now = int(time.time())
    if mode == MODE_DISABLED:
        return {
            "mode": MODE_DISABLED, "why": WHY_TRADE_DISABLED, "account": None,
            "positions": [], "orders": [], "symbols": _static_symbols(), "time": now,
        }
    if mode == MODE_MOCK:
        return _mock_state(now)
    if not live_ready():
        return {
            "mode": MODE_LIVE, "why": WHY_MT5_UNAVAILABLE, "account": None,
            "positions": [], "orders": [], "symbols": _static_symbols(), "time": now,
        }
    try:
        return await _live_state(now)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Live state xatosi")
        return {
            "mode": MODE_LIVE, "why": WHY_MT5_UNAVAILABLE, "account": None,
            "positions": [], "orders": [], "symbols": _static_symbols(), "time": now,
        }


@router.get("/account", dependencies=[Depends(_dep_mt5)])
async def trade_account() -> dict:
    if mock_enabled():
        return {"mode": MODE_MOCK, "account": MOCK.account()}
    account = await _live_account()
    if account is None:
        raise HTTPException(status_code=503, detail=WHY_MT5_UNAVAILABLE)
    return {"mode": MODE_LIVE, "account": account}


@router.post("/login", dependencies=[Depends(_dep_enabled), Depends(_dep_token)])
async def trade_login(payload: TradeLoginIn) -> dict:
    if mock_enabled():
        # Mock rejimda login shart emas: akkaunt darhol "ulangan" hisoblanadi.
        return {"ok": True, "account": MOCK.account()}
    if _MT5 is None:
        raise HTTPException(status_code=503, detail=WHY_MT5_UNAVAILABLE)
    login = payload.login
    server = str(payload.server or "").strip()
    if not login or not server or payload.password is None:
        raise HTTPException(status_code=400, detail="bad_request")
    if not live_ready():
        # Terminal hali ulanmagan bo'lsa, avval initialize qilamiz.
        try:
            await _call(_MT5.initialize, timeout=30.0)
        except Exception:
            logger.debug("mt5.initialize xatosi (login oldidan)", exc_info=True)
    try:
        ok = bool(await _call(_MT5.login, int(login), str(payload.password), server, timeout=60.0))
    except Exception:
        logger.exception("mt5.login xatosi (login=%s server=%s)", login, server)
        ok = False
    if not ok:
        code, message = _last_error()
        logger.warning("Trade login muvaffaqiyatsiz: login=%s server=%s retcode=%s", login, server, code)
        return {"ok": False, "retcode": code, "comment": message or "login failed"}
    logger.info("Trade login: login=%s server=%s (parol saqlanmadi)", login, server)
    if _RECONNECT is not None:
        try:
            await _RECONNECT()
        except Exception:
            logger.debug("login keyin reconnect xatosi", exc_info=True)
    elif _SET_CONNECTED is not None:
        _SET_CONNECTED(True)
    account = await _live_account()
    return {"ok": True, "account": account}


@router.post("/logout", dependencies=[Depends(_dep_enabled), Depends(_dep_token)])
async def trade_logout() -> dict:
    if mock_enabled():
        return {"ok": True}
    if _MT5 is not None:
        try:
            await _call(_MT5.shutdown, timeout=10.0)
        except Exception:
            logger.debug("mt5.shutdown xatosi", exc_info=True)
        if _SET_CONNECTED is not None:
            _SET_CONNECTED(False)
    logger.info("Trade logout")
    return {"ok": True}


@router.post("/order", dependencies=[Depends(_dep_mutation)])
async def trade_order(payload: TradeOrderIn) -> dict:
    logical = resolve_symbol(payload.symbol)
    if logical is None:
        raise HTTPException(status_code=400, detail="bad_request")
    side = str(payload.side or "").strip().lower()
    if side not in _VALID_SIDES:
        raise HTTPException(status_code=400, detail="bad_request")
    order_type = str(payload.type or "market").strip().lower()
    if order_type not in _VALID_TYPES:
        raise HTTPException(status_code=400, detail="bad_request")
    if payload.volume is None:
        raise HTTPException(status_code=400, detail="bad_request")
    request = {
        "symbol": logical,
        "side": side,
        "type": order_type,
        "volume": payload.volume,
        "price": payload.price,
        "stop_price": payload.stop_price,
        "sl": payload.sl or 0.0,
        "tp": payload.tp or 0.0,
        "deviation": payload.deviation if payload.deviation is not None else 20,
        "comment": payload.comment or "XAUView",
        "dry_run": bool(payload.dry_run),
        "magic": payload.magic if payload.magic is not None else 777001,
    }
    if mock_enabled():
        return _mock_place_order(request)
    return await _live_place_order(request)


@router.post("/close", dependencies=[Depends(_dep_mutation)])
async def trade_close(payload: TradeCloseIn) -> dict:
    if payload.ticket is None:
        raise HTTPException(status_code=400, detail="bad_request")
    if mock_enabled():
        MOCK.evaluate()
        if bool(payload.dry_run):
            pos = MOCK.positions.get(int(payload.ticket))
            if pos is None:
                return _close_result(False, _RET_INVALID, "Position not found")
            return _close_result(True, _RET_DONE, "Done")
        result = MOCK.close_position(int(payload.ticket), payload.volume)
        return _close_result(bool(result.get("ok")), int(result.get("retcode") or 0),
                             str(result.get("comment") or "Done"))
    return await _live_close(int(payload.ticket), payload.volume)


@router.post("/modify", dependencies=[Depends(_dep_mutation)])
async def trade_modify(payload: TradeModifyIn) -> dict:
    if payload.ticket is None:
        raise HTTPException(status_code=400, detail="bad_request")
    if mock_enabled():
        MOCK.evaluate()
        if bool(payload.dry_run):
            ticket = int(payload.ticket)
            if ticket in MOCK.positions or ticket in MOCK.orders:
                return _simple_result(True, _RET_DONE, "Done")
            return _simple_result(False, _RET_INVALID, "Order/position not found")
        result = MOCK.modify(int(payload.ticket), payload.sl, payload.tp, payload.price)
        return _simple_result(bool(result.get("ok")), int(result.get("retcode") or 0),
                              str(result.get("comment") or "Done"))
    return await _live_modify(int(payload.ticket), payload.sl, payload.tp, payload.price)


@router.post("/cancel", dependencies=[Depends(_dep_mutation)])
async def trade_cancel(payload: TradeCancelIn) -> dict:
    if payload.ticket is None:
        raise HTTPException(status_code=400, detail="bad_request")
    if mock_enabled():
        MOCK.evaluate()
        if bool(payload.dry_run):
            ok = int(payload.ticket) in MOCK.orders
            return _simple_result(ok, _RET_DONE if ok else _RET_INVALID,
                                  "Done" if ok else "Order not found")
        result = MOCK.cancel(int(payload.ticket))
        return _simple_result(bool(result.get("ok")), int(result.get("retcode") or 0),
                              str(result.get("comment") or "Done"))
    return await _live_cancel(int(payload.ticket))


@router.post("/flat", dependencies=[Depends(_dep_mutation)])
async def trade_flat(payload: TradeFlatIn) -> dict:
    if payload.confirm is not True:
        raise HTTPException(status_code=400, detail="bad_request")
    if mock_enabled():
        MOCK.evaluate()
        closed = 0
        canceled = 0
        errors: list[dict] = []
        for ticket in sorted(MOCK.positions):
            result = MOCK.close_position(int(ticket), None)
            if result.get("ok"):
                closed += 1
            else:
                errors.append({"ticket": int(ticket), "comment": result.get("comment") or "close failed"})
        for ticket in sorted(MOCK.orders):
            result = MOCK.cancel(int(ticket))
            if result.get("ok"):
                canceled += 1
            else:
                errors.append({"ticket": int(ticket), "comment": result.get("comment") or "cancel failed"})
        return {"ok": True, "closed": closed, "canceled": canceled, "errors": errors}
    return await _live_flat()


@router.get("/history", dependencies=[Depends(_dep_mt5)])
async def trade_history(days: int = 7) -> dict:
    try:
        days_value = int(days)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="bad_request")
    if not 1 <= days_value <= 365:
        raise HTTPException(status_code=400, detail="bad_request")
    if mock_enabled():
        MOCK.evaluate()
        return _mock_history(days_value)
    return await _live_history(days_value)


# ---------------------------------------------------------------------------
# app.py tomonidan chaqiriladi
# ---------------------------------------------------------------------------
def install(app: Any) -> None:
    """Router'ni FastAPI ilovasiga qo'shadi (static mount'dan oldin!)."""
    app.include_router(router)
    logger.debug("Trade router o'rnatildi: %s", [route.path for route in router.routes])

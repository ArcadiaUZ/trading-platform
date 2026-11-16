#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""server/trade.py uchun pytest testlari - OFFLINE (mock rejim, MT5 kerak emas).

Ishlatish:
    D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe -m pytest server\test_trade.py -q

Testlar XAUVIEW_TRADE_MOCK=1 muhitida app.py'ni import qiladi va FastAPI
TestClient orqali /api/trade/* endpointlarini tekshiradi. Narx manbai
trade.set_price_provider() bilan almashtiriladi -> to'liq deterministik.
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

# app.py import qilinishidan OLDIN: MT5siz (Render/Linux simulyatsiyasi) + mock savdo
os.environ["XAUVIEW_DATA"] = "open"
os.environ["XAUVIEW_TRADE_MOCK"] = "1"
os.environ.pop("XAUVIEW_TRADE", None)
os.environ.pop("XAUVIEW_TRADE_TOKEN", None)

import pytest
from fastapi.testclient import TestClient

import app as feed_app
import trade as trade_engine

client = TestClient(feed_app.app)

DEFAULT_PRICES = {"XAUUSD": 3850.0, "GBPUSD": 1.2650}


def set_price(xau: float = 3850.0, gbp: float = 1.2650) -> None:
    """Mock narxni belgilaydi (mock spread qat'iy: 0.2 / 0.00015)."""
    prices = {"XAUUSD": float(xau), "GBPUSD": float(gbp)}

    def provider(symbol):
        if symbol not in prices:
            return None
        value = prices[symbol]
        return {"price": value, "bid": value, "ask": value, "last": value}

    trade_engine.set_price_provider(provider)


def order(**kwargs):
    body = {
        "symbol": "XAUUSD",
        "side": "buy",
        "type": "market",
        "volume": 0.1,
        "price": None,
        "stop_price": None,
        "sl": 0.0,
        "tp": 0.0,
        "deviation": 20,
        "comment": "XAUView",
        "dry_run": False,
        "magic": 777001,
    }
    body.update(kwargs)
    return client.post("/api/trade/order", json=body)


def state() -> dict:
    response = client.get("/api/trade/state")
    assert response.status_code == 200
    return response.json()


@pytest.fixture(autouse=True)
def _fresh(monkeypatch):
    monkeypatch.setenv("XAUVIEW_TRADE_MOCK", "1")
    monkeypatch.delenv("XAUVIEW_TRADE", raising=False)
    monkeypatch.delenv("XAUVIEW_TRADE_TOKEN", raising=False)
    trade_engine.mock_reset()
    set_price()
    yield
    trade_engine.mock_reset()
    trade_engine.set_price_provider(feed_app.current_tick)


# ---------------------------------------------------------------------------
# 1. State / account
# ---------------------------------------------------------------------------
def test_state_mock_contract():
    body = state()
    assert body["mode"] == "mock"
    assert body["why"] is None
    assert isinstance(body["time"], int) and body["time"] > 0
    assert body["positions"] == []
    assert body["orders"] == []

    account = body["account"]
    assert account["balance"] == 10000.0
    assert account["currency"] == "USD"
    assert account["leverage"] == 100
    assert account["equity"] == 10000.0
    assert account["margin"] == 0.0
    assert account["margin_level"] == 0.0
    for key in ("login", "server", "company", "name", "balance", "equity",
                "margin", "free_margin", "margin_level", "profit"):
        assert key in account, key

    assert set(body["symbols"]) == {"XAUUSD", "GBPUSD"}
    sym = body["symbols"]["XAUUSD"]
    for key in ("digits", "point", "min_lot", "max_lot", "lot_step", "contract",
                "spread", "stops_level", "freeze_level", "trade_mode",
                "market_open", "bid", "ask", "tick_value", "margin_per_lot"):
        assert key in sym, key
    assert sym["digits"] == 3
    assert sym["point"] == 0.001
    assert sym["min_lot"] == 0.01
    assert sym["lot_step"] == 0.01
    assert sym["contract"] == 100.0
    assert sym["market_open"] is True
    assert sym["ask"] - sym["bid"] == pytest.approx(0.2, abs=1e-6)


def test_account_endpoint_mock():
    response = client.get("/api/trade/account")
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "mock"
    assert body["account"]["balance"] == 10000.0


def test_static_symbol_prices_follow_provider():
    set_price(4000.0)
    sym = state()["symbols"]["XAUUSD"]
    assert sym["bid"] == pytest.approx(3999.9, abs=1e-6)
    assert sym["ask"] == pytest.approx(4000.1, abs=1e-6)


# ---------------------------------------------------------------------------
# 2-3. Market order, margin va equity
# ---------------------------------------------------------------------------
def test_market_buy_creates_position_and_margin():
    response = order()
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["dry_run"] is False
    assert body["ticket"] == 100001
    assert body["retcode"] == 0
    assert body["check"]["margin"] > 0

    current = state()
    assert len(current["positions"]) == 1
    pos = current["positions"][0]
    assert pos["ticket"] == 100001
    assert pos["symbol"] == "XAUUSD"
    assert pos["type"] == "buy"
    assert pos["volume"] == 0.1
    assert pos["price_open"] == pytest.approx(3850.1, abs=1e-6)
    assert pos["sl"] == 0.0 and pos["tp"] == 0.0
    assert pos["magic"] == 777001
    assert pos["comment"] == "XAUView"
    for key in ("ticket", "symbol", "type", "volume", "price_open", "sl", "tp",
                "price_current", "profit", "swap", "magic", "comment", "time"):
        assert key in pos, key
    assert current["account"]["margin"] > 0
    assert current["account"]["free_margin"] < current["account"]["equity"]


def test_equity_moves_with_price():
    order()
    first = state()["account"]
    set_price(3860.0)
    current = state()
    pos = current["positions"][0]
    account = current["account"]
    assert pos["profit"] > 0
    assert account["equity"] > first["equity"]
    assert account["equity"] != account["balance"]
    assert account["equity"] == pytest.approx(account["balance"] + account["profit"], abs=0.01)
    assert account["margin_level"] > 0


def test_sell_position_profit_when_price_falls():
    body = order(side="sell").json()
    assert body["ok"] is True
    pos = state()["positions"][0]
    assert pos["type"] == "sell"
    assert pos["price_open"] == pytest.approx(3849.9, abs=1e-6)
    set_price(3840.0)
    pos = state()["positions"][0]
    assert pos["profit"] > 0


# ---------------------------------------------------------------------------
# 4. dry_run
# ---------------------------------------------------------------------------
def test_dry_run_does_not_create_position():
    body = order(dry_run=True).json()
    assert body["ok"] is True
    assert body["dry_run"] is True
    assert body["ticket"] is None
    assert body["check"]["margin"] > 0
    assert body["check"]["margin_free"] > 0
    assert state()["positions"] == []


def test_dry_run_pending_order_not_stored():
    body = order(type="limit", price=3840.0, dry_run=True).json()
    assert body["ok"] is True and body["dry_run"] is True
    assert body["ticket"] is None
    assert state()["orders"] == []


# ---------------------------------------------------------------------------
# 5. Pending orderlar (limit / stop / stop-limit)
# ---------------------------------------------------------------------------
def test_limit_order_fills_when_price_crosses():
    body = order(type="limit", price=3840.0).json()
    assert body["ok"] is True
    assert body["ticket"] == 100001

    current = state()
    assert current["positions"] == []
    assert len(current["orders"]) == 1
    pending = current["orders"][0]
    assert pending["type"] == "buy_limit"
    assert pending["price"] == pytest.approx(3840.0)
    assert pending["state"] == "placed"
    assert "price_current" not in pending  # mobile shu bilan pozitsiyadan farqlaydi

    set_price(3835.0)  # ask 3835.1 <= 3840 -> fill
    current = state()
    assert current["orders"] == []
    assert len(current["positions"]) == 1
    assert current["positions"][0]["price_open"] == pytest.approx(3840.0)


def test_stop_order_fills_when_price_crosses():
    body = order(type="stop", price=3860.0).json()
    assert body["ok"] is True
    assert len(state()["orders"]) == 1

    set_price(3875.0)  # ask 3875.1 >= 3860 -> fill
    current = state()
    assert current["orders"] == []
    assert len(current["positions"]) == 1
    assert current["positions"][0]["price_open"] == pytest.approx(3875.1, abs=1e-6)


def test_stop_limit_single_price_fills_after_trigger():
    # mobile UI stop_limit uchun bitta "stop narx" yuboradi (stop_price yo'q)
    body = order(type="stop_limit", price=3860.0).json()
    assert body["ok"] is True
    pending = state()["orders"][0]
    assert pending["type"] == "buy_stop_limit"

    set_price(3870.0)
    current = state()
    assert current["orders"] == []
    assert len(current["positions"]) == 1
    assert current["positions"][0]["price_open"] == pytest.approx(3860.0)


def test_limit_price_on_wrong_side_rejected():
    body = order(type="limit", price=3900.0).json()
    assert body["ok"] is False
    assert body["retcode"] == 10015
    assert "price" in body["comment"].lower()
    assert state()["orders"] == []


# ---------------------------------------------------------------------------
# 6. close (to'liq va qismli)
# ---------------------------------------------------------------------------
def test_close_full_removes_position():
    ticket = order().json()["ticket"]
    assert len(state()["positions"]) == 1
    response = client.post("/api/trade/close", json={"ticket": ticket, "volume": None, "dry_run": False})
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["retcode"] == 0
    assert body["ticket"] is None
    assert state()["positions"] == []
    # spread xarajati balansdan yechilgan
    assert state()["account"]["balance"] < 10000.0


def test_close_partial_keeps_remaining_volume():
    ticket = order(volume=0.1).json()["ticket"]
    body = client.post("/api/trade/close", json={"ticket": ticket, "volume": 0.05}).json()
    assert body["ok"] is True
    positions = state()["positions"]
    assert len(positions) == 1
    assert positions[0]["volume"] == pytest.approx(0.05)

    client.post("/api/trade/close", json={"ticket": ticket})
    assert state()["positions"] == []


def test_close_unknown_ticket_rejected():
    body = client.post("/api/trade/close", json={"ticket": 999999}).json()
    assert body["ok"] is False
    assert body["retcode"] == 10013


def test_close_dry_run_keeps_position():
    ticket = order().json()["ticket"]
    body = client.post("/api/trade/close", json={"ticket": ticket, "dry_run": True}).json()
    assert body["ok"] is True
    assert len(state()["positions"]) == 1


# ---------------------------------------------------------------------------
# 7. modify / cancel
# ---------------------------------------------------------------------------
def test_modify_position_sl_tp():
    ticket = order().json()["ticket"]
    body = client.post("/api/trade/modify", json={"ticket": ticket, "sl": 3840.0, "tp": 3870.0}).json()
    assert body["ok"] is True
    assert body["retcode"] == 0
    pos = state()["positions"][0]
    assert pos["sl"] == pytest.approx(3840.0)
    assert pos["tp"] == pytest.approx(3870.0)


def test_modify_position_invalid_stops_rejected():
    ticket = order().json()["ticket"]
    body = client.post("/api/trade/modify", json={"ticket": ticket, "sl": 3900.0}).json()
    assert body["ok"] is False
    assert body["retcode"] == 10016


def test_modify_pending_order_price():
    ticket = order(type="limit", price=3800.0).json()["ticket"]
    body = client.post("/api/trade/modify", json={
        "ticket": ticket, "price": 3805.0, "sl": 3790.0, "tp": 3830.0,
    }).json()
    assert body["ok"] is True
    pending = state()["orders"][0]
    assert pending["price"] == pytest.approx(3805.0)
    assert pending["sl"] == pytest.approx(3790.0)
    assert pending["tp"] == pytest.approx(3830.0)


def test_cancel_pending_order():
    ticket = order(type="limit", price=3800.0).json()["ticket"]
    body = client.post("/api/trade/cancel", json={"ticket": ticket}).json()
    assert body["ok"] is True
    assert state()["orders"] == []
    again = client.post("/api/trade/cancel", json={"ticket": ticket}).json()
    assert again["ok"] is False


# ---------------------------------------------------------------------------
# 8. flat
# ---------------------------------------------------------------------------
def test_flat_closes_positions_and_cancels_orders():
    order()
    order(type="limit", price=3800.0)
    body = client.post("/api/trade/flat", json={"confirm": True}).json()
    assert body["ok"] is True
    assert body["closed"] == 1
    assert body["canceled"] == 1
    assert body["errors"] == []
    current = state()
    assert current["positions"] == []
    assert current["orders"] == []


def test_flat_requires_confirm():
    order()
    response = client.post("/api/trade/flat", json={})
    assert response.status_code == 400
    assert response.json()["detail"] == "bad_request"
    assert len(state()["positions"]) == 1


# ---------------------------------------------------------------------------
# 9. history
# ---------------------------------------------------------------------------
def test_history_returns_profit_deals():
    ticket = order(volume=0.1).json()["ticket"]
    set_price(3860.0)
    client.post("/api/trade/close", json={"ticket": ticket})
    body = client.get("/api/trade/history?days=7").json()
    assert body["count"] == len(body["deals"]) == 2
    assert [deal["entry"] for deal in body["deals"]] == ["in", "out"]
    out_deal = body["deals"][-1]
    assert out_deal["profit"] > 0
    assert out_deal["position_id"] == ticket
    assert out_deal["symbol"] == "XAUUSD"
    assert out_deal["type"] == "buy"
    assert out_deal["volume"] == pytest.approx(0.1)
    for key in ("ticket", "position_id", "symbol", "type", "entry", "volume",
                "price", "profit", "commission", "swap", "time", "comment", "magic"):
        assert key in out_deal, key


def test_history_days_validation():
    assert client.get("/api/trade/history?days=0").status_code == 400
    assert client.get("/api/trade/history?days=999").status_code == 400
    assert client.get("/api/trade/history?days=7").status_code == 200


# ---------------------------------------------------------------------------
# 10. disabled rejim (XAUVIEW_TRADE=0)
# ---------------------------------------------------------------------------
def test_disabled_mode(monkeypatch):
    monkeypatch.setenv("XAUVIEW_TRADE", "0")
    body = state()
    assert body["mode"] == "disabled"
    assert body["why"] == "trade_disabled"
    assert body["account"] is None
    assert body["positions"] == [] and body["orders"] == []

    posts = [
        ("/api/trade/login", {"server": "S", "login": 1, "password": "x"}),
        ("/api/trade/logout", {}),
        ("/api/trade/order", {"symbol": "XAUUSD", "side": "buy", "type": "market", "volume": 0.1}),
        ("/api/trade/close", {"ticket": 1}),
        ("/api/trade/modify", {"ticket": 1, "sl": 1.0}),
        ("/api/trade/cancel", {"ticket": 1}),
        ("/api/trade/flat", {"confirm": True}),
    ]
    for path, payload in posts:
        response = client.post(path, json=payload)
        assert response.status_code == 503, path
        assert response.json()["detail"] == "trade_disabled", path

    for path in ("/api/trade/account", "/api/trade/history?days=7"):
        response = client.get(path)
        assert response.status_code == 503, path
        assert response.json()["detail"] == "trade_disabled", path


# ---------------------------------------------------------------------------
# 11. hajm validatsiyasi
# ---------------------------------------------------------------------------
def test_volume_below_min_rejected():
    body = order(volume=0.001).json()
    assert body["ok"] is False
    assert body["retcode"] == 10014
    assert "volume" in body["comment"].lower()
    assert state()["positions"] == []


def test_volume_above_max_and_bad_step_rejected():
    assert order(volume=1000.0).json()["retcode"] == 10014
    assert order(volume=0.007).json()["retcode"] == 10014
    assert order(volume=0.05).json()["ok"] is True  # 0.05 = 5 qadam -> OK


def test_invalid_request_400():
    assert order(symbol="NOPE").status_code == 400
    assert order(symbol="NOPE").json()["detail"] == "bad_request"
    assert order(side="hold").status_code == 400
    assert order(type="weird").status_code == 400
    assert order(volume=None).status_code == 400


def test_broker_symbol_alias_accepted():
    body = order(symbol="XAUUSDm").json()
    assert body["ok"] is True
    assert state()["positions"][0]["symbol"] == "XAUUSD"


# ---------------------------------------------------------------------------
# 12. Xavfsizlik: token va parol
# ---------------------------------------------------------------------------
def test_token_auth_on_mutations(monkeypatch):
    monkeypatch.setenv("XAUVIEW_TRADE_TOKEN", "s3cret")
    response = order()
    assert response.status_code == 401
    assert response.json()["detail"] == "unauthorized"

    response = client.post("/api/trade/order", json={
        "symbol": "XAUUSD", "side": "buy", "type": "market", "volume": 0.1,
    }, headers={"X-Trade-Token": "s3cret"})
    assert response.status_code == 200
    assert response.json()["ok"] is True

    # o'qish endpointlari token talab qilmaydi
    assert client.get("/api/trade/state").status_code == 200
    assert client.get("/api/trade/account").status_code == 200

    # login ham mutatsiya -> token kerak
    assert client.post("/api/trade/login", json={"server": "S", "login": 1, "password": "p"}).status_code == 401


def test_login_mock_and_password_not_stored_or_logged():
    records: list[str] = []
    handler = logging.Handler()
    handler.emit = lambda record: records.append(record.getMessage())
    feed_app.logger.addHandler(handler)
    try:
        response = client.post("/api/trade/login", json={
            "company": "Exness",
            "server": "Exness-MT5Trial8",
            "login": 474932446,
            "password": "SuperSecret#123",
        })
    finally:
        feed_app.logger.removeHandler(handler)
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["account"]["balance"] == 10000.0
    logged = " ".join(records)
    assert "SuperSecret#123" not in logged
    stored = repr(trade_engine.MOCK.__dict__)
    assert "SuperSecret#123" not in stored


# ---------------------------------------------------------------------------
# 13. Determinizm va regressiya
# ---------------------------------------------------------------------------
def test_deterministic_tickets_from_100001():
    first = order().json()["ticket"]
    second = order().json()["ticket"]
    assert (first, second) == (100001, 100002)
    trade_engine.mock_reset()
    assert order().json()["ticket"] == 100001


def test_existing_endpoints_still_work():
    health = client.get("/api/health")
    assert health.status_code == 200
    payload = health.json()
    assert payload["ok"] is True
    assert payload["symbols"] == ["XAUUSD", "GBPUSD"]
    assert "mt5_available" in payload
    assert client.get("/api/alerts").status_code == 200

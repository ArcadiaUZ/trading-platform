# OPEN DATA (API kalitsiz real narx manbalari)

Server MT5 orqali ishlaydi (asosiy manba). MT5 ulanmagan yoki barlar 60 sekunddan
eski bo'lsa, server `server/providers_open.py` dagi bepul manbalarga o'tadi.
Hech qanday API key, akkaunt yoki OANDA/FXCM kerak emas.

## Manbalar va tartib

| # | Provayder | URL | Nima beradi | Kechikish |
|---|-----------|-----|-------------|-----------|
| 0 | `mt5` | MetaTrader5 | bar + tick (asosiy) | real vaqt |
| 1 | `yahoo` | `query1.finance.yahoo.com/v8/finance/chart/GC%3DF` (XAUUSD) / `.../GBPUSD%3DX` (GBPUSD) | OHLC bar (M1..D1) + `meta.regularMarketPrice` | 1m bar ~1-2 daqiqa (ba'zan 10+) |
| 2 | `stooq` | `stooq.com/q/l/?s=xauusd&f=sd2t2ohlc&h&e=csv` | quote; D1 barlar `/q/d/l/?s=xauusd&i=d` | bir necha daqiqa |
| 3 | `goldapi` | `api.gold-api.com/price/XAU` | faqat XAU **spot** narx (bar yo'q) | bir necha soniya |

Tartib: `OPEN.ORDER = ('mt5', 'yahoo', 'stooq', 'goldapi')`. Birinchi ishlagan
manba ishlatiladi; xato bo'lsa keyingisiga o'tiladi. Timeout 6 s, 2 retry.

## XAUUSD va gold futures

Yahoo `GC=F` - COMEX oltin **fyuchers**, spot XAUUSD emas: narx odatda spotdan
$2-6 farq qiladi (bazis). Shuning uchun bu "proxy" manba; aniq spot kerak bo'lsa
`goldapi` (faqat narx) yoki MT5 XAUUSDm.

## Server integratsiyasi

- `app.py` boshida: `try: from providers_open import OPEN` (buzilsa `OPEN = None`,
  server o'lmaydi).
- `open_feed_loop()`: MT5 tick'i eskirgan bo'lsa har 2 s da open manbadan narx oladi.
- WS `snapshot` va `tick` xabarlariga qo'shildi: `provider` va `provider_delay_s`.
  `provider` = mt5 | yahoo | stooq | goldapi | demo.
- `/api/candles` ham MT5 bermasa open manbadan bar qaytaradi (javobda `provider`).

## API misollari (curl)

```bash
# hozirgi aktiv manba va provayderlar holati
curl http://127.0.0.1:8765/api/providers

# yahoo'ni majburan tanlash (test uchun)
curl -X POST http://127.0.0.1:8765/api/provider -H "Content-Type: application/json" -d '{"name":"yahoo"}'

# mt5'ga qaytish (default)
curl -X POST http://127.0.0.1:8765/api/provider -H "Content-Type: application/json" -d '{"name":"mt5"}'

# candles (MT5 yo'q bo'lsa yahoo'dan)
curl "http://127.0.0.1:8765/api/candles?symbol=XAUUSD&tf=M1&count=100"
```

## Halol cheklovlar (o'lchangan, 2026-11-16)

- **Yahoo**: ishlaydi. `GC=F` 1m bar ~10 daqiqa kechikishi kuzatildi (fyuchers
  sessiyasi), GBPUSD ~40-100 s. Real vaqt feed emas, "yaxshi zaxira".
  `GC=F` fyuchers, spot XAUUSD emas (bugun farq ~$2).
- **Stooq**: bu mashinadan `/q/l/` endpoint **HTTP 404** qaytardi (bot himoyasi /
  JS challenge). Kod to'g'ri yozilgan, lekin hozir bu hostdan ishlamaydi -> halol FAIL.
- **gold-api**: ishlaydi, faqat XAU spot narxi, bar yo'q, GBPUSD yo'q.
- Timeout 6 s + 2 retry: manba o'chiq bo'lsa WS snapshot 8-18 s sekinlashishi mumkin.
- Manbalar turlicha (fyuchers/spot) bo'lsa bir necha dollar farq normal.

## Qanday almashtirish

```python
# server/providers_open.py
OPEN.ORDER = ("mt5", "yahoo", "goldapi", "stooq")   # tartibni o'zgartirish
```

yoki serverni qayta ishga tushirmasdan: `POST /api/provider {"name": "yahoo"}`
(majburiy tanlash; `name=mt5` - default'ga qaytarish).

## /api/providers javob shakli

```json
{
  "active": "mt5",
  "forced": null,
  "providers": [
    {"name": "mt5", "ok": true, "latency_ms": null, "last_ok": null, "last_err": null},
    {"name": "yahoo", "ok": true, "latency_ms": 859, "last_ok": 1794831083, "last_err": null},
    {"name": "stooq", "ok": false, "latency_ms": null, "last_ok": null, "last_err": "HTTPError: HTTP Error 404"},
    {"name": "goldapi", "ok": true, "latency_ms": 640, "last_ok": 1794831090, "last_err": null}
  ],
  "note": "open data, no API key",
  "mt5": true,
  "mt5_fresh": {"XAUUSD": true, "GBPUSD": true},
  "open_ticks": {"XAUUSD": {"price": 3876.9, "provider": "yahoo", "time": 1794830481, "age_s": 30.0}},
  "version": "1.0.0"
}
```

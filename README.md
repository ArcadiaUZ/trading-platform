# XAUView - TradingView-ga o'xshash mobil chart platforma

XAUUSD (OANDA yorlig'i) va GBPUSD (FXCM yorlig'i) uchun telefon uchun moslangan real-time chart,
Asia-FU-Strategy Pine indikatori porti, chizma asboblari va alertlar.

## Nima bor

- **Mobil app** (`mobile/index.html`) - 393x873 (Xiaomi 12) aspect, touch gesture'lar: pan, pinch-zoom (vaqt + narx),
  long-press lupa (2.6x), double-tap reset, 13 xil chizma asbobi (trendline, hline, vline, rect, text, fib,
  measure, ray, arrow, hray, brush, highlighter, kanal), har bir chizma uchun rang/qalinlik/uslub/shaffoflik,
  5 chart turi (sham/hollow/bar/chiziq/area), 7 timeframe (D1 H4 H1 M15 M5 M3 M1).
- **Pine indikator**: Asia session 05:00-11:00 (UTC+5), London KZ 11:30-14:00, NY KZ 16:30-19:00,
  BSL/SSL, sweep, FVG, FU/SFU/AFU zonalari, CVD delta.
- **Server** (`server/app.py`) - FastAPI + WebSocket, 0.30 s tick, MT5 market-data, alert dvigateli
  (price / zone / sweep / session turlari), statik hosting.
- **PWA** - `mobile/sw.js` + manifest, HTTPS tunnel orqali telefon bildirishnomalari.
- **Desktop demo** (`demo/xauview-demo.html`) - brauzer uchun moslangan ko'rinish.

## Ishga tushirish

```powershell
# hammasi birgalikda: server + tunnel + health check
powershell -NoProfile -ExecutionPolicy Bypass -File server/start-all.ps1
```

Batafsil: [docs/RUNBOOK.md](docs/RUNBOOK.md)

## Manzillar

- LAN: `http://<kompyuter-ip>:8765`
- WebSocket: `ws://<kompyuter-ip>:8765/ws?symbol=XAUUSD&tf=M1`
- Telefon (HTTPS, notification uchun): `server/tunnel-url.txt` dagi URL

## Tuzilma

```
mobile/     mobil app (src/ bo'laklari -> assemble.js -> index.html)
demo/       desktop demo
server/     FastAPI feed + alert server
docs/       RUNBOOK, PROGRESS, STATE, DESIGN-TOKENS, PWA-HTTPS, OPEN-DATA
assets/     TradingView APK'dan ajratilgan ikonkalar/rasmlar (dizayn uchun)
shots/      test skrinshotlari
```

## Qayta yig'ish

```powershell
node mobile/src/assemble.js
node demo/src/assemble.js
```

## Eslatma

Bu loyiha savdo qilmaydi - faqat chart, indikator, chizma va alertlar. Ma'lumot MT5 (Exness demo)
yoki ochiq manbalardan (Yahoo/Stooq) olinadi.
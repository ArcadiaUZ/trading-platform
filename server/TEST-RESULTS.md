# TEST NATIJALARI - XAUUSD/GBPUSD feed server

**Sana/vaqt:** 2026-11-16 10:10:32 - 10:11:40 (Asia/Tashkent, UTC+5)
**Test qilingan server:** http://127.0.0.1:8765 (LAN: http://10.149.101.17:8765)
**Server PID:** 15200 (port 8765, ishlamoqda)
**Test buyrug'i:**

```powershell
cd D:\Project\AI\tvclone\server
D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe test_feed.py --soak 60
```

## Muhit

| Komponent | Versiya |
|---|---|
| OS | Windows (PowerShell 5.1) |
| Python | 3.12.10 (venv `D:\Project\AI\Trading-with-ai\.venv`) |
| FastAPI | 0.163.1 |
| uvicorn | 0.54.0 |
| websockets | 17.4 |
| MetaTrader5 | 5.0.6231 (Exness JO MT5 Terminal, build 6311) |
| Hisob | 474932446, Exness-MT5Trial15 (demo), balance 5000 USD |
| Symbol mapping | XAUUSD -> XAUUSDm (digits 3), GBPUSD -> GBPUSDm (digits 5) |

## Natijalar jadvali

| # | Band | Natija | O'lchangan izoh |
|---|------|--------|-----------------|
| 1 | health | **PASS** | `ok=true, mt5=true, symbols=['XAUUSD','GBPUSD'], CORS=*`, digits {XAUUSD:3, GBPUSD:5} |
| 2 | static_root | **PASS** | `GET /` -> 200, `text/html` (mobile/index.html beriladi) |
| 3 | candles | **PASS** | 7 TF x 2 symbol = 7000 bar; ts qat'iy o'sish tartibida; H/L/o/c izchil; narxlar digits bo'yicha (3/5); `count=5000` -> 5000 bar; noto'g'ri tf -> 400 |
| 4 | ws_ticks | **PASS** | 3 sekundda 10 tick (talab >=8); oraliq mean=300 ms, min=297 ms, max=312 ms (talab 300+-50 ms); snapshot 600 bar; bar ts/tick time izchil; `new_bar` bool |
| 5 | alert_trigger | **PASS** | POST -> WS `type:alert` kechikish **16 ms** (talab < 1000 ms); GET'da `active=false`, `triggered` int; `alerts.json` da saqlangan; DELETE -> `{"deleted":true}` |
| 6 | persistence | **PASS** | POST -> `alerts.json` (8 maydon: id, symbol, dir, price, note, created, triggered, active) -> GET -> DELETE |
| 7 | soak_60s | **PASS** | 5 parallel WS klient x 60 s xatosiz; ticklar: k1(XAUUSD/M1)=201, k2(XAUUSD/M5)=201, k3(GBPUSD/M1)=201, k4(GBPUSD/M15)=201, k5(XAUUSD/M1)=201 (kutilgan ~200) |

**Yakuniy:** 7/7 PASS, 0 FAIL (exit code 0).

## Batafsil xatolar

Final test yugurishida (10:10:32 - 10:11:40) **birorta FAIL yoki server xatosi yo'q**.

Avvalroq (10:06:43 - 10:07:00) MT5 terminal bir zumda uzildi va server buni o'zi tikladi:

```
2026-11-16 10:06:43 WARNING MT5 health check muvaffaqiyatsiz - qayta ulanish
2026-11-16 10:06:50 INFO    MT5 ulandi: login=474932446 server=Exness-MT5Trial15 balance=5000.00
2026-11-16 10:06:50 INFO    MT5 ulanish tiklandi
2026-11-16 10:07:00 WARNING MT5 health check muvaffaqiyatsiz - qayta ulanish
```

Bu hodisa paytida klient 3 s dan ortiq tick olmadi. Sabab: o'sha versiyada 15 sekundlik bar-refresh
tick yuborish zanjirida `await` qilinardi va MT5 chaqiruvi qotganda tick to'xtardi.
**Tuzatildi:** bar-refresh endi fon vazifasida (`asyncio.create_task`) bajariladi, MT5
chaqiruvlariga timeout qo'shildi (`mt5_wait`), shuning uchun MT5 uzilishi tick oqimini to'xtatmaydi.
Yuqoridagi 7/7 PASS aynan tuzatilgan versiya bilan olingan.

## Qo'shimcha qo'lda tekshiruvlar

| Tekshiruv | Natija |
|---|---|
| Bar almashishi (80 s M1 kuzatuv) | PASS - minut chegarasida 1 ta o'tish, `new_bar=true`, 1 s dan ortiq bo'shliq yo'q |
| D1 / H4 / M3 snapshot | PASS - 600 bar, digits 3/5, bar ts periodga mos, tick time bar ichida |
| Noto'g'ri symbol (USDJPY) | PASS - `{"type":"error","error":"Noma'lum symbol: USDJPY..."}` + close(1008) |
| Restartdan keyin alert saqlanishi | PASS - POST alert -> server restart -> GET /api/alerts'da alert (active=true, triggered=null) qaytdi |
| `run.ps1` (port 8799) | PASS - skript orqali serverni ko'tarib, `/api/health` 200 javob oldi |
| Statik fayllar | PASS - `/`, `/index.html`, `/manifest.webmanifest` 200 |
| Trading API ishlatilmasligi | PASS - kodda faqat `copy_rates_from_pos`, `symbol_info_tick`, `symbol_info`, `symbol_select` |

## Takrorlash

```powershell
# 1) server (agar ishlamayotgan bo'lsa)
cd D:\Project\AI\tvclone\server
pwsh -File run.ps1

# 2) testlar
D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe test_feed.py
D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe test_feed.py --soak 60
```

Test `server/alerts.json` faylini vaqtincha o'zgartiradi, lekin oxirida o'z alertlarini
o'chiradi (yakunda fayl: `{"alerts": []}`).
---

## Yangi yugurish: alert turlari (zone / sweep / session / on_cross)

**Sana/vaqt:** 2026-11-16 16:46:11 - 16:48 (Asia/Tashkent, UTC+5)
**Server:** PID 12092 (run.ps1), port 8765, MT5 ulangan; LAN http://10.149.101.17:8765
**Test buyrug'i:**

```powershell
cd D:\Project\AI\tvclone\server
D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe test_feed.py --soak 60
```

### Natijalar jadvali (15/15 PASS, 0 FAIL)

| # | Band | Natija | O'lchangan izoh |
|---|------|--------|-----------------|
| 1 | health | PASS | mt5=true, symbols=[XAUUSD, GBPUSD], CORS=* |
| 2 | static_root | PASS | GET / -> 200 text/html |
| 3 | candles | PASS | 7 TF x 2 symbol = 7000 bar; ts o'sish; digits 3/5; count=5000 -> 5000 |
| 4 | ws_ticks | PASS | 3 s da 10 tick; oraliq mean=300 ms, min 281 / max 328 ms |
| 5 | alert_trigger | PASS | price POST -> WS type:alert 109 ms; GET active=false; fayl; DELETE |
| 6 | sweep_asia_range | PASS | after_date 2026-11-13: high=3923.191 low=3878.852 POST javobida darhol; bugun 2026-11-16: high=3900.428 low=3832.188 |
| 7 | zone_trigger | PASS | zone POST -> WS alert 94 ms; message='XAUUSD test zona zonasiga kirdi (3872.408-3873.608): 3873.008' |
| 8 | zone_on_cross | PASS | on_cross=true: ichkarida trigger bo'lmadi, status armed qoldi |
| 9 | alert_schema | PASS | GET maydonlari (type/status/created/triggered_at/distance) + zone on_cross; DELETE /api/alerts ishladi |
| 10 | sweep_unit | PASS | asia_range/detect_sweeps/eval_sweep: BSL+SSL, dedupe, kun reset |
| 11 | zone_repeat_unit | PASS | kirish->trigger, chiqish->re-arm, qayta kirish->2-trigger, dedupe |
| 12 | zone_on_cross_unit | PASS | ichkarida trigger yo'q, chiqib qayta kirganda trigger |
| 13 | session_unit | PASS | killzone: London 11:30, NY 16:30 UTC+5 + eval_session trigger |
| 14 | persistence | PASS | POST -> alerts.json -> GET -> DELETE |
| 15 | soak_60s | PASS | 5 parallel klient x 60 s xatosiz; har biri 201 tick |

### Tuzatilgan muammolar (shu yugurishdan oldin)

* alerts.json parallel yozuvlarida race topilgan edi (os.replace FileNotFoundError,
  logda 'alerts.json yozish xatosi'). Tuzatish: asyncio.Lock + har yozuv uchun unikal .tmp fayl;
  final yugurishda xato yo'q.
* Sweep alert POST javobida range/sides null bo'lardi (faqat birinchi tick baholashda to'lardi).
  Tuzatish: POST paytida prepare_alert() Asia diapazonini darhol hisoblaydi (test 6 shuni tekshiradi).
* Zone alert uchun ixtiyoriy on_cross maydoni qo'shildi (faqat tashqaridan ichkariga kirganda trigger).
* Killzone vaqtlari chart bilan moslandi: London 11:30, NY 16:30 (UTC+5).

### Qo'shimcha tekshiruvlar

| Tekshiruv | Natija |
|---|---|
| GET /api/alerts maydonlari | PASS - har alertda type, status, created, triggered_at, distance, active, message va h.k. |
| DELETE /api/alerts (hammasi) | PASS - {"deleted": true, "count": N}, ro'yxat bo'shaydi |
| on_cross zone (E2E) | PASS - 1.5 s kuzatuvda trigger yo'q, status armed |
| Asia range POST javobida | PASS - range {high, low, day} darhol; sides {bsl, ssl} darhol |
| session target_ts | PASS - London keyingi ochilish 11:30 UTC+5 (epoch) |
| Serverni to'xtatmaslik | PASS - server ishlab turibdi, PID 12092, health OK |

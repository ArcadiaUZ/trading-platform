# XAUUSD / GBPUSD LIVE feed server

MetaTrader 5 dan real vaqt ma'lumotlarini olib, mobil chart frontend uchun REST + WebSocket
orqali beradigan FastAPI server. Faqat **market data** API'lari ishlatiladi
(`copy_rates_from_pos`, `symbol_info_tick`, `symbol_info`, `symbol_select`).
**Hech qanday trading API (order_send va h.k.) chaqirilmaydi.**

---

## 1. Ishga tushirish

### Talablar

* Python 3.12 (venv: `D:\Project\AI\Trading-with-ai\.venv`)
* MetaTrader 5 terminal **ochiq va ulangan** (demo hisob)
* Paketlar (bir marta):

```powershell
uv pip install --python "D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe" fastapi "uvicorn[standard]" websockets
# yoki venv ichida: python -m pip install fastapi "uvicorn[standard]" websockets
```

### Server

```powershell
cd D:\Project\AI\tvclone\server
pwsh -File run.ps1
```

yoki to'g'ridan-to'g'ri:

```powershell
D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8765
```

Server ishga tushganda logga LAN manzilni yozadi:

```
http://127.0.0.1:8765
http://10.149.101.17:8765      <- joriy mashinada aniqlangan LAN manzil
ws://10.149.101.17:8765/ws?symbol=XAUUSD&tf=M1
```

> Telefon va kompyuter bir Wi-Fi tarmog'ida bo'lishi kerak. Windows Firewall
> 8765-portni to'ssa, bir marta ruxsat bering:
> `New-NetFirewallRule -DisplayName "TVClone feed 8765" -Direction Inbound -LocalPort 8765 -Protocol TCP -Action Allow`

### Sozlamalar (env)

| O'zgaruvchi   | Default   | Ma'nosi                          |
|---------------|-----------|----------------------------------|
| `XAU_SYMBOL`  | `XAUUSDm` | XAUUSD uchun broker symbol       |
| `GBP_SYMBOL`  | `GBPUSDm` | GBPUSD uchun broker symbol       |
| `FEED_HOST`   | `0.0.0.0`  | bind host                        |
| `FEED_PORT`   | `8765`    | port                             |

Log: `server/server.log` (5 MB rotate). Alertlar: `server/alerts.json`.

---

## 2. REST API

### `GET /api/health`

```json
{"ok": true, "mt5": true, "symbols": ["XAUUSD", "GBPUSD"], "time": 1794805301,
 "digits": {"XAUUSD": 3, "GBPUSD": 5}, "version": "1.0.0"}
```

`mt5=false` bo'lsa server ishlayapti, lekin MT5 terminal bilan aloqa yo'q (fonda qayta ulanadi).

### `GET /api/candles?symbol=XAUUSD&tf=M1&count=500`

* `tf`: `D1, H4, H1, M15, M5, M3, M1`
* `count`: 1..5000 (default 500)
* javob: `{"symbol": "XAUUSD", "tf": "M1", "bars": [[ts, o, h, l, c, v], ...]}`
* `ts` — UTC epoch sekund (bar ochilish vaqti), narxlar symbol `digits` bo'yicha yumaloqlangan
  (XAUUSD 3 xona, GBPUSD 5 xona), `v` — tick volume (int).

```powershell
curl "http://127.0.0.1:8765/api/candles?symbol=XAUUSD&tf=M1&count=3"
```

### Alertlar (4 tur)

```
POST   /api/alerts            -> {"alert": {...}}
GET    /api/alerts            -> {"alerts": [{...}, ...]}
DELETE /api/alerts/{id}       -> {"deleted": true}
DELETE /api/alerts            -> {"deleted": true, "count": N}   (hammasini o'chirish)
```

Umumiy maydonlar (POST javobida va GET ro'yxatida):

| Maydon | Tur | Ma'nosi |
|---|---|---|
| id | string | 8 belgili qisqa uuid |
| type | string | price / zone / sweep / session |
| symbol | string | XAUUSD / GBPUSD |
| status | string | armed (kutmoqda) / triggered (bo'lgan) |
| active | bool | status == "armed" (eski maydon, backwards compat) |
| created | int | yaratilgan vaqt (epoch sekund, UTC) |
| triggered_at | int/null | oxirgi trigger vaqti |
| triggered | int/null | triggered_at bilan bir xil (eski maydon) |
| price_at | float/null | trigger paytida narx |
| message | string/null | trigger xabari (o'zbekcha) |
| trigger_count | int | necha marta trigger bo'lgan |
| note | string | foydalanuvchi izohi |
| distance | float/null | joriy narxga masofa (GET/POST javobida hisoblanadi) |

#### type = "price" (eski format - o'zgarmagan)

```
POST /api/alerts
{"symbol":"XAUUSD","dir":"above","price":3900.5,"note":"izoh"}
```

dir: above | below; price > 0. Narx chegaradan o'tganda bir marta trigger.

#### type = "zone"

```
POST /api/alerts
{"symbol":"XAUUSD","type":"zone","tf":"M15","lo":2650.0,"hi":2655.5,
 "label":"H4 muhim zona","repeat":false,"on_cross":false,"note":"izoh"}
```

* lo < hi. Narx [lo, hi] ga kirganda trigger (status: triggered).
* repeat=false (default) - bir marta trigger, status=triggered bo'lib qoladi.
* repeat=true - narx zonadan chiqsa yana armed bo'ladi, qayta kirganda yana trigger (trigger_count oshadi).
* on_cross=false (default) - narx POST paytida zona ichida bo'lsa, darhol (~50-150 ms) trigger bo'ladi.
* on_cross=true - faqat tashqaridan ICHKARIGA kirganda trigger; ichkarida bo'lsa armed qoladi
  (avval zonadan chiqishi kerak).
* label xabar matnida ishlatiladi.
* GET javobida tf, lo, hi, label, repeat, on_cross qaytadi.

#### type = "sweep" (Asia BSL/SSL sweep)

```
POST /api/alerts
{"symbol":"XAUUSD","type":"sweep","after_date":"2026-11-13","note":"izoh"}
```

* Server Asia diapazonini (05:00-11:00 UTC+5 = UTC 00:00-06:00) MT5 M15 (kerak bo'lsa H1)
  ma'lumotidan o'zi hisoblaydi. POST javobida range va sides DARHOL to'ldiriladi.
* Asia yopilgandan keyin M1 bar high > Asia HIGH bo'lib yana ichkariga close qilsa - BSL sweep;
  low < Asia LOW bo'lib ichkariga close qilsa - SSL sweep.
* Har tomon uchun kuniga bir marta (jami maks 2 ta/kun); yangi kun (UTC+5 00:00) da re-arm.
* after_date (YYYY-MM-DD, ixtiyoriy) - o'sha kunning Asia diapazonidan foydalanadi
  (o'tgan kun tahlili uchun); berilmasa joriy kun diapazoni.
* GET javobida qo'shimcha: range = {high, low, day} va sides = {bsl: bool, ssl: bool}.

#### type = "session" (killzone eslatmasi)

```
POST /api/alerts
{"symbol":"GBPUSD","type":"session","which":"london","note":"izoh"}
```

* which: london | ny.
* London killzone 11:30 UTC+5, NY 16:30 UTC+5 - chart/indikatordagi bandlar bilan mos
  (London KZ 11:30-14:00, NY KZ 16:30-19:00). Konstantalar app.py da: SESSION_KILLZONE_UTC5.
* Bir marta eslatadi; vaqt bugun o'tgan bo'lsa ertangi kunga qurollanadi.
* GET javobida which va target_ts (keyingi eslatma epoch sekundi) qaytadi.

Trigger bo'lganda status=triggered, active=false, triggered_at, price_at, message yoziladi,
alerts.json ga saqlanadi va BARCHA WS klientlarga type: "alert" xabari ketadi.
Aniq JSON namunalar: [API-SAMPLES.md](API-SAMPLES.md).

---
## 3. WebSocket protokoli

```
ws://HOST:8765/ws?symbol=XAUUSD&tf=M1
```

`symbol` — `XAUUSD` | `GBPUSD`; `tf` — `D1, H4, H1, M15, M5, M3, M1` (default `M1`).
Bir vaqtda o'nlab klient ulanishi mumkin (limit: 64), har biri o'z symbol/tf bilan.

### 1) Ulanishda darhol — snapshot (oxirgi 600 bar)

```json
{"type": "snapshot", "symbol": "XAUUSD", "tf": "M1", "digits": 3,
 "bars": [[1794805260, 3864.768, 3865.417, 3863.908, 3864.105, 184], "..."]}
```

### 2) Har ~300 ms — tick (+ shakllanayotgan bar)

```json
{"type": "tick", "symbol": "XAUUSD", "tf": "M1",
 "bid": 3864.105, "ask": 3864.345, "price": 3864.105, "time": 1794805321,
 "bar": [1794805260, 3864.768, 3865.417, 3863.908, 3864.105, 190],
 "new_bar": false}
```

* `price` = `bid` (last tick bo'lmasa), `bid`/`ask` — broker tick'i.
* `bar` — joriy (hali yopilmagan) bar; H/L/C har tick bilan yangilanadi.
* `new_bar: true` — yangi bar boshlanganda (o'sha paytdagi birinchi tick).
* Server har ~15 sekundda MT5'dan oxirgi 3 barni qayta o'qiydi va joriy barni tuzatadi.

### 3) Alert trigger - barcha klientlarga

Mobil ilova uchun qulay tashqi maydonlar + to'liq alert obyekti birga yuboriladi:

```
{"type": "alert",
 "id": "93c04f6e",
 "symbol": "XAUUSD",
 "message": "XAUUSD WS sample zonasiga kirdi (3872.765-3873.765): 3873.687",
 "price": 3873.687,
 "ts": 1794829500,
 "alert": {"id": "93c04f6e", "type": "zone", "symbol": "XAUUSD",
           "status": "triggered", "active": false, "created": 1794829500,
           "triggered_at": 1794829500, "triggered": 1794829500,
           "price_at": 3873.687, "message": "...", "trigger_count": 1,
           "note": "sample ws", "tf": "M15", "lo": 3872.765, "hi": 3873.765,
           "label": "WS sample", "repeat": false, "on_cross": false,
           "distance": 0.0}}
```

message har doim o'zbekcha. Misollar:
* price: XAUUSD 3900.500 dan yuqoriga o'tdi: 3901.200
* zone: XAUUSD H4 muhim zona zonasiga kirdi (2650.0-2655.5): 2652.4
* sweep (BSL): XAUUSD Asia HIGH sweep: 2653.400 dan qaytdi
* sweep (SSL): XAUUSD Asia LOW sweep: 2648.100 dan qaytdi
* session: GBPUSD: London killzone ochildi (11:30 UTC+5)

Trigger kechikishi: price/zone/session ~50-300 ms (checker 100 ms). Sweep - M1 bar yopilgandan
keyin aniqlanadi (1 daqiqagacha kechikish mumkin).

### 4) Ixtiyoriy: ping/pong
### 4) Ixtiyoriy: ping/pong

Klient `{"type":"ping"}` yuborsa, server `{"type":"pong","time":<ts>}` qaytaradi.

---

## 4. Statik hosting

`D:\Project\AI\tvclone\mobile` papkasi `/` da beriladi (`StaticFiles`):

* `GET /` -> `mobile/index.html` (papka/fayl bo'lmasa oddiy matnli javob)
* boshqa yo'llar (masalan `/src/app.js`, `/manifest.webmanifest`) — shu papkadan
* `/api/...` va `/ws` ustuvor (papka keyin mount qilingan)

Telefonda ochish: `http://<LAN-IP>:8765/`

---

## 5. Testlar

```powershell
cd D:\Project\AI\tvclone\server
D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe test_feed.py
# + 5 parallel WS klient, 60 sekund:
D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe test_feed.py --soak 60
```

Testlar (15 band): health, static_root, candles (7 TF x 2 symbol), ws_ticks (3 s ichida kamida
8 tick, oraliq 300+-50 ms), alert_trigger (price E2E), sweep_asia_range (Asia HIGH/LOW MT5'dan,
POST javobida darhol), zone_trigger (zone E2E: POST -> WS -> GET -> DELETE), zone_on_cross
(on_cross=true darhol trigger bo'lmasligi), alert_schema (GET maydonlari + DELETE all),
sweep_unit (asia_range/detect_sweeps/eval_sweep), zone_repeat_unit, zone_on_cross_unit,
session_unit (killzone 11:30/16:30), persistence, soak (5 parallel klient).
Har band uchun PASS/FAIL, oxirida jadval.

Oxirgi to'liq yugurish (15/15 PASS): [TEST-RESULTS.md](TEST-RESULTS.md).
Aniq JSON namunalar: [API-SAMPLES.md](API-SAMPLES.md).

---
---

## 6. Cheklovlar

* Faqat `XAUUSD` va `GBPUSD` (broker: `XAUUSDm`, `GBPUSDm`). Boshqa symbol 400 qaytaradi.
* MT5 terminal ochiq va ulangan bo'lishi shart; uzilsa server avtomatik qayta ulanadi
  (backoff 1 s -> 30 s), uzilish paytida REST `503` qaytaradi.
* Barcha MT5 chaqiruvlari bitta alohida thread'da ketma-ket bajariladi (MT5 python API
  thread-safety cheklovi sabab). Tick yangilanishi 100 ms interval bilan cache orqali.
* `price` = `bid` (XAUUSD/GBPUSD uchun `last` odatda 0). Diagramma shu narx bo'yicha quriladi.
* Shakllanayotgan bar H/L/C tick'lardan, `v` tick sonidan yig'iladi; har ~15 s da MT5'dagi
  haqiqiy bar bilan tuzatiladi. Shu sababli joriy bar hajmi biroz farq qilishi mumkin.
* Bozor yopiq bo'lganda (weekend) tick vaqtlari yangilanmaydi, lekin server bar'ni uzatishda
  davom etadi (oxirgi ma'lum narx bilan).
* WS tick intervali magsadli 300 ms; o'lchangan og'ish odatda +-20 ms. Klientda 50 ms dan
  ortiq kechikish bo'lsa tarmoq/OS yuklamasini tekshiring.
* Alertlar faylga atomik yoziladi (`alerts.json.tmp` -> `alerts.json`), lekin server bir
  vaqtda ikki nusxada ishlamasligi kerak (bitta port bitta nusxa).
* Sweep alert M1 yopilgan bar asosida ishlaydi: wick aniqlanishi bar yopilgach (1 daqiqagacha
  kechikish). Kuniga har tomon (BSL/SSL) 1 marta trigger bo'ladi.
* Session killzone vaqtlari app.py dagi SESSION_KILLZONE_UTC5 da: London 11:30, NY 16:30 (UTC+5)
  - chart/indikatordagi London KZ 11:30-14:00, NY KZ 16:30-19:00 bilan mos.
* Asia HIGH/LOW M15 barlardan (24 bar) hisoblanadi; M15 yetarli bo'lmasa H1 fallback, kamida 3 bar
  kerak, aks holda range=null va sweep trigger bo'lmaydi. Asia yopilmaguncha (11:00 UTC+5 gacha)
  range null bo'ladi, keyin avtomatik to'ladi.
* GET distance joriy narxga nisbatan har so'rovda qayta hisoblanadi (sweep range hali bo'lmasa null).
* zone on_cross=true: agar POST paytida narx zona ichida bo'lsa, trigger faqat chiqib qayta
  kirgandan keyin bo'ladi.
* Frontend'ga (`mobile/`) server hech narsa yozmaydi — faqat o'qiydi.
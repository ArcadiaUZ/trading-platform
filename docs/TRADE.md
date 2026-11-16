# XAUView savdo API (MT5) — server/trade.py

MT5 uslubidagi savdo: akkaunt, pozitsiya, pending order, market/limit/stop/stop-limit,
yopish (qismli ham), SL/TP o'zgartirish, bekor qilish, hammasini yopish va tarix.
Kod: `server/trade.py` (router `/api/trade`), `server/app.py` faqat router'ni ulaydi.

## Rejimlar

| Rejim | Qanday yoqiladi | Nima ishlaydi |
|---|---|---|
| `mock` | `XAUVIEW_TRADE_MOCK=1` | To'liq paper-trading (MT5 kerak emas, Linux/Render'da ham) |
| `live` | default (`XAUVIEW_TRADE=1`) | Lokal Windows MT5 terminal orqali haqiqiy savdo |
| `disabled` | `XAUVIEW_TRADE=0` | Savdo o'chirilgan: barcha `/api/trade/*` 503 |

Live'da MT5 bo'lmasa/ulanmasa: `/api/trade/state` -> `mode="live"`, `why="mt5_unavailable"`,
`account=null`, bo'sh ro'yxatlar; savdo endpointlari `503 {"detail":"mt5_unavailable"}`.
`disabled` rejimda ham xuddi shunday, faqat `why="trade_disabled"`.

## Env bayroqlari

| Env | Default | Ma'nosi |
|---|---|---|
| `XAUVIEW_TRADE` | `1` | `0` -> savdo butunlay o'chirilgan |
| `XAUVIEW_TRADE_MOCK` | `0` | `1` -> paper-trading simulyatori |
| `XAUVIEW_TRADE_TOKEN` | bo'sh | Berilsa mutatsiyalar `X-Trade-Token` headerini talab qiladi |

Mock parametrlari: balans **10000 USD**, leverage **1:100**, `XAUUSD`/`GBPUSD`,
narx `current_tick()` (open provayder feed)dan, qat'iy spread **0.2 / 0.00015**,
ticketlar **100001**dan boshlab ketma-ket.

## Endpointlar (hammasi JSON)

| Metod | Yo'l | Tavsif |
|---|---|---|
| GET | /api/trade/state | To'liq holat: mode, why, account, positions, orders, symbols, time |
| GET | /api/trade/account | `{"mode","account"}` |
| POST | /api/trade/login | `{company,server,login,password}` -> `{"ok":true,"account":{...}}` |
| POST | /api/trade/logout | `{"ok":true}` |
| POST | /api/trade/order | Market/limit/stop/stop-limit, `dry_run` bilan tekshirish |
| POST | /api/trade/close | Pozitsiyani to'liq yoki qismli yopish (`volume:null` = hammasi) |
| POST | /api/trade/modify | Pozitsiya -> SL/TP; pending -> narx + SL/TP |
| POST | /api/trade/cancel | Pending orderni bekor qilish |
| POST | /api/trade/flat | Hammasini yopish (faqat `confirm:true`) |
| GET | /api/trade/history?days=7 | Deal tarixi (`deals`, `count`) |

Xatolar: `HTTP 400 {"detail":"bad_request"}`, `401 {"detail":"unauthorized"}`,
`503 {"detail":"trade_disabled"|"mt5_unavailable"}`.
Broker rad etsa order endpointi **HTTP 200 + ok:false** va MT5'ning haqiqiy
`retcode/comment`ini qaytaradi (masalan `10018 "Market closed"`).
Muvaffaqiyatli javoblarda `retcode:0`; xatolarda MT5 kodi saqlanadi.

Order so'rovi:

```json
{"symbol":"XAUUSD","side":"buy","type":"market","volume":0.1,
 "price":3840.0,"stop_price":null,"sl":0.0,"tp":0.0,
 "deviation":20,"comment":"XAUView","dry_run":false,"magic":777001}
```

* `type:"market"` -> narx tick'dan (buy=ask, sell=bid);
* `limit`/`stop` -> `price` majburiy;
* `stop_limit` -> `price` = trigger, `stop_price` = limit narx (yuborilmasa
  `price` ikkalasi uchun ishlatiladi — mobil UI shunday yuboradi);
* `dry_run:true` -> faqat `order_check()`; javobda `check{margin, margin_free, ...}`;
* hajm `min_lot/max_lot/lot_step`, SL/TP `stops_level` bo'yicha tekshiriladi ->
  xato bo'lsa `ok:false, retcode:10014/10016`.

## Mock rejimda ishga tushirish (mobil UI testi uchun)

```powershell
cd D:\Project\AI\tvclone\server
$env:XAUVIEW_TRADE_MOCK="1"; $env:XAUVIEW_DATA="open"
D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe -m uvicorn app:app --port 8765
```

```bash
curl -s http://127.0.0.1:8765/api/trade/state
curl -s -X POST http://127.0.0.1:8765/api/trade/order \
  -H "Content-Type: application/json" \
  -d '{"symbol":"XAUUSD","side":"buy","type":"market","volume":0.1,"sl":3840,"tp":3870}'
curl -s -X POST http://127.0.0.1:8765/api/trade/order \
  -H "Content-Type: application/json" \
  -d '{"symbol":"XAUUSD","side":"buy","type":"limit","volume":0.01,"price":3800}'
curl -s -X POST http://127.0.0.1:8765/api/trade/flat \
  -H "Content-Type: application/json" -d '{"confirm":true}'
curl -s "http://127.0.0.1:8765/api/trade/history?days=7"
```

Mock'da pending order narx kesib o'tganda (`state`/`order` chaqiruvida) avtomatik
bajariladi; yopilgan pozitsiya foydasi balansga qo'shiladi va `history`da `entry:"out"`
deal bo'lib chiqadi.

## Xavfsizlik

* Parol **faqat xotirada**: `mt5.login(login, password, server)` ga uzatiladi,
  faylga yozilmaydi va logga tushmaydi (server logida faqat login/server).
* `XAUVIEW_TRADE_TOKEN` berilgan bo'lsa **mutatsiyalar** (`login`, `logout`, `order`,
  `close`, `modify`, `cancel`, `flat`) `X-Trade-Token: <token>` headerisiz `401`.
  O'qish endpointlari (`state`, `account`, `history`) token talab qilmaydi.
* `POST /api/trade/flat` faqat `{"confirm":true}` bilan bajariladi, aks holda 400.
* Savdoni umuman o'chirish: `XAUVIEW_TRADE=0`.

## Windows'da haqiqiy MT5 bilan

1. MetaTrader 5 terminalini ochib, Exness demo akkauntiga bir marta login qiling
   (symbol bozorda ko'rinadigan bo'lsin: `XAUUSDm`, `GBPUSDm`).
2. Python'da `MetaTrader5` paketi bo'lishi shart (`pip show MetaTrader5`).
3. `XAUVIEW_TRADE=1` (default) bilan serverni ishga tushiring. `/api/health` da
   `mt5:true` bo'lsa savdo tayyor. Akkauntni almashtirish: mobil UI -> Akkaunt ->
   server/login/parol (yoki `POST /api/trade/login`).
4. Symbol nomlari `XAU_SYMBOL` / `GBP_SYMBOL` env bilan almashtiriladi (default
   `XAUUSDm`/`GBPUSDm`).

## Nega Render'da savdo ishlamaydi?

Render — Linux; `MetaTrader5` faqat Windows'da mavjud va terminal jarayoni kerak.
Shu sababli Render'da `mode="live"` + `why="mt5_unavailable"` bo'ladi (feed/chart
open provayderlar bilan ishlayveradi). Mobil UI'ni sinash uchun `XAUVIEW_TRADE_MOCK=1`
ishlatiladi — narxlar open feed'dan, savdo to'liq xotirada. Haqiqiy savdo uchun
Windows server (yoki Windows VPS) kerak.

## Ma'lum cheklovlar

* `margin_per_lot` — **1 lot** uchun boshlang'ich marja (XAUUSD 3850 narxda 3850$).
  `tick_value` = `point * contract` (XAUUSD 0.1$).
* Mock'da `stop_limit` uchun bitta narx yuborilsa, trigger va limit bir nuqtada
  bo'ladi (stop kabi bajariladi) — mobil UI faqat bitta "stop narx" maydonini beradi.
* Mock'da login talab qilinmaydi: `POST /api/trade/login` istalgan ma'lumot bilan
  `{"ok":true,"account":{mock}}` qaytaradi (paper rejim). Live'da haqiqiy `mt5.login`.
* Mock'da komissiya/swap 0; narx — open feed tick'i (bozor yopiq bo'lsa oxirgi narx).
* Live'da login modul mavjud bo'lsa `mt5.initialize()` bilan qayta urinadi; akkaunt
  ma'lumotlari watchdog tiklashi bilan 1-30 s ichida yangilanadi.

## Testlar

```powershell
cd D:\Project\AI\tvclone
D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe -m pytest server\test_trade.py -q
D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe server\test_render_local.py
```

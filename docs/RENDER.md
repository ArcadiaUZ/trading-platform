# XAUView — Render.com FREE deploy (24/7, laptopsiz)

Bu yo'riqnoma XAUView feed serverini **Render.com free plan**da kun-u tun (24/7)
ishlatish uchun. Lokalda server 8765-portda ishlaydi, Render'da esa Render bergan
$PORT (odatda 10000) da tinglaydi. Free instance 15 daqiqa harakatsizlikdan keyin
uxlaydi — buni GitHub Actions keep-alive hal qiladi.

## 1. Fayllar (nima qo'shildi / o'zgardi)

| Fayl | Vazifasi |
|---|---|
| `server/app.py` | MT5 import ixtiyoriy (try/except), XAUVIEW_DATA=auto/mt5/open, MT5 yo'q bo'lsa open provayderlar snapshot **va** tick uchun |
| `server/Dockerfile` | `python:3.11-slim`, MetaTrader5 paketi **yo'q** |
| `server/requirements-render.txt` | container uchun aniq pip ro'yxati |
| `render.yaml` | Render Blueprint: docker, free, `/api/health` |
| `.github/workflows/keepalive.yml` | har 10 daqiqada ping (instance uxlamasin) |
| `server/test_render_local.py` | Linux/MT5'siz muhitni mahalliy simulyatsiya qiluvchi test |

## 2. Ma'lumot manbasi: XAUVIEW_DATA

| Qiymat | Xatti-harakat |
|---|---|
| `auto` (default) | MT5 bo'lsa MT5, bo'lmasa avtomatik open provayderlar |
| `mt5` | MT5 afzal; modul yo'q bo'lsa ham open'ga tushadi (server o'lmaydi) |
| `open` | MT5 **umuman** ishlatilmaydi — Render uchun shu |

Render Linux'da MetaTrader5 moduli yo'q, shuning uchun `XAUVIEW_DATA=open`
(o'rnatilgan default `auto` ham to'g'ri ishlaydi: MT5 topilmaydi va open'ga tushadi).

Open manbalar (API kalitsiz, `server/providers_open.py`):

1. **yahoo** — XAUUSD = `GC=F` (gold futures), GBPUSD = `GBPUSD=X`; M1 barlar + quote.
2. **stooq** — zaxira: quote + kunlik (D1) barlar.
3. **goldapi** — zaxira: faqat XAU spot narxi.

Qaysi biri ishlayotgani: `GET /api/providers` (`active`, `last_err`).

## 3. Qadam-baqadam

### 3.1. GitHub repo

Repo hozir lokal `master` branchda, remote hali yo'q:

```
cd D:\Project\AI\tvclone
git add -A
git commit -m "Render deploy: Docker, open data, keepalive"
# GitHub'da bo'sh repo yarating (private bo'lsa ham bo'ladi)
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin master
```

`.gitignore` `work/`, venv, `*.apk` va loglarni chiqarib tashlaydi — push kichik bo'ladi.

### 3.2. Render Blueprint

1. [render.com](https://render.com) -> GitHub bilan kiring.
2. **Dashboard -> New + -> Blueprint**.
3. Repo'ni tanlang -> Render ildizdagi `render.yaml` ni o'qiydi -> **Apply**.
4. `xauview` nomli Docker web service yaratiladi; build 3-6 daqiqa davom etadi
   (python:3.11-slim + 3 ta pip paket).
5. Blueprint keyinchalik `master` ga har push'da avtomatik qayta deploy qiladi
   (`autoDeploy: true`).

### 3.3. Environment (render.yaml o'zi qo'yadi)

Agar qo'lda kiritish kerak bo'lsa — Service -> **Environment**:

| Kalit | Qiymat | Izoh |
|---|---|---|
| `XAUVIEW_DATA` | `open` | MT5 yo'q, open provayderlar |
| `XAUVIEW_OPEN_POLL_S` | `15` | narx so'rovi oralig'i (sek); egress tejaydi |
| `PYTHONUNBUFFERED` | `1` | loglar darhol ko'rinadi |
| `PORT` | — | **qo'lda yozmang**, Render o'zi beradi |

### 3.4. Deploy va URL

Deploy logida quyidagilar ko'rinadi:

```
Data mode: open - MT5 O'CHIRILGAN ... Open provayderlar ishlatiladi.
Uvicorn running on http://0.0.0.0:10000
```

Tayyor manzil (Render beradi):

- Sayt: `https://xauview.onrender.com`
- Health: `https://xauview.onrender.com/api/health`
- Agar `xauview` nomi band bo'lsa: `https://xauview-ab12.onrender.com`
  (`render.yaml` dagi `name` ni o'zgartirib qayta deploy qilsa ham bo'ladi).

Health javobi (Render'da `mt5` doim `false` — bu **normal**):

```json
{"ok": true, "mt5": false, "data_mode": "open", "mt5_available": false,
 "open_available": true, "symbols": ["XAUUSD", "GBPUSD"], "version": "1.0.0"}
```

### 3.5. Keep-alive secret (uyquga ketmasin)

GitHub repo -> **Settings -> Secrets and variables -> Actions -> New repository secret**:

- Name: `RENDER_URL`
- Value: `https://xauview.onrender.com`

Keyin **Actions -> Render keep-alive -> Run workflow** bilan qo'lda bir marta sinab ko'ring.
Workflow har 10 daqiqada `/api/health` ni uradi (90 s timeout, 3 urinish).

### 3.6. Tekshirish

Lokal (Linux + MT5'siz simulyatsiya, 8766-port, mavjud 8765 serverga tegmaydi):

```
cd D:\Project\AI\tvclone\server
D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe test_render_local.py
```

Kutilgan natija: `JAMI: 24/24 PASS` (quyida bugungi natija).

Masofadagi (deploy bo'lgan) serverni tekshirish:

```
python test_render_local.py --url https://xauview.onrender.com
```

Qo'lda tezkor tekshiruv:

```
curl https://xauview.onrender.com/api/health
curl "https://xauview.onrender.com/api/candles?symbol=XAUUSD&tf=M1&count=60"
curl https://xauview.onrender.com/api/providers
```

## 4. Free plan cheklovlari

| Parametr | Free qiymat | Oqibati |
|---|---|---|
| RAM / CPU | 512 MB / 0.1 CPU | FastAPI + uvicorn uchun yetarli (~120-180 MB) |
| Uyqu | 15 daqiqa harakatsizlikdan keyin | keep-alive kerak (3.5) |
| Cold start | ~30-50 s | birinchi so'rov/WS shuncha kutadi |
| Instance-soat | **750 h/oy** | 24/7 (730 h) sig'adi |
| Egress | ~100 GB/oy | poll 15 s da ~20 GB ishlatiladi (8-bo'lim) |
| Disk | ephemeral | restart/deploy'da fayllar yo'qoladi (alerts.json ham) |
| MetaTrader5 | **yo'q** (Linux) | faqat open manbalar |
| Deploy | push -> auto | 3-6 daqiqa build |

## 5. Keep-alive va 750 soat matematikasi

- 1 oy = 730 soat (31 kun). Free limit = 750 instance-soat -> **24/7 uchun 20 soat zaxira**.
- `*/10 * * * *` cron = kuniga 144 ping, oyiga ~4320 ta so'rov — bepul.
- Muhim: 750 h **workspace** bo'yicha. Bitta free service bilan 24/7 bemalol.
- GitHub schedule ba'zan 5-15 daqiqaga kechikadi; ping 10 daqiqada bir bo'lgani uchun
  15 daqiqalik uyqu oynasiga baribir sig'adi.
- Qo'shimcha kafolat (ixtiyoriy): [UptimeRobot](https://uptimerobot.com) free plan —
  5 daqiqada bir `/api/health` ni uradi. GitHub cron ishlamay qolsa (public repo
  60 kun harakatsiz bo'lsa schedule o'chadi) shu zaxira bo'ladi.

## 6. WebSocket ulanish

```
wss://xauview.onrender.com/ws?symbol=XAUUSD&tf=M1
```

- `symbol`: `XAUUSD`, `GBPUSD`
- `tf`: `M1`, `M3`, `M5`, `M15`, `H1`, `H4`, `D1`
- Ulanishda **snapshot** (600 bar) keladi, keyin **tick** (0.3 s) va `alert` xabarlari.
- Server 0.3 s da tick yuboradi -> Render'ning WebSocket idle timeout'i muammo emas.

Brauzerda (JS):

```js
const ws = new WebSocket('wss://xauview.onrender.com/ws?symbol=XAUUSD&tf=M1');
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.type === 'snapshot') console.log(m.bars.length, m.provider); // 600, "yahoo"
  if (m.type === 'tick')     console.log(m.price, m.provider);
};
```

Python bilan:

```python
import asyncio, json, websockets

async def main():
    async with websockets.connect("wss://xauview.onrender.com/ws?symbol=XAUUSD&tf=M1") as ws:
        snap = json.loads(await ws.recv())
        print(snap["type"], len(snap["bars"]), snap["provider"])
        tick = json.loads(await ws.recv())
        print(tick["type"], tick["price"], tick["provider"])

asyncio.run(main())
```

REST endpointlar:

| Endpoint | Vazifasi |
|---|---|
| `GET /` | mobil ilova (`mobile/index.html`) |
| `GET /api/health` | health + data_mode (Render health check shu) |
| `GET /api/candles?symbol=XAUUSD&tf=M1&count=600` | barlar (open provayder) |
| `GET /api/providers` | provayderlar holati, `open_ticks` |
| `POST /api/provider` | tanlash: yahoo / stooq / goldapi / mt5 |
| `GET, POST, DELETE /api/alerts` | alertlar (fayl, ephemeral) |

## 7. Mobil ilovada manzilni kiritish

**A variant (eng oson).** Telefon brauzerida `https://xauview.onrender.com` ni oching.
Ilova manzilni o'zi aniqlaydi (`feedBase()` -> `wss://xauview.onrender.com`).
"Add to Home Screen" bilan PWA kabi o'rnatib qo'yish mumkin.

**B variant (APK / oflayn HTML).** Ilovada:

1. Yuqori o'ngdagi **⋮ (Menyu)** tugmasini bosing.
2. **Manba** qatoridagi maydonga yozing: `wss://xauview.onrender.com`
   (faqat host; `/ws?symbol=...` ni ilova o'zi qo'shadi).
3. **Ulanish** tugmasini bosing. Manzil `localStorage['xauview.feed']` da saqlanadi.
4. Holat **LIVE** bo'lguncha kuting. Cold start bo'lsa 30-50 s kutish kerak
   (server uyg'onmoqda), keyin LIVE yonadi.

Eslatma: HTTPS sahifadan `ws://` ga ulanib bo'lmaydi — shuning uchun Render'da
doim `wss://` ishlatiladi.

## 8. Egress va CPU byudjeti (nima uchun poll 15 s)

Yahoo javob o'lchamlari (o'lchandi): quote ~59 KB, M1 barlar (5 kun) ~429 KB.

| Nima | Chastota | Taxminiy oylik trafik |
|---|---|---|
| 2 symbol quote (poll 15 s) | 8 so'rov/daq | ~20 GB/oy |
| 2 symbol quote (poll 30 s) | 4 so'rov/daq | ~10 GB/oy |
| WS snapshot (5d M1) | ulanishda | ~430 KB/ulanish |
| WS bar refresh (15 s) | faqat klient ulanganda | ~10 GB/oy (1 doimiy klient) |

Free limit ~100 GB/oy -> 15 s bilan ham sig'adi. Trafikni kamaytirish:
`XAUVIEW_OPEN_POLL_S=30` qo'ying (narx 30 s da yangilanadi, bar yopilishi baribir
M1 tick bilan to'g'rilanadi).

## 9. Lokal test natijasi (2026-11-16, Windows, MT5 bloklangan)

```
JAMI: 24/24 PASS, 0 FAIL (4.4 s)
WS snapshot: 600 bar, provider=yahoo; WS tick: price=3864.8, provider=yahoo
/api/candles: 100 bar, provider=yahoo; /api/health: data_mode=open, mt5=false
GET /: 200 text/html (1.46 MB mobil ilova)
```

Docker image bu mashinada **build qilinmagan** (Docker o'rnatilmagan); Linux'dagi
xatti-harakat MT5 bloklangan holda `test_render_local.py` bilan tekshirildi.
Render'dagi birinchi build logi shu sababli kuzatilishi tavsiya etiladi.

## 10. Lokal Docker (ixtiyoriy, Docker o'rnatilgan bo'lsa)

```
cd D:\Project\AI\tvclone
docker build -f server/Dockerfile -t xauview .
docker run --rm -p 8080:8080 -e XAUVIEW_DATA=open xauview
# http://127.0.0.1:8080/api/health
```

## 11. Muammolar / FAQ

| Belgi | Sabab / yechim |
|---|---|
| `/api/health` 200, `mt5:false` | Normal: Render Linux'da MT5 yo'q |
| `/api/candles` -> 503 | barcha open provayderlar javob bermadi; `/api/providers` -> `last_err` |
| `active` uzoq vaqt `mt5` | hali biror provayder muvaffaqiyatli javob bermagan; 5-10 s kuting |
| Yahoo javob bermayapti | Render IP'si bloklagan bo'lishi mumkin; zaxira stooq (quote + D1), goldapi (XAU spot). Loglarda `open quote ... xato` |
| Birinchi ochilish juda sekin | Free cold start 30-50 s; keep-alive uyg'oq tutadi |
| Instance o'chdi | 750 h/oy tugagan yoki deploy fail; Dashboard -> Logs |
| Alertlar yo'qoldi | `alerts.json` ephemeral diskda; restart/deploy'da tozalanadi |
| WS ulanmayapti | `https://` sahifada `wss://` ishlating; `wss://<app>.onrender.com/ws?symbol=XAUUSD&tf=M1` |
| Nom band | `render.yaml` -> `name` o'zgartiring (masalan `xauview-uz`), qayta deploy |

## 12. Xavfsizlik / cheklovlar

- CORS `*`, autentifikatsiya yo'q — server **ommaviy**. Faqat chart + alert, savdo yo'q.
- Alerts API'ni istalgan odam o'zgartira oladi — shaxsiy foydalanish uchun OK, lekin
  maxfiy ma'lumot yubormang.
- Free plan SLA bermaydi; kritik ish uchun pullik instance.

## 13. Foydali havolalar

- Render Blueprint spec: https://render.com/docs/blueprint-spec
- Render Docker deploy: https://render.com/docs/docker
- Render free limits: https://render.com/docs/free
- GitHub Actions cron: https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#schedule

## 14. DEPLOY QILINDI (2026-11-16)

| Narsa | Qiymat |
|---|---|
| Repo | https://github.com/ArcadiaUZ/trading-platform (branch `main`) |
| Render service | `srv-dbtka4d9fdbs73bgv800` (`xauview`), frankfurt, free, docker |
| URL | **https://xauview.onrender.com** |
| Deploy | `dep-dbtka4t9fdbs73bgva0g` — **live** (build 42 s) |
| Dashboard | https://dashboard.render.com/web/srv-dbtka4d9fdbs73bgv800 |
| Keep-alive | `.github/workflows/keepalive.yml` — `active`, URL standart qiymat bilan yozilgan |

API orqali yaratish (takrorlash uchun):

```bash
curl -X POST https://api.render.com/v1/services \
  -H "Authorization: Bearer $RENDER_API_KEY" -H "Content-Type: application/json" \
  -d '{"type":"web_service","name":"xauview","ownerId":"<tea-...>",
       "repo":"https://github.com/ArcadiaUZ/trading-platform","branch":"main","autoDeploy":"yes",
       "envVars":[{"key":"XAUVIEW_DATA","value":"open"},{"key":"XAUVIEW_OPEN_POLL_S","value":"15"}],
       "serviceDetails":{"env":"docker","plan":"free","region":"frankfurt",
         "healthCheckPath":"/api/health",
         "envSpecificDetails":{"dockerContext":".","dockerfilePath":"./server/Dockerfile"}}}'
```

### 14.1 Tekshirildi (internetdan, localhost emas)

- `GET /api/health` -> 200, 0.9 s, `{"ok":true,"mt5":false,"data_mode":"open","open_available":true}`
- `GET /api/providers` -> `yahoo ok, latency 157 ms`
- `GET /api/candles?symbol=XAUUSD&tf=M1` -> real narx 3858.9, `provider=yahoo`
- `GET /` -> 1 470 231 B, `XAUView Mobile` (mobil ilova o'zi shu serverdan beriladi)
- `wss://xauview.onrender.com/ws?symbol=XAUUSD&tf=M1` -> **snapshot 600 bar**, 26.8 KB
- Chrome (Xiaomi 12 viewport 393x873): **600 bar, YAHOO chip, LIVE, 0 console error**
  -> `shots/r20-render-live.png`

### 14.2 Telefonda qanday ochiladi

Ilova **hech qanday sozlashsiz** shu manzilda ishlaydi: `_m4_ui.js` dagi `base()`
`https://` bo'lsa avtomatik `wss://location.host` ni tanlaydi. Ya'ni telefon brauzerida
https://xauview.onrender.com ni ochish kifoya. APK'da ham "Menyu -> Manba" ga yozish shart emas,
lekin qulaylik uchun yozib qo'yish mumkin: `wss://xauview.onrender.com`.

### 14.3 Free tier cheklovlari (halol)

- 750 h/oy (30 kun = 720 h) -> keept-alive bilan 24/7 sig'adi.
- Instance 15 daqiqa harakatsizlikdan keyin uxlaydi -> keepalive cron 10 daqiqada uradi.
- GitHub schedule ba'zan 5-15 daqiqa kechikadi; muhim bo'lsa UptimeRobot qo'shing.
- GitHub 60 kun repo'da aktivlik bo'lmasa schedule workflow'ni o'chirib qo'yadi ->
  oyda bir marta repo'ga commit qiling.
- Egress 100 GB/oy (poll 15 s -> ~20 GB/oy).
- Birinchi so'rovda cold start ~30-50 s bo'lishi mumkin.
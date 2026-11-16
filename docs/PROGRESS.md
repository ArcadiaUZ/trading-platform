# PROGRESS / HANDOFF — XAUView (TradingView-uslub platforma)

**Oxirgi yangilanish:** 2026-11-16 10:35 (UTC+5) · **Loyiha:** D:\Project\AI\tvclone
**Holat:** P0 ✅ · P1 ✅ (desktop demo) · P2 ⚙️ (live feed + mobil app ishlayapti, sayqal qolgan)

---

## 0. TL;DR — hozir nima ishlaydi

| Nima | Holat | Qayerda |
|---|---|---|
| TradingView-uslubidagi **desktop demo** (1 fayl) | ✅ ishlaydi, oflayn | `demo/xauview-demo.html` (1.35 MB) |
| **Mobil app** (Xiaomi 12 393x873, black tema default) | ✅ ishlaydi, live | `mobile/index.html` (1.35 MB) |
| **Live feed server** (MT5 → WS, 0.3 s) | ✅ ishlayapti, PID 7204, port 8765 | `server/app.py` |
| **Alert tizimi** (narx alerti → WS → toast + Notification) | ✅ testdan o'tdi | `server/app.py` + `mobile` |
| **APK dizayn tokenlari + 124 ikonka** | ✅ o'lchandi/dekod qilindi | `docs/DESIGN-TOKENS.md`, `assets/apk-icons/` |

**Sinovdan o'tgan faktlar (o'lchangan, taxmin emas):**
- WS dan 0.3 s da tick keladi; 5 tick ketma-ket test qilindi (XAUUSD M1 va GBPUSD M15).
- Snapshot 600 bar; joriy bar H/L/C jonli yangilanadi.
- Symbol/TF almashganda reconnect ishlaydi (generation guard bilan race tuzatildi).
- Alert: POST → server narxni kuzatadi → trigger → WS `type:alert` → appda toast + qo'ng'iroq (notify) — E2E test PASS.
- Mobil gesture testlari (CDP touch): tap (crosshair+tooltip), 1 barmoq pan, 2 barmoq pinch zoom, dbl-tap fit, drag bilan rectangle chizish — hammasi PASS, 0 JS xato.

---

## 1. Qanday ishga tushirish

### Live server (kompyuterda)
```powershell
cd D:\Project\AI\tvclone\server
pwsh -File run.ps1          # yoki: & 'D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe' -m uvicorn app:app --host 0.0.0.0 --port 8765
```
- Health: http://127.0.0.1:8765/api/health
- **LAN IP (telefon uchun): http://10.149.101.17:8765** (Wi-Fi; IP o'zgarishi mumkin — `Get-NetIPAddress`)
- MT5 terminal **ochiq va ulangan** bo'lishi shart (demo hisob 474932446, Exness).
- Hozir server **ishlab turadi** (PID 7204, 0.0.0.0:8765). O'chib qolsa — run.ps1 bilan qayta ko'tar.

### Telefon
1. Telefon kompyuter bilan **bir Wi-Fi**da bo'lsin.
2. Brauzerda `http://10.149.101.17:8765` ochish.
3. Yuqori o'ng menyu → "Bildirishnoma" (lekin pastga qarang: HTTPS cheklovi).

### Desktop demo (statik, serversiz)
`demo/xauview-demo.html` ni ikki marta bosish — oflayn ishlaydi (MT5 snapshot ichida).

---

## 2. Fayl xaritasi

```
D:\Project\AI\tvclone\
├─ docs/
│  ├─ PLAN.md                (reja + bajarilgan P0/P1 + P2)
│  ├─ PROGRESS.md            ← shu fayl (handoff)
│  ├─ STATE.json             ← mashina o'qiydigan holat
│  └─ DESIGN-TOKENS.md       (APK'dan o'lchangan 257 token, 453 satr)
├─ demo/
│  ├─ xauview-demo.html      (desktop demo, 1.35 MB, 3 tema)
│  ├─ data.json              (MT5 snapshot: 2 asset x 7 TF)
│  ├─ README.md
│  └─ src/                   (_p1_head.html, _p2_ind.js, _p3_engine.js, _p4_draw.js, _p5_ui.js, assemble.js)
├─ mobile/
│  ├─ index.html             (mobil app, 1.35 MB, black default, live)
│  ├─ manifest.webmanifest
│  ├─ data.json              (oflayn fallback, demo bilan bir xil)
│  └─ src/                   (_m1_head.html, _p2_ind.js, _m3_chart.js, _m4_ui.js, _m5_feed.js, assemble.js)
├─ server/
│  ├─ app.py                 (FastAPI: REST + WS + alerts + static)
│  ├─ README.md, run.ps1, test_feed.py, alerts.json, *.log
├─ assets/apk-icons/         (124 ikonka: png + svg + sheet.png + manifest.json)
└─ shots/                    (skrinshotlar, pastda indeks)
```

**Build:** har qanday `src/*.js|html` o'zgarishdan keyin:
`node demo/src/assemble.js` yoki `node mobile/src/assemble.js` (yagona html qayta yig'iladi).

---

## 3. Mobil app: nima bor

- **Tema:** black (APK'dan o'lchangan: #000000 fon, #0F0F0F panel, up #22AB94, down #F7525F, accent #2962FF) + light.
- **Asset:** OANDA:XAUUSD, FXCM:GBPUSD · **TF:** D1 H4 H1 M15 M5 M3 M1.
- **Chart:** sham + volume pane, crosshair + tooltip, oxirgi narx, grid, watermark, LIVE/OFFLINE badge.
- **Indikator (ASIA-FU 3-IN-1):** Asian box + BSL/SSL + pips, killzones, sweeps, FVG, FU/SFU/AFU zonalari (joriy + H4), volume toggle.
- **Touch gesture lar:** 1 barmoq pan (vaqt + narx), 2 barmoq pinch (vaqt + narx zoom), tap (crosshair+OHLC tooltip), dbl-tap (auto-fit), asbob tanlansa drag bilan chizish / 2 marta bosish, chizmani sudrash, o'ng o'qda vertikal drag (price scale), pastki o'qda gorizontal drag (time scale).
- **Chizmalar:** trendline, rectangle, horizontal, vertical, text + undo/redo/delete/clear; per-symbol localStorage.
- **Sheet lar:** Asset, Timeframe, Indikatorlar (toggle + tema), Asboblar, Alertlar, Menyu (server URL + bildirishnoma).
- **Alertlar:** price above/below + izoh; triggerda toast + Notification (ruxsat bo'lsa) + beep + vibrate; bell ikonkasida qizil nuqta.

---

## 4. Ochiq qarorlar / cheklovlar (muhim)

1. **OANDA/FXCM real API:** hozir ma'lumot **MT5 (Exness demo)** dan; `OANDA:`/`FXCM:` — faqat feed **yorlig'i**. Real feed uchun API kalit kerak:
   - **OANDA v20** — bepul practice akkaunt token'i (o'zi ro'yxatdan o'tib oladi), REST/stream, XAUUSD bor.
   - **FXCM** — FXCM hisobi bo'lsa REST API; bo'lmasa alternativa kerak.
2. **Telefon bildirishnomasi HTTPS talab qiladi** (Notification API/PWA faqat secure context'da). `http://10.149.101.17:8765` da faqat **sahifa ichidagi toast** ishlaydi. Yechim variantlari: (a) `cloudflared tunnel --url http://localhost:8765` → https URL, (b) ngrok, (c) keyinchalik Capacitor bilan APK wrapper (haqiqiy system notification). **Qaror kutilmoqda.**
3. **Feed ETI:** user "real feed, har 0.3 s" dedi — bajarildi (MT5 orqali). Agar 0.3 s OANDA/FXCM bo'lishi shart bo'lsa — kalitlar kerak.
4. **Desktop demo default temasi** hali web-dark (#131722); user "qora tema default (2-rasm = app/o'lchangan)" dedi → mobil app'da shunday, **desktop demo'da ham default qilish kerak** (kichik ish).
5. **Replay kerak emas** (user aytdi) — rejadan chiqarildi.
6. **TV gesture to'liqligi:** long-press (barmoqni bosib turib o'lchash) hali yo'q; 2 barmoq tap yo'q; crossing gesture yo'q. Qolgan asosiylari bor.
7. **Ikonkalar:** APK'dan 124 ta ikonka ajratilgan, lekin mobil toolbar hali o'z SVG'larimiz bilan. Ularni almashtirish — keyingi ish.
8. **PWA:** manifest bor, lekin icon va service worker yo'q → "Add to home screen" to'liq ishlamaydi.

---

## 5. Keyingi qadamlar (prioritet bo'yicha)

| # | Ish | Taxmin | Izoh |
|---|---|---|---|
| 1 | **HTTPS tunnel** (cloudflared) + Notification sinovi telefonda | 20-30 daq | Telefon bildirishnomasi uchun shart |
| 2 | Mobile: **long-press** o'lchash/kesishxair, gesture polish, haptika | 30-60 daq | TV mobile parity |
| 3 | **APK ikonkalarini** mobil toolbar + sheet larga qo'llash | 30 daq | assets/apk-icons/svg |
| 4 | Desktop demo default = black (app) tema | 10 daq | kichik |
| 5 | Alert turlarini kengaytirish: Asia sweep, zona teginishi, indikator sharti | 1-2 soat | server tomonda |
| 6 | PWA icons + sw.js (offline cache, install) | 30 daq | |
| 7 | **OANDA adapter** (kalit kelganda) — serverda provider abstraksiyasi | 2-3 soat | kalit kutilmoqda |
| 8 | Fib/Gann/brush chizma guruhlari (mobil + desktop) | 3-4 soat | P4 |
| 9 | Docker/Windows Task Scheduler bilan serverni avtomatik ishga tushirish | 1 soat | |

**Replay YO'Q (user).** Savdo/order qatlami hali yo'q — faqat chart + alert.

---

## 6. Sessiya/atrof-muhit faktlari

- Server: `0.0.0.0:8765`, PID **7204**, loglar `server/server.log`, `server/uvicorn.*.log`.
- LAN IP: **10.149.101.17** (Wi-Fi).
- Python: `D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe` (MetaTrader5, fastapi, uvicorn o'rnatilgan).
- MT5: Exness-MT5Trial15, demo 474932446, `XAUUSDm` va `GBPUSDm`, build 6311.
- Teammate'lar: `design-scout` — tugagan (tokenlar/ikonkalar); `feed-server` — hozir ham "running" (testlar/README yozdi; server jarayoni ishlab turibdi).
- tvclone hali **git repo emas** (kerak bo'lsa: git init + GitHub'ga).

---

## 7. Skrinshotlar indeksi (`shots/`)

| Fayl | Nima |
|---|---|
| `e20-h4.png`, `e22-gbp-d1.png` | Desktop demo: web-dark H4, D1 |
| `f32-app-m15.png`, `f33-app-h4.png` | Desktop demo: **o'lchangan black** tema |
| `d12-draw.png` | Desktop: rectangle + trendline + measure |
| `m51-live2.png` | **Mobil: LIVE** XAUUSD M1 (black) |
| `m52-alert.png` | Mobil: **alert toast** (ALERT: XAUUSD yuqoridan...) |
| `m57-gbp-live.png`, `m58-gbp-live2.png` | Mobil: GBPUSD M15 live |
| `m53-h1.png`, `m54-h4.png` | Mobil: H1/H4 |
| `m40-portrait.png`, `m43-rect.png` | Mobil: oflayn rejim, rectangle chizilgan |
| `m44-tf-sheet.png`, `m45-alerts-sheet.png`, `m46-ind-sheet.png` | Mobil sheet lar |
| `m56-landscape.png` | Mobil landscape |
| `assets/apk-icons/sheet.png` | APK'dan 124 ikonka |


---

## 8. Scratch / vaqtinchalik fayllar (kerak bo'lmasa o'chirish mumkin)

- `mobile/_test_*.js`, `mobile/_dbg*.js`, `mobile/_extract.js`, `mobile/_check.js`, `mobile/_probe_ws.py` — CDP/touch/sintaksis testlari (qayta ishlatish mumkin).
- `demo/_test*.js`, `demo/_dbg.js` — desktop demo testlari.
- `mobile/src/_patch*.js`, `mobile/src/_fix*.js` — bosqichli patch skriptlari (tarix uchun qoldirildi).
- `work/` — design-scout'ning APK decode ish papkasi (venv + base.apk + decoded.json). ~1 GB bo'lishi mumkin; APK'ni qayta dekod qilish kerak bo'lmasa o'chirsa bo'ladi.
- `server/alerts.json` — joriy alertlar (testlardan keyin bo'sh bo'lishi kerak).


---

## 9. v3 sessiya (11:05-17:05) — nima qo'shildi

### 9.1 APK ikonkalari mobil UI da (tayyor)
- `mobile/src/_m1_head.html`: APK'dan ajratilgan 32 ta SVG ikonka inline `APKICONS` map sifatida (head ichida `<script>`), + `apkIcon(name, cls)` va `applyIcons()` helper.
- Bottom bar (`Cross/Trend/H-Line/Rect/Yana`), top bar (indikatorlar/qo'ng'iroq/menyu), Asboblar sheet (6 asbob + Undo/Redo/Tozalash) — hammasi haqiqiy TradingView ikonkalari.
- Ikona to'plami: `ic_cross_line_drawings`, `ic_trend_line_drawings`, `ic_horizontal_line_drawings`, `ic_rectangle_drawing_drawings`, `ic_alert_bell`, `ic_indicators_shown`, `ic_chart_native_panel_undo/redo`, `ic_chart_context_menu_trash`, ...

### 9.2 Long-press + lupa (kattalashtiruvchi oyna) — tayyor
- 380 ms harakatsiz bosish -> crosshair barga yopishadi + **lupa** (radius 58, zoom 2.6) barmoqdan 96 px yuqorida ochiladi.
- Lupa ichida: chart nusxasi kattalashtirilgan, kesishgan chiziqlar, pastda narx badge.
- Barmoqni sudrash -> crosshair lupa bilan birga harakatlanadi (pan bo'lmaydi); qo'yib yuborish -> lupa yopiladi.
- Haptik: `navigator.vibrate(14)`.
- Test (CDP touch): pan/cross/long-press/drag-while-held/release/tap — hammasi PASS, 0 JS xato.

### 9.3 Desktop demo default tema = black (o'lchangan APK temasi) — tayyor
- `demo/src/_p2_ind.js`: `S.theme = 'app'`; `demo/src/_p5_ui.js`: `init()` da `applyTheme(S.theme)`.
- Natija: `body.class = 'dark apptheme'`, bg `rgb(0,0,0)`. Skrinshot: `shots/e23-black.png`.

### 9.4 PWA (pwa-tunnel teammate)
- `mobile/icons/`: icon-192, icon-512, icon-512-maskable, apple-touch-icon (180), favicon-32.
- `mobile/manifest.webmanifest` qayta yozildi (XAUView, standalone, uz, 3 icon).
- `mobile/sw.js`: navigation = network-first, ikonka/manifest = cache-first, `/api/` va `/ws` hech qachon keshlanmaydi.
- `mobile/src/_m6_pwa.js`: SW registratsiya + `window.__PWA = {supported, secure, perm, request(), notify()}`; Android Chrome uchun `reg.showNotification` ishlatiladi.
- `mobile/src/_m4_ui.js`: `notify()` va `askNotify()` endi `__PWA` orqali (Android'da `new Notification` ishlamaydi).

### 9.5 HTTPS tunnel (telefon bildirishnomasi uchun)
- `work/cloudflared.exe` quick tunnel: `cloudflared tunnel --url http://127.0.0.1:8765`.
- Joriy URL: `server/tunnel-url.txt` (quick tunnel URL **vaqtinchalik** — jarayon qayta ishga tushsa o'zgaradi).
- Health: `https://<tunnel>/api/health` -> ok:true.

### 9.6 Sessiya testlari (yangi)
| Test | Natija |
|---|---|
| Mobil ikonkalar (bottom 5 + top 3 + sheet 9) | PASS |
| Long-press lupa (CDP touch) | PASS |
| Pan / tap / drag-while-held regressiya | PASS |
| Desktop demo black default | PASS (`theme=app`, bg #000000) |
| JS xatolar (mobil + desktop) | 0 |

### 9.7 Yangi skrinshotlar
| Fayl | Nima |
|---|---|
| `m60-icons.png` | Mobil: APK ikonkalar bilan bottom/top bar |
| `m62-loupe.png` | Mobil: long-press lupa (kattalashtiruvchi oyna) |
| `m63-tools-sheet.png` | Mobil: Asboblar sheet, APK ikonkalari |
| `m64-menu-sheet.png` | Mobil: Menyu sheet |
| `e23-black.png` | Desktop demo: black tema default |

### 9.8 Qolgan ishlar (prioritet)
1. **Alert turlari** (feed-server bajaradi): zone / sweep / session + mobil UI tanlash interfeysi.
2. PWA offline + notification telefonda sinash (pwa-tunnel), `docs/PWA-HTTPS.md`.
3. Fib/Gann/brush chizma guruhlari (APK'da 60+ chizma ikonkasi bor — hammasi `assets/apk-icons/`).
4. OANDA/FXCM real feed adapter (kalit kerak).
5. Server autostart (Task Scheduler) + tunnel autostart (cloudflared o'lsa URL o'zgaradi).

## 10. v4 sessiya — chizma asboblari va alert turlari

### 10.1 Fib retracement + O'lchov (measure) — tayyor
`mobile/src/_m3_chart.js`:
- `FIB_LV = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]`; `type:'fib'` chizmasi — gorizontal level chiziqlar, chapda level, o'ngda narx, 0-1 oralig'i to'ldirilgan, vertikal chegara chiziqlari.
- `type:'measure'` — narx deltasi, foiz va bar soni badge bilan (TV 'Date and price range' uslubida).
- Ikkalasi ham: 2 nuqta bilan chiziladi, tanlanadi, sudraladi, undo/redo, localStorage.
- Asboblar sheet'iga `Fibo` (`ic_fib_retracement_drawings`) va `Olchov` (`ic_measure_drawings`) qo'shildi.

### 10.2 Alert turlari (mobil UI) — tayyor
Yangi modul: **`mobile/src/_m7_alerts.js`** (assemble parts oxirida; `_m4_ui.js` dagi `renderAlerts`/`onAlert` ni almashtiradi).
- Turlar: **Narx** (>= / <=), **Zona** (lo-hi, TF M5/M15/H1, nom, 'qayta qurollansin' switch), **Asia sweep**, **Sessiya** (London/NY).
- Ro'yxat: har tur uchun APK ikonka, holat (kutmoqda/ishlagan), masofa (`ichida` yoki digits bo'yicha), server `message` ko'rsatiladi.
- `postAlert()` — umumiy POST; `httpBase()` qo'shildi: `ws://` -> `http://`, `wss://` -> `https://` (avval REST chaqiruvlari `ws://` bilan ketib **ishlamayotgan edi** — tuzatildi).
- `onAlert()` endi `{type:'alert', alert:{...}}` konvertni ham, tekis ob'ektni ham qabul qiladi.
- `notify()` va `askNotify()` `window.__PWA` orqali (Android Chrome `new Notification` ni bloklaydi).

E2E test (Chrome headless, CDP): 3 tur uchun POST -> **200**, ro'yxat to'g'ri render, keyin DELETE bilan tozalandi, 0 JS xato.

### 10.3 HTTPS tunnel (quick tunnel) — ishlaydi
- URL: `server/tunnel-url.txt` (hozir `https://picture-shoulder-notifications-atlas.trycloudflare.com`)
- `cloudflared` PID 12636, log `work/cloudflared.log`.
- http va https ikkalasida smoke test: **LIVE, SW registratsiya 1, 8 APK ikonka, 0 xato**.
- https'da `isSecureContext=true` -> system notification yoqiladi; http LAN'da faqat toast.

### 10.4 Sessiya testlari (v4)
| Test | Natija |
|---|---|
| Fib + measure chizish (CDP drag) | PASS (`items=['fib','measure']`) |
| Alert sheet 4 tur | PASS |
| Zone/sweep/session POST | PASS (200, ro'yxatda ko'rindi) |
| http + https smoke | PASS (LIVE, SW 1, 0 JS xato) |

### 10.5 Ochiq kichik ishlar (feed-server'ga yuborildi)
1. Killzone vaqtlari chart bilan moslansin: London **11:30**, NY **16:30** (hozir serverda 12:00/17:00).
2. Sweep alert: POST dan keyin `range`/`sides` darhol to'ldirilsin (hozir bo'sh).
3. Zone alert: ixtiyoriy `on_cross` (faqat tashqaridan kirganda trigger) — hozir narx ichkarida bo'lsa darhol ishlaydi.

### 10.6 Yangi skrinshotlar
| Fayl | Nima |
|---|---|
| `m65-fib.png` | Fib retracement levels bilan |
| `m66-measure.png` | O'lchov asbobi (delta/foiz/bar) |
| `m67-alert-price.png` | Alert sheet, Narx turi |
| `m68-alert-zone.png` | Alert sheet, Zona turi |
| `m69-alert-sweep.png` | Alert sheet, Asia sweep |
| `m70-alert-list.png` | 3 turdagi alertlar ro'yxati |

### 10.7 Barqarorlik: feed watchdog (v7)
- `_m5_feed.js`: `startFeedWatchdog()` — har 8 s tekshiradi: WS yopilgan (readyState 3) yoki 25 s dan ko'p xabar kelmasa `reconnectNow()`. `visibilitychange` (tab/fon -> ko'rinadigan) da ham qayta ulanadi.
- `FEED.lastMsg` har xabarda yangilanadi.
- Sabab: testda bir marta badge OFFLINE'da qolib ketdi (qayta tiklanmagan holat) — endi o'zi tiklanadi. Qayta tekshiruv: GBPUSD H1 ga almashganda badge LIVE.

### 10.8 Alert REST bug fix (muhim)
- Avval `loadAlerts/addAlert/delAlert` `feedBase()` qaytargan `ws://` manzilni ishlatardi -> REST chaqiruvlari `ws://host/api/alerts` ga ketib **muvaffaqiyatsiz** bo'lardi (mobil UI dan alert qo'shish ishlamasdi, faqat curl bilan ishlagan).
- `httpBase()` qo'shildi (`ws`->`http`, `wss`->`https`) va barcha REST chaqiruvlar shu orqali. E2E test: 3 turdagi alert POST -> 200, ro'yxatda darhol ko'rindi.

## 11. v5 sessiya — chart turlari, zona 'on_cross', server tuzatishlari

### 11.1 Chart turlari (5 ta) — tayyor
Yangi modul: **`mobile/src/_m8_charttype.js`** (`drawCandles` ni almashtiradi).
- **Shamlar** (default), **Hollow** (ichi bo'sh sham), **Barlar** (OHLC bar), **Chiziq** (close polyline, accent rang), **Area** (gradient to'ldirilgan).
- Menyu -> **Chart turi** qatori -> sheet'da 5 ta variant APK ikonkalari bilan (`ic_chart_type_candles_28`, `..._hollow_candles_28`, `..._bars_28`, `..._baseline_28`, `..._area_28`).
- Tanlov `localStorage['xauview.m.chart']` da saqlanadi; reloaddan keyin tiklanadi (test: PERSIST area PASS).
- APKICONS map 32 -> 41 ikonkaga kengaytirildi (chart turlari + lock/unlock/eye/trash).

### 11.2 Zona alert: `on_cross` (faqat kirish paytida) — tayyor
- Alert sheet'da zona turida 2 ta switch: **Faqat kirish paytida** (`on_cross`) va **Qayta qurollansin** (`repeat`).
- Server E2E: `on_cross:true` + narx zona ichida -> `status=armed` (darhol ishlamaydi); `on_cross` yo'q -> darhol `triggered`.

### 11.3 Server tuzatishlari (feed-server bajargan, tekshirildi)
- Killzone vaqtlari chart bilan moslandi: **London 11:30**, **NY 16:30** (UTC+5) — `target_ts` tekshirildi (2026-11-17 11:30).
- `sweep` alert POST'dan keyin darhol `range` qaytaradi: `{high:3900.428, low:3832.188, day:'2026-11-16'}` + `sides{bsl,ssl}`.
- `zone` uchun `on_cross` qo'shildi.

### 11.4 Yangi skrinshotlar
| Fayl | Nima |
|---|---|
| `m70-type-candles.png` | Shamlar |
| `m71-type-hollow.png` | Hollow shamlar |
| `m72-type-bars.png` | OHLC barlar |
| `m73-type-line.png` | Chiziq |
| `m74-type-area.png` | Area (gradient) |
| `m78-chart-sheet.png` | Chart turi sheet (APK ikonkalari) |

## 12. v6 sessiya — ray/arrow, on_cross UI, ishga tushirish skriptlari

### 12.1 Yangi chizma asboblari (mobil)
- **Ray** (`ic_ray_drawings`) — 2 nuqta, o'ngga cheksiz davom etadi (plotW gacha).
- **Streleka / Arrow** (`ic_arrow_drawings`) — trendline + uchida strelka boshi.
- Ikkalasi: chizish, tanlash, sudrash, undo/redo, localStorage.

### 12.2 Zona alert: `on_cross` UI
- Zona formida 2 switch: **Faqat kirish paytida** (`on_cross`) va **Qayta qurollansin** (`repeat`).
- Server E2E: `on_cross:true` + narx ichkarida -> `armed`; default -> darhol `triggered`.

### 12.3 Ishga tushirish skriptlari (yangi)
| Fayl | Vazifa |
|---|---|
| `server/start-all.ps1` | server + tunnel + health tekshiruvi (bitta buyruq) — sinovdan o'tdi |
| `server/tunnel-watch.ps1` | cloudflared o'lsa qayta ishga tushiradi, URL ni `tunnel-url.txt` ga yozadi |
| `server/install-autostart.ps1` | Windows Task Scheduler ga "XAUView Start" (ONLOGON) qo'shadi |
| `docs/RUNBOOK.md` | ishga tushirish/to'xtatish/diagnostika/tez-tez uchraydigan muammolar |

`start-all.ps1` natijasi (test): `[1/3] server allaqachon ishlayapti` -> `[2/3] tunnel PID 12636` -> `[3/3] lokal ok=True, tunnel ok=True`.

### 12.4 Yangi skrinshotlar
| Fayl | Nima |
|---|---|
| `m79-ray-arrow.png` | Ray + arrow chizmalari |
| `m80-zone-oncross.png` | Zona alert sheet: on_cross + repeat switchlari |

### Desktop parity — fib / measure / ray / date range (desktop demo)
- `demo/src/_p4_draw.js`: yangi **persistent** chizma turlari — **fib** (levels 0 / .236 / .382 / .5 / .618 / .786 / 1, 0–1 orasida alpha .07 to'ldirish, chapda level raqami, o'ngda narx, vertikal chegara chiziqlari), **measure** (diagonal + L shaklidagi yordamchi chiziqlar + badge: `+delta  +foiz%  N bar`), **daterange** (narx oralig'i `+delta (+foiz%)` + vaqt oralig'i `N bar  1h 05m`).
- **Ray** endi plot o'ng chetigacha cheksiz davom etadi (matematik kesishma + clip; avval 40 px bilan to'xtardi).
- Ikkalasi ham 2 nuqta bilan: drag (press-drag-release) yoki click-click; tanlash, sudrash (birinchi harakatda snapshot), undo/redo, `localStorage['xauview.drawings.v1.<SYM>']`.
- `TYPE_NAME` += `fib`, `measure`, `daterange`; shortcut: **F** fib, **M** measure, **D** daterange.
- `demo/src/_p5_ui.js`: rail + drawMenu'ga **Fib / Ray / Measure / Date range** — APK ikonkalari inline SVG (`ic_fib_retracement_drawings`, `ic_ray_drawings`, `ic_measure_drawings`, `ic_date_and_price_range_drawings`; `fill=currentColor`), har birida `title` tooltip + `.tip`.
- Mobil `mobile/src/_m3_chart.js` ga tegilmadi — desktop endi mobil bilan teng (fib/measure) va ustiga ray/daterange bor.
- Test (puppeteer-core, viewport 1440x900, file://): **22/22 PASS**, 0 `pageerror`, 0 `console.error`; reloaddan keyin 4 chizma tiklandi.
- Skrinshotlar: `e29-drawmenu.png`, `e30-fib.png`, `e31-measure.png`, `e32-ray.png`, `e33-daterange.png`, `e34-fib-selected.png`, `e35-reload.png`.


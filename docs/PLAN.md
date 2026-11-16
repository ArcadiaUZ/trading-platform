# R E J A — TradingView-uslubidagi savdo platformasi (XAUView)

**Sana:** 2026-11-16 · **Loyiha papkasi:** D:\Project\AI\tvclone
**Holat:** REJA (kod hali yozilmagan) — tasdiqlash kutilmoqda

---

## 0. Men tushunganim (talablar ro'yxati)

| # | Talab | Holat |
|---|-------|-------|
| 1 | TradingView'ga **99% o'xshash** savdo platformasi (dizayn + his-tuyg'u) | ✅ tushundim |
| 2 | **Asia-FU-Strategy.pine** indikatori platforma ichida ishlashi (Asia sweep + FU/SFU/AFU zonalari + CVD) | ✅ tushundim |
| 3 | Timeframe'lar: **D1, H4, H1, M15, M5, M3, M1** (aynan shu 7 tasi, M3 ham) | ✅ tushundim |
| 4 | **Chizish asboblari**: trendline, rectangle va shunga o'xshash barcha narsalar (horizontal/vertical line, ray, text, measure, fib...) | ✅ tushundim |
| 5 | Berilgan **tradingview-1-20-87-0-1002595.xapk** ilovasidan reverse engineering qilib, dizaynni aniq ko'chirish | ✅ tushundim |
| 6 | **Birinchi demo** — hammasi bitta **.html** faylda (server yo'q, ochib ko'rish uchun). Sen dizaynini ko'rasan va aytasan: shu yo'nalishda davom yoki yo'q | ✅ tushundim |
| 7 | Avval **reja**, keyin kod — "qay darajada tushunganingni bilmoqchiman" | ✅ tushundim (shu fayl) |
| 8 | (Kontekst) mavjud AI trading agent (MetaTrader 5 demo) buzilmasligi, prop akkauntga tegmaslik | ✅ tushundim |

**Bir jumlada:** senga TradingView'ning desktop versiyasiga o'xshash, XAUUSD grafigini 7 timeframe'da ko'rsatadigan, ustida Asia-FU indikatori ishlaydigan va trendline/rectangle kabi chizmalar chizish mumkin bo'lgan **o'z savdo platformang** kerak. Birinchi qadam — bitta HTML faylda ko'rinadigan demo.

---

## 1. Recon natijalari (papkani va xapk'ni allaqachon ochib ko'rdim)

Bu reja havoyi emas — quyidagilarni tekshirdim:

**1.1. XAPK tarkibi**

| Nima | Hajm | Izoh |
|---|---|---|
| tradingview-1-20-87-0-1002595.xapk | 52.1 MB | bu ZIP (XAPK) — 2 ta ichki APK |
| com.tradingview.tradingviewapp.apk | 114.7 MB | asosiy ilova, 4418 ta fayl |
| config.arm64_v8a.apk | 58 KB | faqat ARM64 uchun native konfig |

Ichida: **8 ta classes.dex** (~80 MB Kotlin/Java kod), **resources.arsc** (7.4 MB — rasm/color/string/dimension resurslari), **4066 res/** fayl (ikonkalar, drawable'lar), **res/font/roboto_flex.ttf**, **assets/** (chart WebView qismi).

**1.2. Eng muhim topilma — TV ilovasining chart qismi WebView'da**

APK ichida:
- assets/feature_chart_kotlin_js_client.js — 370 KB (Kotlin ↔ JS ko'prik)
- assets/chart.js — **0 bayt** (ya'ni chart kutubxonasi ilova ichida emas, ishga tushganda yuklab olinadi)
- assets/pushstream_js_client.js — 46 KB (real-time stream)
- assets/dark/index.html, assets/light/index.html — faqat captcha sahifasi

Ya'ni **grafikning o'zi TradingView'ning yopiq chart kutubxonasi**, u internetdan yuklanadi; ilova qobig'i (toolbar, panellar, menyular) esa **native Kotlin/Compose**. Bu shuni bildiradi: APK'dan tayyor chart kodini "olib qo'yib" ishlatib bo'lmaydi, lekin **dizayn o'lchovlarini, ranglarini, ikonkalarini, shriftini va xatti-harakat qoidalarini** aniq ajratib olish mumkin.

**1.3. Nimani APK'dan aniq olaman**

| Manba | Nima olinadi |
|---|---|
| resources.arsc | aniq rang kodlari (ARGB), theme, dimens (px), string'lar — aapt2/androguard bilan dekod qilinadi |
| res/font | Roboto Flex (OFL litsenziya — ishlatsa bo'ladi) |
| res/drawable (4066 ta) | toolbar ikonkalari, tool piktogrammalari (binary XML, dekod kerak) |
| classes.dex | chizish asboblari ro'yxati, default sozlamalar, TF ro'yxati, hotkey'lar, panel o'lchamlari (dex→smali→o'qish) |
| WebView chart | faqat runtime'da (MITM/CDP) ushlanadi — demo uchun **shart emas** |

**1.4. Yonma-yon topilma:** D:\Project\AI\tradelab — avval yasalgan "TradingView-uslubidagi" prototip (React + lightweight-charts, Binance, replay, 35 KB indikatorlar). U **lightweight-charts**'ga tayangan va TV'ga ~70% o'xshaydi, chizish asboblari yo'q. Undan **data-layer/replay g'oyalarini** olaman, lekin chart yadrosi yangi bo'ladi (sababi §4.2).

---

## 2. Muhim chegara (ochiq aytaman)

- TradingView — yopiq tijoriy mahsulot. **Uning kodini, ikonkalarini, shrift assetlarini, nomi/logotipini ko'chirib olmayman va tarqatmayman.** Reverse engineering faqat **o'lchov va ranglarni aniqlash** (interoperability) uchun ishlatiladi.
- Shuning uchun "99% o'xshash" degani: **o'zim yozgan kod bilan bir xil ko'rinish va bir xil boshqaruv** — nusxa kod emas, **rekonstruksiya**. Ikonkalar o'zim chizilaman (SVG), shrift — ochiq litsenziyali (Roboto Flex / Inter), brend nomi — boshqa (taklif: **XAUView**).
- Bu shaxsiy foydalanish uchun platforma; ommaga sotiladigan mahsulot qilinsa, nom/dizayn brend jihatidan farqlanishi kerak.

---

## 3. Mahsulot ta'rifi (v1 scope)

**Kiradi:**
1. Chart yadrosi: shamlar (+volume), pan/zoom, crosshair, OHLC legenda, log/linear, auto-fit, o'ngdan bo'sh joy.
2. 7 TF: D1 / H4 / H1 / M15 / M5 / M3 / M1 + TF bo'yicha resample (2H, 3H, 45m ham kerak bo'lsa).
3. Indikator platformasi: Asia-FU 3-in-1 to'liq + 12-15 ta tayyor (EMA, SMA, VWAP, RSI, MACD, ATR, Bollinger, CVD proxy...), indikator paneli (input'lar, rang, ko'rinish).
4. Chizish tizimi: 6 guruh asbob (lines, shapes, fibonacci, measure, text/brush, positions), magnet, tanlash/ko'chirish/o'chirish, clone, lock/hide, **object tree**, **undo/redo**.
5. Saqlash: chizmalar + layout localStorage/JSON, eksport (PNG), workspace'lar.
6. Alertlar: narx/indikator sharti → brauzer bildirishnomasi + jurnal.
7. Replay (bar-by-bar) — strategiyani sinash uchun.
8. Live data: MetaTrader 5 dan (bizning trader/mt5_io.py) — keyingi bosqichda.
9. (Ixtiyoriy, oxirida) Order ticket + pozitsiyalar chartda — faqat **demo** hisob, prop akkaunt qat'iy bloklangan.

**Kirmaydi (v1 da):** ijtimoiy tarmoq/community, broker bilan to'liq integratsiya, mobil native ilova, TV'ning yopiq kutubxonasi, real pul.

---

## 4. Arxitektura

### 4.1. Uch qatlam

~~~text
┌──────────────────────────────────────────────────────────────┐
│  UI SHELL (HTML/CSS)                                         │
│  top bar · left rail · right rail · bottom bar · panellar     │
│  tema tokenlari · hotkey'lar · dialoglar                      │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
┌───────────────▼──────────────┐  ┌────────────▼──────────────┐
│  CHART ENGINE (canvas 2D)    │  │  INDICATOR ENGINE (JS)    │
│  scale · candles · axes      │  │  Asia-FU 3-in-1           │
│  crosshair · panes           │  │  built-ins · alerts       │
│  drawings · hit-test · undo  │  │  Pine-subset interpretator│
└───────────────┬──────────────┘  └────────────┬──────────────┘
                │                              │
┌───────────────▼──────────────────────────────▼───────────────┐
│  DATA LAYER                                                   │
│  demo: embedded JSON (MT5 snapshot)                           │
│  prod: FastAPI + WebSocket ← mt5_io.py (XAUUSDm, 7 TF)        │
└──────────────────────────────────────────────────────────────┘
~~~

### 4.2. Nega o'z canvas dvigateli (lightweight-charts emas)

| Talab | lightweight-charts | o'z canvas |
|---|---|---|
| Chizma asboblari (trendline, rect, fib, magnet, object tree) | yo'q / juda cheklangan | to'liq nazorat |
| TV'ga piksel darajasida o'xshashlik (body/wick qoidalari, dash, label) | kutubxona uslubi majburiy | hammasi qo'lda |
| Zonalarni "birinchi tegishda to'xtatish" (bizning Asia-FU mantiqi) | qiyin | oson |
| Ko'p pane (chart + volume + CVD + RSI) | cheklangan | oson |
| Kelajakda order/position chiziqlari, alert belgilari | og'riqli | oson |

Shuning uchun: **canvas 2D + o'z rendereri**. 15 000 sham = 60 fps muammo emas (faqat ko'rinadigan oraliq chiziladi).

### 4.3. Fayl tuzilishi (kelajakdagi, demo uchun hammasi 1 fayl)

~~~text
tvclone/
├─ docs/PLAN.md                 ← shu fayl
├─ docs/DESIGN-TOKENS.md        ← P0 natijasi (o'lchangan rang/o'lcham/shrift)
├─ demo/xauview-demo.html       ← P1: bitta faylli demo (sen ko'rasan)
├─ assets/icons/*.svg           ← o'zim chizgan ikonkalar
├─ web/                         ← P2+: modullarga bo'lingan versiya
│  ├─ chart/{scale,candles,drawings,render,interact}.js
│  ├─ indicators/{asia-fu,builtins}.js
│  ├─ ui/{topbar,leftrail,rightrail,panels}.js
│  └─ styles/tokens.css
├─ server/                      ← P2: FastAPI (mt5 → candles/stream)
└─ tests/                       ← paritet + screenshot-diff testlar
~~~

---

## 5. Dizayn tizimi (P0 da APK'dan o'lchab aniqlanadi — quyida boshlang'ich qiymatlar)

Bular TradingView web'ning ma'lum qiymatlari; P0 da APK resurslari bilan solishtirib **tasdiqlanadi**:

| Token | Qiymat (boshlang'ich) |
|---|---|
| Chart fon | #131722 |
| Panel/toolbar fon | #1e222d |
| Chegara / ajratgich | #2a2e39 |
| Asosiy matn | #d1d4dc |
| Ikkilamchi matn | #787b86 |
| Up sham (yangi TV) | #089981 (eski: #26a69a) |
| Down sham (yangi TV) | #f23645 (eski: #ef5350) |
| Crosshair | #758696, dashed |
| Grid | #1e222d / 30% |
| Accent (tanlash, aktiv tool) | #2962ff |
| Shrift | UI: Roboto Flex / Inter · chart legenda: Trebuchet MS stack |
| Shrift o'lchami | 11-12 px (TF tugmalari 12 px) |
| Top bar balandligi | 38 px |
| Chap/o'ng rail kengligi | 52 px |
| Price scale kengligi | 64 px |
| Time axis balandligi | 26 px |
| Sham: body min | 1 px, wick 1 px, border = body rangi |
| Border-radius | 4-6 px |

Ranglar APK ichidagi resources.arsc'dan **aniq ARGB** ko'rinishida olinadi — ko'z bilan "taxminan" emas.

---

## 6. Wireframe (desktop, P1 demo shu ko'rinishda bo'ladi)

~~~text
┌──────────────────────────────────────────────────────────────────────────────┐
│ ◈ XAUView  XAUUSD ▾   D1 H4 H1 M15 M5 M3 M1 │ f Indikatorlar │ ✎ Chizish │ ⏱ │
├───┬──────────────────────────────────────────────────────────────────────────┤
│ ✥ │  XAUUSD · H1 · XAUView                    3884.98 H 3886.20 L 3882.10  │
│ ╱ │  Asia-FU: ASIAN 423 pips [PRIME]  ▸ CVD +12%  ▸ MTF bias: bear          │
│ ▭ │                                                           ┌────────────┐ │
│ ─ │        ▂▄▆█▆▄▂                                            │   3900.00  │ │
│ ║ │    ▂▄▆██████▆▄▂▄          ▄▆█▆▄▂                          │   3890.00  │ │
│ ⊕ │  ▄▆█████████████▆▄▂▄▄▆███████████▆▄▂▄▆█▆▄▂                │   3880.00  │ │
│ ─ │─── BSL 3923.19 ────────────────────────────────────────  │   3870.00  │ │
│ ▢ │  ░░░░░░ H4 SFU 3893–3905 ░░░░░░░░                        │   3860.00  │ │
│ T │  ▒▒▒▒▒▒ H4 Demand 3850–3870 ▒▒▒▒▒▒▒▒▒                    │   3850.00  │ │
│ 📏│─── SSL 3878.85 ────────────────────────────────────────  │   3840.00  │ │
│   │                                                           └────────────┘ │
│   │  ┌───────────────────────────────━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┐ │
│   │  │ Volume   ▁▂▃▅▆▅▃▂▁▂▃▅▇▅▃▂▁▂▃▅▆▅▃▂▁          (pane, 22%)            │ │
│   │  │ CVD      ▁▂▃▅▆▇▆▅▃▂▁▂▃▅▆▅▃▂▁                                     │ │
│   │  └───────────────────────────────────────────────────────────────────┘ │
├───┴──────────────────────────────────────────────────────────────────────────┤
│ 2026-11-16  11:00  ·  O 3884.98  H 3886.20  L 3882.10  C 3885.10  ·  +0.3%  │
│                                              ⏮ ⏪ ⏸ ⏩  Replay  1x        │
└──────────────────────────────────────────────────────────────────────────────┘
~~~

Chap rail (yuqoridan): crosshair, trendline, ray, horizontal line, vertical line, **rectangle**, fib retracement, text, brush, measure, magnet, delete. O'ng rail: watchlist + object tree + alerts.

---

## 7. Bosqichlar (P0 → P7)

| P | Nomi | Natija (deliverable) | Qabul mezoni | Taxminiy vaqt |
|---|---|---|---|---|
| **P0** | Recon + dizayn tizimi | docs/DESIGN-TOKENS.md, tokens.css/json, ikonkalar SVG, reference skrinshotlar | rang/o'lcham/shrift APK'dan o'lchangan, 20+ ikonka tayyor | 1.5-2 soat |
| **P1** | **DEMO — bitta .html** | demo/xauview-demo.html (self-contained, oflayn) | quyidagi §8 ro'yxati 100% bajarilgan, 60 fps | 2-3 soat |
| **P2** | Live data backend | server/ (FastAPI + WS), 7 TF + resample, keshlash | MT5'dan real vaqt, yangilanish < 1 s, uzilishda offline fallback | 3-4 soat |
| **P3** | Indikator platformasi | Asia-FU 3-in-1 JS'da + 12 tayyor indikator + panel | Python engine (trader/engine.py, zones.py) bilan **paritet test** 100% mos | 4-6 soat |
| **P4** | Chizish tizimi (to'liq) | 6 guruh asbob, magnet, object tree, undo/redo, lock/hide | TV'dagi kabi boshqaruv, chizmalar saqlanadi | 4-5 soat |
| **P5** | Workspace/alert/replay | layout saqlash, watchlist, alert manager, replay bar | brauzer yangilanganda hammasi joyida | 3-4 soat |
| **P6** | Savdo (guard bilan) | order ticket, pozitsiya chiziqlari, ledger | faqat demo hisob; prop akkaunt kodda bloklangan | 3-4 soat |
| **P7** | 99% fidelity pass | screenshot-diff hisobot + tuzatishlar | o'rtacha piksel farqi < 2%, ko'z bilan ajratib bo'lmas | 2-3 soat |

**Birinchi natija senga shu sessiyada ko'rinadi: P0 + P1 (ya'ni 3-5 soatlik ish → demo .html).** Qolganlari — sening fikringdan keyin.

---

## 8. P1 demo — aniq tarkib (nima bo'ladi / nima bo'lmaydi)

**Ishlaydi (bitta .html ichida, internet shart emas):**
- TradingView dark dizayni: top bar, chap tool rail, o'ng rail, pastki status bar.
- **Real XAUUSD shamchalari** (MetaTrader 5 dan olingan snapshot): D1 600 · H4 1200 · H1 2000 · M15 2500 · M5 3000 · M3 3000 · M1 3000 bar — hammasi bitta faylga siqilgan JSON.
- TF almashtirish (7 tugma + hotkey 1..7), wheel zoom, drag pan, auto-fit, oxirgi narx chizig'i.
- Crosshair + OHLC legenda + narx/vaqt o'qlari (grid, dashed).
- **Asia-FU 3-in-1**: Asian box (05:00–11:00) + BSL/SSL chiziqlar + range pips label, killzone fonlari (London/NY), FU/SFU/AFU zonalari (7 TF stack, birinchi tegishda to'xtaydi), sweep belgilari, FVG, CVD pane + divergensiya, kichik dashboard.
- **Chizma asboblari**: trendline, ray, horizontal line, vertical line, **rectangle** (zona), text, measure (fib bo'lmagan o'lchagich), tanlash/ko'chirish/o'chirish, magnet (high/low/close'ga yopishish), **Ctrl+Z / Ctrl+Shift+Z**, Delete.
- Chizmalar localStorage'da saqlanadi (faylni yopib ochsang ham joyida).
- PNG eksport tugmasi, fullscreen, light/dark switch.
- Indikator paneli (oddiy): Asia-FU yoqish/o'chirish + asosiy input'lar (session vaqtlari, ranglar, maxAsianPips, FVG extend).

**Hali bo'lmaydi (P2+):** live yangilanish (demo statik snapshot), barcha 100+ indikator, replay, alertlar, savdo, fib/Gann guruhlari, mobile layout.

**Qabul testi:** faylni ikki marta bosib ochasan → hech qanday xato yo'q, 7 TF almashadi, zoom/pan silliq, indikator zonalari to'g'ri joyda, 5 xil chizma chizib, ko'chirib, o'chirib, qaytarib bo'ladi.

---

## 9. "99%" ga qanday yetamiz (o'lchov bilan, "ko'z bilan" emas)

1. **Token o'lchovi:** APK resources.arsc → aniq ranglar/dimens; fontlar APK'dan.
2. **Geometriya:** har panel balandligi/kengligi, padding, radius — jadvalga yoziladi va CSS'da bir joydan boshqariladi.
3. **Screenshot-diff loop:** puppeteer (tradelab node_modules'da bor) bilan bizning sahifa va reference skrinshot olinadi → piksel/SSIM farqi → farq xaritasi → tuzatish. Maqsad: < 2%.
4. **Xatti-harakat parity:** crosshair snap, wheel zoom qadami, drag inertsiyasi, tool hotkey'lari, toolbar tool-tartibi — TV'dagidek.
5. Har bosqichdan keyin senga **skrinshot** beraman (sen ko'rib tasdiqlaysan) — ko'r-ko'rona ishlamaymiz.

---

## 10. Xatarlar va choralar

| Xatar | Chorasi |
|---|---|
| APK'dagi chart yopiq va yuklab olinadi → kod olib bo'lmaydi | Dizaynni o'lchov bilan tiklaymiz; chart dvigatelini o'zim yozaman |
| res/drawable = binary XML | aapt2/androguard bilan dekod; bo'lmasa — skrinshotdan qo'lda chizilgan SVG |
| 1 faylga 15k sham = katta HTML | JSON minify + 2 xonadan ortiq bo'lmagan yaxlitlash → ~1 MB, muammo emas |
| Brauzerda 60 fps yo'qolishi | faqat ko'rinadigan oraliqni chizish + requestAnimationFrame + devicePixelRatio |
| "99%" subyektiv | piksel-diff metrikasi bilan o'lchanadi (§9) |
| Prop akkaunt xatosi | bu loyiha hozircha faqat ko'rish/chizish; savdo qatlami P6 da, mavjud guard() orqali |

---

## 11. Sendan javob kutayotgan 4 savol (default'lari bilan)

1. **Qaysi dizayn reference?** — (a) desktop TradingView web (men tavsiya qilaman: sen kompyuterda ishlaysan) yoki (b) mobil ilova (APK) layouti. *Default: (a) desktop, telefonda keyin moslashtiramiz.*
2. **Rang palitrasi:** (a) yangi TV (#089981 / #f23645) yoki (b) klassik (#26a69a / #ef5350). *Default: (a).*
3. **Demodagi ma'lumot:** (a) bizning MT5'dan real XAUUSD (tavsiya) yoki (b) sintetik/BTC. *Default: (a).*
4. **Interfeys tili:** (a) inglizcha (TV'ga o'xshash) yoki (b) o'zbekcha. *Default: (a) inglizcha + asbob nomlari tooltip'da o'zbekcha.*

Qo'shimcha: brend nomi sifatida **XAUView** taklif qilaman (TV nomi/brendi ishlatilmaydi).

---

## 12. Keyingi qadam

Sen "davom et" desang → **P0 (dizayn tokenlari + ikonkalar)** va **P1 (demo .html)** ni boshlayman va shu sessiyada demo faylni + skrinshotni beraman.

Agar rejada biror narsa xato tushunilgan bo'lsa — ayt, tuzataman. Xususan: TF ro'yxati, indikator tarkibi, chizma asboblari ro'yxati va "99%" nimani anglatishi.


---

## 13. Bajarilgan ishlar — 2026-11-16 (P0 + P1)

### P0 — Recon + dizayn tizimi ✅

**APK statik dekod qilindi** (androguard 4.1.4, APK ishga tushirilmagan):

| Manba | Natija |
|---|---|
| resources.arsc (7.4 MB) | 15 963 resurs: **1 261 rang** (766 tasi aniq #AARRGGBB), **1 494 dimen**, 3 239 string, 1 454 style |
| Theme | DsAppTheme + DsAppTheme.Dark — 257 token (TV'ning haqiqiy dizayn tizimi) |
| Shriftlar | 7 TTF: Roboto Regular/Medium/Bold, Roboto Flex, Roboto Mono, Noto Sans |
| Ikonkalar | **124 ta vektor** (94 chizish asbobi + 30 UI) → SVG + PNG 112px + kontakt-sheet |

**O'lchangan asosiy tokenlar (dark, DsAppTheme.Dark):**

| Token | Hex |
|---|---|
| Fon | #000000 |
| Panel / bar | #0F0F0F |
| Yuza | #1F1F1F |
| Divider / chegara | #2E2E2E / #4A4A4A |
| Matn | #DBDBDB / #B8B8B8 / #8C8C8C |
| Up / Down (yangi TV) | **#22AB94 / #F7525F** |
| Accent | #2962FF |
| Dimens | chart_panel_height **52dp**, drawing_tools_icon_size **28dp**, separator **1dp** |

Hujjat: docs/DESIGN-TOKENS.md · Ikonkalar: assets/apk-icons (sheet.png, svg/, manifest.json)

**Muhim cheklov:** chart'ning ichki palitrasi (sham/grid ranglari) APK'da **yo'q** — chart WebView'da tashqi resursdan yuklanadi, feature_chart_kotlin_js_client.js da bitta ham hex rang yo'q. Shu sababli chart uchun ikki variant: **web-uslub (#131722/#089981)** va **o'lchangan ilova uslubi (#000000/#22AB94)** — foydalanuvchi tanlaydi.

### P1 — Demo (bitta .html) ✅

demo/xauview-demo.html — 1.32 MB, oflayn, 1 fayl.

- Assetlar: **OANDA:XAUUSD**, **FXCM:GBPUSD** · TF: **D1 H4 H1 M15 M5 M3 M1** (2500 bar M1 ... 500 bar D1, MT5 demo snapshot)
- Chart: sham + volume + CVD pane, pan/zoom/fit, crosshair, OHLC legenda, oxirgi narx, grid, watermark
- Indikator **ASIA-FU 3-IN-1**: Asian box + BSL/SSL + pips/PRIME, killzones, sweeps, FVG, FU/SFU/AFU zonalari (joriy + ustki TF), CVD proxy, dashboard
- Chizmalar: trendline, ray, hline, vline, rectangle, text, measure + magnet + select/drag/handles + undo/redo + localStorage + object list
- 3 tema (dark web / light / app-o'lchangan), PNG eksport, fullscreen, hotkeys, view holatini saqlash
- Testlar: 0 JS xatosi, chizish/undo/redo/TF-symbol almashish/3 tema — headless Chrome'da tasdiqlandi

### Keyingi (P2)

1. **Real feed**: OANDA v20 API (XAUUSD) va FXCM ma'lumotlari — **API kalitlari kerak** (hozir MT5 snapshot ishlatilgan).
2. Live yangilanish (WebSocket), replay, alertlar, fib/Gann guruhlari, mobile layout.



---

## 14. P2 holati — 2026-11-16 10:35 (live feed + mobil app)

**Bajarildi:**
- `server/app.py` — FastAPI: `/api/health`, `/api/candles` (7 TF), `/api/alerts` CRUD, `/ws` (snapshot 600 bar + har **300 ms** tick), statik `mobile/` hosting. MT5 (demo) — faqat market data, trading API chaqirilmaydi.
- `mobile/index.html` — **telefon uchun** (Xiaomi 12, 393x873), black tema default, 2 asset, 7 TF, Asia-FU indikatori, chizma asboblari, touch gesture lar (pan/pinch/tap/dbl-tap/drag-draw/axis-drag), alertlar + toast/notification/beep.
- Alert E2E: POST → trigger → WS → toast — PASS. Symbol/TF almashishdagi race tuzatildi (generation guard).
- Desktop demo (`demo/xauview-demo.html`) — P1 natijasi, 3 tema (web-dark / light / APK-o'lchangan black).

**Ochiq:** HTTPS tunnel (telefon notification uchun), long-press, APK ikonkalari, desktop default black, OANDA/FXCM real API kalitlari.

**Batafsil handoff:** `docs/PROGRESS.md`, mashina holati: `docs/STATE.json`.


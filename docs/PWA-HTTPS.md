# PWA + HTTPS — XAUView

**Sana:** 2026-11-16 · **Loyiha:** D:\Project\AI\tvclone · **Muallif:** pwa-tunnel (teammate)
**Holat:** ✅ PWA ikonkalari, manifest, service worker, registratsiya, Cloudflare HTTPS tunnel — hammasi ishlaydi va Chrome headless'da tekshirilgan.

---

## 0. TL;DR

| Nima | Holat | Qayerda |
|---|---|---|
| 5 ta PWA ikonka (qora fon, candle/trend belgisi) | ✅ | `mobile/icons/` |
| Manifest (XAUView, standalone, uz, 3 icon) | ✅ | `mobile/manifest.webmanifest` |
| Service worker (network-first HTML, cache-first ikonka) | ✅ | `mobile/sw.js` |
| Ro'yxatdan o'tkazish + `window.__PWA` API | ✅ | `mobile/src/_m6_pwa.js` |
| HTTPS tunnel (telefon bildirishnomasi uchun) | ✅ ishlayapti | PID **12636**, `work/cloudflared.exe` |
| **Joriy HTTPS URL** | ✅ | **https://picture-shoulder-notifications-atlas.trycloudflare.com** |
| Chrome headless testlar | ✅ 14 PASS (+2 "kutilgan" flag) | pastda, §8 |

> ⚠️ **Muhim:** bu — Cloudflare **quick tunnel**. URL **vaqtinchalik**: tunnel jarayoni qayta ishga tushsa yoki uzilsa, URL **o'zgaradi**. Yangi URL ni `work/cloudflared.log` dan oling (§6.3).

---

## 1. Nima qilindi

1. **Ikonkalar** — `mobile/icons/` papkasi yaratildi, 5 ta PNG Pillow bilan chizildi (§2).
2. **Manifest** — qayta yozildi: nom, scope, standalone, qora fon, 3 xil icon (§3).
3. **Service worker** — yangi `mobile/sw.js`: HTML network-first, ikonka/manifest cache-first, `/api/` va `/ws` **hech qachon** keshlanmaydi (§4).
4. **Registratsiya qatlami** — yangi `mobile/src/_m6_pwa.js`, `assemble.js` parts ro'yxatiga **oxirida** qo'shildi (§5).
5. **Build** — `node mobile/src/assemble.js` → `mobile/index.html` (~1343 KB), ichida `_m6_pwa` izi va SW registratsiyasi bor.
6. **HTTPS tunnel** — cloudflared o'rnatildi va fon jarayon sifatida ishga tushirildi (§6).
7. **Tekshiruv** — Chrome headless (puppeteer-core) bilan https URL ustida 16 ta test (§8).

Boshqa fayllarga (**`_m1_head.html`, `_m3_chart.js`, `_m4_ui.js`, `_m5_feed.js`, `server/*`, `demo/*`, `docs/PROGRESS.md`, `docs/STATE.json`**) **tegilmadi**.

---

## 2. Ikonkalar — `mobile/icons/`

| Fayl | O'lcham | Vazifa |
|---|---|---|
| `icon-192.png` | 192×192 | manifest `any` (Android home screen) |
| `icon-512.png` | 512×512 | manifest `any` (splash, do'kon) |
| `icon-512-maskable.png` | 512×512 | manifest `maskable` — kontent markaziy **72%**da (xavfsiz zona 80% hurmat qilindi) |
| `apple-touch-icon.png` | 180×180 | iOS "Add to Home Screen" |
| `favicon-32.png` | 32×32 | brauzer tab ikonkasi (soddalashtirilgan: faqat shamlar, trend chizig'isiz — 32px da o'qilishi uchun) |

**Dizayn (o'lchangan TradingView tokenlari):**
- Fon: **#000000** (to'liq qora, chetigacha)
- Ko'tariluvchi shamlar: **#22AB94** (up), tushuvchi: **#F7525F** (down)
- Diagonal trend chizig'i + uchi nuqtasi: **#2962FF** (accent)
- Nuqta markazi: **#DBDBDB** (text)
- Har bir sham atrofida qora keyline — trend chizig'i ustida ham shamlar aniq o'qiladi.

**Qayta generatsiya qilish** (dizaynni o'zgartirish kerak bo'lsa):
```powershell
& 'D:\Project\AI\Trading-with-ai\.venv\Scripts\python.exe' 'D:\Project\AI\tvclone\work\pwa_icons.py'
```
Skript 4× supersampling bilan chizadi va LANCZOS bilan kichraytiradi (silliq qirralar).
Ikonka o'zgarsa — `mobile/sw.js` dagi `CACHE_VERSION` ni oshiring (§4.4), aks holda telefonda eski ikonka qoladi.

---

## 3. Manifest — `mobile/manifest.webmanifest`

```json
{
  "name": "XAUView",
  "short_name": "XAUView",
  "description": "XAUUSD / GBPUSD live charting — TradingView uslubidagi mobil chart, indikatorlar, chizmalar va narx alertlari.",
  "lang": "uz", "dir": "ltr",
  "id": "./", "start_url": "index.html", "scope": "./",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "orientation": "any",
  "background_color": "#000000",
  "theme_color": "#000000",
  "categories": ["finance", "productivity"],
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- **BOM yo'q**, valid JSON (`JSON.parse` testdan o'tdi).
- Server uni `Content-Type: application/manifest+json` bilan beradi.
- `start_url: "index.html"` va `scope: "./"` — tunnel URL o'zgarsa ham ishlaydi (nisbiy yo'llar).
- <link rel="manifest"> allaqachon `_m1_head.html` da bor — tegilmadi. `apple-touch-icon` va `favicon` linklari `_m6_pwa.js` tomonidan `<head>` ga **dinamik** qo'shiladi (head faylga tegmasdan).

---

## 4. Service worker — `mobile/sw.js`

### 4.1 Keshlash strategiyasi

| So'rov turi | Strategiya | Izoh |
|---|---|---|
| Navigation (`index.html`) | **NETWORK-FIRST** | Tarmoqdan `cache: 'no-store'` bilan; oflayn bo'lsa keshdan; u ham bo'lmasa 503 oflayn HTML. **Dev paytida eski fayl ko'rinmaydi.** |
| `icons/*`, `*.png/svg/ico`, `manifest.webmanifest` | **CACHE-FIRST** | Keshda bo'lsa — darhol keshdan; bo'lmasa tarmoqdan olib keshga qo'yadi. |
| `/api/` va `/api` | **NETWORK-FIRST + aniq xato** | `cache: 'no-store'`, **HECH QACHON keshlanmaydi**. Oflayn bo'lsa `503` + `{"ok":false,"offline":true,"error":"oflayn: server javob bermadi"}`. |
| `/ws` (WebSocket) | **TEGILMAYDI** | SW `fetch` handler'i WS ni ushlamaydi; kodda ham erta `return`. |
| Boshqa hammasi | tarmoq → oflayn bo'lsa kesh | passthrough |

### 4.2 Install / activate

- `install`: 8 ta fayl (`./`, `index.html`, `manifest`, 5 ikonka) `Promise.allSettled` bilan keshlanadi — **bitta fayl 404 bo'lsa ham install FAIL BO'LMAYDI**; keyin `skipWaiting()`.
- `activate`: `CACHE_VERSION` ga tegishli bo'lmagan **barcha eski keshlar o'chiriladi**, `clients.claim()` — ochiq sahifa darhol nazoratga olinadi.
- `message`: `{type:'SKIP_WAITING'}` va `{type:'GET_VERSION'}` qo'llab-quvvatlanadi.

### 4.3 Kesh nomi

```js
var CACHE_VERSION = 'xauview-v6-2026-11-16';
var STATIC_CACHE  = CACHE_VERSION + '-static';
// → "xauview-v6-2026-11-16-static"
```

### 4.4 Yangilash tartibi

| Nima o'zgardi | Nima qilish kerak |
|---|---|
| `index.html` (chart/UI kodi) | Hech narsa — network-first o'zi yangi faylni oladi |
| Ikonka / manifest | `CACHE_VERSION` ni oshiring → telefonda 1 marta qayta ochish |
| `sw.js` mantiqi | `CACHE_VERSION` ni oshiring → SW yangi versiyani oladi (`skipWaiting`) |

Telefonda keshni majburiy tozalash: Chrome → DevTools (yoki `chrome://settings/siteData`) → sayt → **Clear & reset**; yoki ikonkani uçirib, qaytadan qo'shish.

---

## 5. Registratsiya — `mobile/src/_m6_pwa.js`

`assemble.js` dagi `parts` ro'yxatiga **oxirida** qo'shildi (`_m5_feed.js` dan keyin), ya'ni `toast()` va `notify()` allaqachon mavjud bo'lganda ishlaydi.

**Mantiq:**
- SW **faqat** `https:` yoki `localhost/127.0.0.1` da ro'yxatdan o'tadi; butun blok `try/catch` ichida.
- Birinchi ruxsat so'rovi: sahifada **birinchi bosish** (`pointerdown`/`click`, capture) → `Notification.requestPermission()` — **faqat secure context** da, faqat `permission === 'default'` bo'lsa, bir marta.
- Konsolga **bir marta** holat yoziladi: `[PWA] holat: protocol=https:, secure=true, sw=registered, Notification=granted`.

### `window.__PWA` API

| Maydon | Turi | Ma'nosi |
|---|---|---|
| `supported` | bool | Notification API + serviceWorker mavjudmi |
| `secure` | bool | secure context (https / localhost) |
| `perm` | string (getter) | `Notification.permission`: `granted` \| `denied` \| `default` \| `unavailable` |
| `request()` | → Promise<string> | ruxsat so'raydi; `granted/denied/default/insecure/unavailable` qaytaradi (rad etmaydi) |
| `notify(title, body)` | → bool | **toast + system notification** (ruxsat bo'lsa). Icon: `icons/icon-192.png` |

**`notify()` tafsiloti:** Android Chrome'da `new Notification()` taqiqlangan, shuning uchun asosiy yo'l — `ServiceWorkerRegistration.showNotification()` (tag `xauview`, renotify, vibrate); u ishlamasa — `new Notification()` fallback. Ruxsat bo'lmasa faqat toast chiqadi va `false` qaytadi.

**Misol (konsolda):**
```js
await window.__PWA.request();          // "granted"
window.__PWA.notify('XAUUSD', '3873.9 yuqoridan o\'tdi');
```

---

## 6. HTTPS tunnel (Cloudflare quick tunnel)

### 6.1 Joriy holat

| Parametr | Qiymat |
|---|---|
| **HTTPS URL** | **https://picture-shoulder-notifications-atlas.trycloudflare.com** |
| PID | **12636** (cloudflared.exe) |
| Exe | `D:\Project\AI\tvclone\work\cloudflared.exe` (~55 MB, amd64) |
| Log | `D:\Project\AI\tvclone\work\cloudflared.log` |
| Lokal manzil | `http://127.0.0.1:8765` (server tegmadi, o'chirilmadi) |
| Tekshiruv | `GET https://<url>/api/health` → `200 {"ok":true,"mt5":true,...}` ✅ |
| URL nusxasi | `server/tunnel-url.txt` (Lead yozgan) |

Ishga tushirish buyrug'i:
```powershell
$exe = 'D:\Project\AI\tvclone\work\cloudflared.exe'
Start-Process -FilePath $exe -WindowStyle Hidden -PassThru -ArgumentList @(
  'tunnel','--url','http://127.0.0.1:8765','--no-autoupdate',
  '--logfile','D:\Project\AI\tvclone\work\cloudflared.log','--loglevel','info')
```

### 6.2 Nega kerak

Notification API (va service worker) faqat **secure context** da ishlaydi. `http://10.149.101.17:8765` — secure emas:
brauzer `Notification` bermaydi va SW ro'yxatdan o'tmaydi → faqat sahifa ichidagi toast ishlaydi.
`https://...trycloudflare.com` esa haqiqiy TLS sertifikatli domen — hamma narsa ishlaydi.

### 6.3 ⚠️ Quick tunnel — URL vaqtinchalik

- Bu **hisobsiz (account-less) quick tunnel**: **uptime kafolati yo'q**, Cloudflare uni istalgan vaqtda yopishi mumkin.
- Tunnel jarayoni **qayta ishga tushsa yoki uzilsa — URL O'ZGARADI**. Telefonda eski ikonka "Tunnel not found" beradi.
- **Yangi URL ni olish** (tunnel qayta ishga tushirilgandan keyin):
```powershell
# log oxiridagi eng yangi URL
Select-String -Path 'D:\Project\AI\tvclone\work\cloudflared.log' `
  -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1
# PID
Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" | Select-Object ProcessId,CreationDate
# tekshirish
Invoke-WebRequest '<yangi-url>/api/health' -UseBasicParsing | Select-Object -ExpandProperty Content
```
- Eski telefonda: home-screen ikonkani o'chirib, yangi URL bilan qaytadan "Add to Home screen".
- Barqaror URL kerak bo'lsa: Cloudflare akkaunt + **named tunnel** (`cloudflared tunnel create` + o'z domeningiz) yoki **ngrok** (bepul statik domen), yoki lokal HTTPS sertifikat (faqat o'sha kompyuterda ishlaydi — telefonda CA o'rnatish kerak).

### 6.4 Tunnel o'chsa / kompyuter o'chsa

Telefondagi ilova ochiladi (SW keshidan), lekin **LIVE feed va alertlar ishlamaydi** — WS ulanishi uziladi.
Qayta ko'tarish: server (8765) ishlab turishi shart, keyin §6.1 buyrug'i, keyin yangi URL ni tarqatish.

---

## 7. Telefonda qanday sinash (Xiaomi 12 / Android Chrome misolida)

1. **Tunnel ishlab turishini tekshiring:** kompyuterda `Invoke-WebRequest '<url>/api/health'` → `ok:true`.
   Server 8765 da ishlab turishi va MT5 terminali ulangan bo'lishi shart.
2. Telefonda **Chrome** oching → **https://picture-shoulder-notifications-atlas.trycloudflare.com** → Enter.
   - Wi-Fi shart emas: tunnel orqali mobil internetda ham ishlaydi.
3. Sahifa ochilishini kuting: chart chiziladi, yuqori o'ngda **LIVE** badge yonadi, shamlar jonli yangilanadi.
   *(Bu bosqichda SW ro'yxatdan o'tadi va ikonkalarni keshga oladi.)*
4. Chrome menyusi (**⋮**) → **"Add to Home screen"** / **"Add to Home screen"** → nomi **XAUView** bo'lishi kerak (manifest + ikonka olindi degani).
5. Home screen'dagi **XAUView** ikonkasini bosing — standalone oynada ochiladi (brauzer paneli yo'q). Mana shu — PWA o'rnatildi.
6. **Bildirishnomaga ruxsat bering:**
   - Ilovada birinchi bosishingizda Chrome "Show notifications" so'raydi → **Allow**.
   - Chiqmasa: menyu (⋮) → **Bildirishnoma** tugmasi, yoki Chrome → ⋮ → Settings → Site settings → Notifications → bu sayt → Allow.
   - Konsolda `window.__PWA.perm` → `"granted"` bo'lishi kerak.
7. **Alert sinovi:** pastdagi **Alertlar** (🔔) → Asset (XAUUSD) → yo'nalish **above/below** → narx (joriy narxga yaqin, masalan +0.5) → **Qo'shish**.
   Narx yetganda: toast + **system notification** (qulf ekranida/status panelda) + beep + vibrate.
   Tezkor sinov (konsolda): `window.__PWA.notify('Test','Salom')` — system notification kelishi kerak.
8. **Offline sinovi:** telefonni **airplane mode** qiling → home-screen ikonkasini bosing → ilova keshdan ochiladi (chart oxirgi holatda, badge **OFFLINE**). Internet qaytganda LIVE o'zi tiklanadi.
9. **Eslatma:** tunnel qayta ishga tushgan bo'lsa, eski ikonka ishlamaydi — 2-qadamdan takrorlang.

---

## 8. Test natijalari (Chrome headless + puppeteer-core, https URL ustida)

Skriptlar: `work/pwa_test3.js`, `work/pwa_test4.js`. Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`, puppeteer-core: `D:\Project\AI\tradelab\node_modules`.

| # | Test | Natija | O'lchangan qiymat |
|---|---|---|---|
| 1 | `isSecureContext === true` | **PASS** | `https:` |
| 2 | SW registratsiyalar ≥ 1, scope to'g'ri | **PASS** | 1 reg, scope `https://<url>/`, active, controller=true |
| 3 | `window.__PWA` = {supported, secure, perm} | **PASS** | `true`, `true`, `"granted"` (ruxsat override qilingan holda) |
| 4 | `/api/health` https orqali | **PASS** | `200 {"ok":true,"mt5":true,...}` |
| 5 | `caches.keys()` kesh nomi | **PASS** | `["xauview-v6-2026-11-16-static"]` |
| 6 | `/api/`, `/ws` keshlanmagan | **PASS** | keshda faqat 8 ta statik fayl |
| 7 | `wss://` live ulanish | **PASS** | `open` (WS ulanish ochildi) |
| 8 | LIVE badge + chart render | **PASS** | badge `LIVE`, `#chart` 393×773 |
| 9 | **Navigation NETWORK-FIRST** | **PASS** | keshga soxta `index.html` qo'yildi → qayta yuklashda **haqiqiy** app keldi (eschirilgan kesh yutmadi) |
| 10 | **Ikonka CACHE-FIRST** | **PASS** | keshga 134 B soxta ikonka qo'yildi → `fetch` **keshdan** 134 B qaytardi |
| 11 | **OFFLINE: app keshdan ochildi** | **PASS** | SW target'da tarmoq bloklandi → sahifa keshdan ochildi, chart + `__PWA` joyida |
| 12 | **OFFLINE: /api/ aniq xato** | **PASS** | `503 {"ok":false,"offline":true,"error":"oflayn: server javob bermadi"}` |
| 13 | **OFFLINE: ikonka keshdan** | **PASS** | `200` (keshdan) |
| 14 | JS exception yo'q | **PASS** | `pageerror: []` |
| 15 | Console error yo'q | ⚠️ *kutilgan* | faqat Chrome siyosat ogohlantirishi: `navigator.vibrate ... user hasn't tapped` (headless'da bosish yo'q; `_m4_ui.js:264` dagi vibrate — JS xato emas) |
| 16 | 4xx/5xx javob yo'q | ⚠️ *kutilgan* | faqat bizning **ataylab** qaytargan `503 /api/health` (11-test paytida) |

**Qo'shimcha (dastlabki sessiya, localhost):** SW active, 8 ta fayl keshda, `[PWA] holat: protocol=http:, secure=true, sw=registered, Notification=default` — 0 xato.

**Bildirishnoma haqida halol izoh:** headless Chrome'da ko'rinadigan notification markazi yo'q, shuning uchun `reg.getNotifications()` bo'sh qaytadi — lekin `ServiceWorkerRegistration.showNotification()` **xatosiz resolve bo'ldi** (`resolved`), `__PWA.notify()` `true` qaytardi va toast chiqdi. Haqiqiy system notification ko'rinishi **faqat telefonda** tekshiriladi (§7.7).

**Skrinshot:** `work/pwa-tunnel.png` — https tunnel orqali ochilgan app (live XAUUSD M1 + `__PWA.notify` toast).

---

## 9. Cheklovlar (halol ro'yxat)

1. **Quick tunnel URL vaqtinchalik** — qayta ishga tushsa o'zgaradi; uzilishlar bo'lishi mumkin; Cloudflare uzluksizlik kafolat bermaydi (§6.3).
2. **Kompyuter + server + MT5 ochiq bo'lishi shart** — tunnel faqat yo'l ochadi; ma'lumot manbai baribir lokal server/MT5.
3. **Barcha trafik Cloudflare orqali** o'tadi (TLS Cloudflare'da tugaydi). Maxfiy ma'lumot yuborilmaydi (faqat chart datasi), lekin bu — tashqi xizmat.
4. **Bildirishnoma faqat https yoki localhost'da** — `http://10.149.101.17:8765` da SW ham, Notification ham yo'q (faqat toast). Bu — brauzer qoidasi, kod bilan chetlab o'tilmaydi.
5. **Android Chrome:** ruxsat berilmasa (`denied`) qayta so'rov chiqmaydi — Chrome sozlamalaridan qo'lda yoqish kerak. Ruxsat **user gesture** talab qiladi (shuning uchun birinchi bosishda so'raladi).
6. **iOS:** "Add to Home Screen" faqat Safari'dan; web-push/notification **iOS 16.4+** va faqat **o'rnatilgan PWA**da ishlaydi. Ba'zi iOS versiyalarida vibrate/beep cheklangan.
7. **Headless'da notification ko'rinishi tekshirilmadi** (§8) — telefonda tasdiqlash kerak.
8. **Ikonka/manifest o'zgarsa** `CACHE_VERSION` oshirilmasa, telefonda eski versiya qoladi (§4.4).
9. **WS latency:** tunnel orqali qo'shimcha ~50–200 ms kechikish bo'lishi mumkin (lokal LAN'da yo'q).
10. **Bitta kompyuter = bitta tunnel:** bir vaqtda 2 ta cloudflared ishga tushirmang (chalkash URL'lar).

---

## 10. Xizmat ko'rsatish (cheat-sheet)

```powershell
# 1) Server (8765) tirikmi?
Invoke-WebRequest 'http://127.0.0.1:8765/api/health' -UseBasicParsing | Select-Object -ExpandProperty Content

# 2) Tunnel jarayoni tirikmi?
Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" | Select-Object ProcessId,CreationDate

# 3) Joriy tunnel URL
Select-String -Path 'D:\Project\AI\tvclone\work\cloudflared.log' `
  -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1

# 4) https orqali tekshiruv
Invoke-WebRequest '<url>/api/health' -UseBasicParsing | Select-Object -ExpandProperty Content

# 5) Build (src o'zgargandan keyin)
cd D:\Project\AI\tvclone; node mobile/src/assemble.js
```

---

## 11. Fayllar (shu ish doirasida)

| Fayl | Holat |
|---|---|
| `mobile/icons/icon-192.png` | yangi |
| `mobile/icons/icon-512.png` | yangi |
| `mobile/icons/icon-512-maskable.png` | yangi |
| `mobile/icons/apple-touch-icon.png` | yangi |
| `mobile/icons/favicon-32.png` | yangi |
| `mobile/manifest.webmanifest` | qayta yozildi |
| `mobile/sw.js` | yangi |
| `mobile/src/_m6_pwa.js` | yangi |
| `mobile/src/assemble.js` | `parts` ga `_m6_pwa.js` qo'shildi |
| `mobile/index.html` | qayta yig'ildi (build) |
| `docs/PWA-HTTPS.md` | shu hujjat |
| `work/cloudflared.exe`, `work/cloudflared.log` | tunnel |
| `work/pwa_icons.py` | ikonka generatori |
| `work/pwa_test3.js`, `work/pwa_test4.js` | headless testlar |
| `work/pwa-tunnel.png` | https skrinshot |

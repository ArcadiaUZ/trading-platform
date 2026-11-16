# TradingView gesture'lari — reverse engineering natijalari

Manba: **TradingView Android 1.20.87 (build 1002595)** — `work/apk/base.apk` (8 dex, 81.5 MB) va
uning WebView'da ishlaydigan **charting library** bundle'i (`static.tradingview.com/static/bundles/81242.*.js`, 1.42 MB).

## 0. Muhim topilma: gesture'lar qayerda?

APK ichida chart **WebView** da ishlaydi (`assets/dark/index.html` = captcha, `feature_chart_kotlin_js_client.js` =
native↔JS ko'prigi). DEX'da `feature/chart/**` faqat app-level interactor'lar; haqiqiy gesture mantiqi
charting library JS bundle'ida. Shu sababli DEX emas, **bundle statik analizi** qilindi:

```
81242.a1188b25dfed57604d8f.js  pinch=55  kinetic/inertia  touches=6  touchend=30  Kinetic=5
```

## 1. Topilgan aniq kod (dalil)

### 1.1 Chart'da pinch = FAQAT vaqt zoom (10× gain)
```js
pinchStartEvent(){ ... this._prevPinchScale = 1; this._pinching = true; ... }
pinchEvent(e, t, i, s) {                      // s = joriy pinch scale
  const r = 10 * (s - this._prevPinchScale);  // 10x gain, INKREMENTAL
  this._prevPinchScale = s;
  this._chartModel().zoomTime(e.x, r, true);  // anchor = pinch markazi
}
```

### 1.2 Price axis'da pinch = 2-nuqtali narx scale
```js
pinchStartEvent(){ return ... bothPointsOnTargetElement }   // faqat price scale ustida
pinchEvent(e,t,i){
  if (!this._pinching) { this._pinching = true;
    this._undoModel.startTwoPointsScalePrice(pane, priceScale, t.y, i.y); }  // 2 barmoq Y
  this._undoModel.twoPointsScalePriceTo(pane, priceScale, t.y, i.y);
}
```

### 1.3 Kinetic (inertia) scroll — faqat mobil
```js
useKineticScroll: b.isAnyMobile
addStart(e, t){ t - e.timeStamp <= 50 && super.addPosition(...) }   // 50 ms gate
addPosition(pos, time){                                            // 15 px sample
  (null === prev || Math.abs(prev.position - pos) >= 15) && this._moveSampleCount++;
}
start(){ this._moveSampleCount >= 2 && super.start() }               // kamida 2 sample
```
→ Uchtasi muhim: **(a)** bosib turib keyin sudrasangiz (50 ms dan kech) **inertsiya yo'q**,
**(b)** namunalar 15 px dan olinadi, **(c)** kamida 2 ta namuna kerak.

### 1.4 Scroll/scale konfiguratsiyasi
```js
handleScale:  { mouseWheel, pinch, axisPressedMouseMove: { time, price } }
handleScroll: { mouseWheel, pressedMouseMove, horzTouchDrag, vertTouchDrag }
```
→ bir barmoq sudrash **ikki o'qda** scroll qiladi; o'qlarni bosib sudrash (axisPressedMouseMove) masshtabni o'zgartiradi.

### 1.5 Crosshair: faqat long-tap'dan keyin 'track'
```js
_trackCrosshairOnlyAfterLongTap ... longTapEvent(e){ this._longTap = true; ... }
doubleTapEvent(e){ ... this._mouseDoubleClickOrDoubleTapEvent(e) }
```

## 2. TradingView mobil gesture jadvali (port qilindi)

| # | Gesture | TV xatti-harakati | Bizda |
|---|---|---|---|
| 1 | 1 barmoq sudrash | vaqt + narx bo'ylab scroll | ✅ avvaldan |
| 2 | **Kinetic fling** | qo'yib yuborganda sekinlashib davom etadi (50 ms gate, 15 px sample) | ✅ **yangi** |
| 3 | Gorizontal pinch | **faqat** vaqt zoom, 10×(s−sPrev), markazga tayanadi | ✅ **yangi** (avval narx ham zoom bo'lardi) |
| 4 | Vertikal pinch (chartda) | e'tiborsiz (narx faqat price scale'da o'zgaradi) | ✅ **yangi** |
| 5 | Price axis'da pinch | 2-nuqtali narx scale | ✅ **yangi** |
| 6 | Price axis'ni sudrash | narx scale | ✅ avvaldan |
| 7 | Time axis'ni sudrash | vaqt zoom | ✅ avvaldan |
| 8 | Long-press | crosshair lock + lupa (2.6×) | ✅ avvaldan |
| 9 | Long-press + drag | crosshair suriladi, **fling yo'q** | ✅ avvaldan + gate |
| 10 | Double-tap chart | fit (reset) | ✅ avvaldan |
| 11 | Double-tap price axis | narx avto-scale | ✅ **yangi** |
| 12 | Tap | crosshair; chizma ustida tanlash | ✅ avvaldan |
| 13 | 2 barmoq tap/sudrash (pan) | TV'da alohida yo'q — pinch scroll qilmaydi | ✅ (fling o'rniga) |

## 3. Implementatsiya (`mobile/src/_m13_gestures.js`)

- **Arxitektura:** `document` da **capture** fazali listener'lar — mavjud `_m3_chart.js` handler'laridan **oldin** ishlaydi,
  shuning uchun eski pinch mantiqini buzmasdan neytrallash mumkin:
  ```js
  V.pinch.d0 = d;  V.pinch.dy0 = dy;   // eski handler f=1, rf=1 -> hech nima qilmaydi
  V.pinch.sp0 = V.spacing; V.pinch.rng0 = range;
  ```
- **Konstantalar:** `SAMPLE_PX 15`, `HOLD_MS 50`, `MIN_SAMPLES 2`, `TAU 210 ms`, `VMIN 0.015 px/ms`, `VMAX 3.2`.
- **Fling:** `v *= exp(-dt / 210)`, `rightOffset += v*dt/spacing`, chegarada avtomatik to'xtaydi.
- **Pinch:** scale `s = d/dRef`; chartda `factor = 1 + 10*(s − sPrev)` (0.55…1.8 clamp), markaz `iOf(mx)`;
  price axis'da `range *= sPrev/s`, markaz — barmoqlar o'rtasidagi narx.
- **Haptika:** pinch start 6 ms, fling 8 ms, double-tap 12 ms.
- **Debug:** `window.GEST.stats = {flings, pinches, pricePinches, verticalIgnored, heldNoFling}`.

## 4. Test (`mobile/_t_gestures.js`, CDP ko'p-nuqtali touch)

| Test | Natija |
|---|---|
| Gorizontal pinch → vaqt zoom (5.468 → 40) | **PASS** |
| Chart pinch → narx scale tegilmadi (17.4 → 17.4) | **PASS** |
| Vertikal pinch (chartda) → e'tiborsiz | **PASS** |
| Price axis pinch → narx scale (17.4 → 9.845), vaqt o'zgarmadi | **PASS** |
| Fling + sekinlashuv (20 → 42 → 58 → 72 → 77) | **PASS** |
| Long-press drag → fling yo'q (50 ms gate) | **PASS** |
| Double-tap price axis → autoPrice ON | **PASS** |
| JS xatolar | **0** |

Skrinshot: `shots/m84-gestures.png`.

## 5. Halol cheklovlar

- Bundle **minifikatsiyalangan**; `KineticAnimation` (modul 287849) boshqa chunk'da — uning aniq friction formulasi
  olinmadi, shuning uchun eksponensial so'nish (`τ=210 ms`) bilan TV tuyg'usiga moslashtirildi (yuqoridagi uch shart aniq bajarilgan).
- `zoomTime` ning ichki birligi minifikatsiyada yopiq → `1 + 10·Δs` formulasi bilan imitatsiya qilindi.
- TV'ning `handleScroll.vertTouchDrag` (bir barmoq bilan narx scroll) bizda mavjud; **ikki barmoq bilan pan** TV'da yo'q —
  biz ham qo'shmadik (TV parity).

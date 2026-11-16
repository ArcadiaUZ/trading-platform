/* _m13_gestures.js - TradingView charting-library gesturalari (RE asosida)

   Evidence (assets/bundles/81242...js, TradingView 1.20.87 chart bundle):
   - pinchEvent(e,t,i,s){ const r = 10*(s - this._prevPinchScale); this._prevPinchScale = s;
       this._chartModel().zoomTime(e.x, r, true); }         // chart pinch = FAQAT vaqt zoom, 10x gain
   - price scale widget pinch: startTwoPointsScalePrice(t.y,i.y) / twoPointsScalePriceTo(...)
   - kinetic: useKineticScroll=isAnyMobile; addStart: t-e.timeStamp<=50ms;
       addPosition: faqat |dx|>=15px yoki bir xil timeStamp; _moveSampleCount>=2 shart
   - handleScroll: {horzTouchDrag, vertTouchDrag}  handleScale: {pinch, axisPressedMouseMove}
*/

var G = { on: false, pts: new Map(), samples: [], downT: 0, firstMoveT: 0, moved: 0,
          fling: 0, flingV: 0, mode: '', dRef: 0, sPrev: 1, rRange: 0, rMid: 0, pinchAxis: '',
          stats: { flings: 0, pinches: 0, pricePinches: 0, verticalIgnored: 0, heldNoFling: 0 } };
var KIN = { SAMPLE_PX: 15, HOLD_MS: 50, MIN_SAMPLES: 2, TAU: 210, VMIN: 0.015, VMAX: 3.2 };

function gRect(){ return cv.getBoundingClientRect(); }
function gLocal(e){ var r = gRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function gHaptic(ms){ try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
function gInPriceAxis(q){ return q.x > LAY.plotW; }
function gInTimeAxis(q){ return q.y > H - LAY.timeH; }

/* ---------- kinetic (fling) ---------- */
function gStopFling(){ if (G.fling) { cancelAnimationFrame(G.fling); G.fling = 0; } }
function gFling(vx){
  var v = clamp(vx, -KIN.VMAX, KIN.VMAX);
  if (Math.abs(v) < 0.12) return;
  G.stats.flings++;
  gHaptic(8);
  var last = performance.now();
  function step(now){
    var dt = Math.min(34, now - last); last = now;
    var f = Math.exp(-dt / KIN.TAU);
    var prev = V.rightOffset;
    V.rightOffset += v * dt / V.spacing;
    clampOffset();
    v *= f;
    if (V.rightOffset === prev) v = 0;
    mark();
    if (Math.abs(v) < KIN.VMIN) { G.fling = 0; return; }
    G.fling = requestAnimationFrame(step);
  }
  gStopFling();
  G.fling = requestAnimationFrame(step);
}

/* ---------- pinch ---------- */
function gPinchInfo(){
  var a = null, b = null;
  G.pts.forEach(function (p) { if (!a) a = p; else if (!b) b = p; });
  if (!a || !b) return null;
  var dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  return { a: a, b: b, d: Math.hypot(a.x - b.x, a.y - b.y), dy: dy,
           mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
           priceAxis: gInPriceAxis(a) && gInPriceAxis(b),
           timeAxis: gInTimeAxis(a) && gInTimeAxis(b) };
}

function gPinchMove(){
  var pi = gPinchInfo();
  if (!pi || !V.pinch) return;
  if (!G.dRef) { G.dRef = pi.d; G.sPrev = 1; G.pinchAxis = pi.priceAxis ? 'price' : 'time'; G.rRange = V.priceMax - V.priceMin; G.rMid = yP(pi.my); gHaptic(6); G.stats.pinches++; }
  var s = G.dRef > 6 ? pi.d / G.dRef : 1;
  if (G.pinchAxis === 'price') {
    /* TV: price scale widget 2-nuqta scale - o'rtadagi narxga tayanadi */
    V.autoPrice = false;
    var f = G.sPrev > 0.01 ? G.sPrev / Math.max(0.01, s) : 1;
    f = clamp(f, 0.6, 1.7);
    var rng = (V.priceMax - V.priceMin) * f;
    var mid = G.rMid;
    var k = (mid - V.priceMin) / ((V.priceMax - V.priceMin) || 1);
    V.priceMin = mid - rng * k; V.priceMax = V.priceMin + rng;
    if (!isFinite(V.priceMin) || !isFinite(V.priceMax)) { V.autoPrice = true; }
    G.stats.pricePinches++;
    G.sPrev = s;
  } else {
    /* TV: 10 * (s - sPrev) gain bilan zoomTime(centerX) */
    var ds = s - G.sPrev;
    if (Math.abs(ds) > 0.0004) {
      var factor = clamp(1 + 10 * ds, 0.55, 1.8);
      setSpacing(V.spacing * factor, iOf(pi.mx), pi.mx);
    }
    G.sPrev = s;
    if (pi.dy / Math.max(1, pi.d) > 0.85) G.stats.verticalIgnored++;
  }
  /* eski (ikki o'qli) pinch mantiqni neytrallashtirish */
  V.pinch.d0 = pi.d;
  if (pi.dy > 6) V.pinch.dy0 = pi.dy;
  V.pinch.sp0 = V.spacing;
  V.pinch.rng0 = V.priceMax - V.priceMin;
  V.pinch.mid0 = (V.priceMax + V.priceMin) / 2;
  mark();
}

/* ---------- listeners (document capture: _m3 handlerlaridan oldin) ---------- */
function gDown(e){
  if (e.target !== cv) return;
  gStopFling();
  var q = gLocal(e);
  G.pts.set(e.pointerId, { x: q.x, y: q.y });
  if (G.pts.size === 1) {
    G.samples = [{ x: q.x, t: e.timeStamp }];
    G.downT = e.timeStamp; G.firstMoveT = 0; G.moved = 0;
    G.dRef = 0; G.sPrev = 1; G.pinchAxis = '';
  } else if (G.pts.size === 2) {
    G.samples = [];
    G.dRef = 0; G.sPrev = 1;
  }
}

function gMove(e){
  var p = G.pts.get(e.pointerId);
  if (!p) return;
  if (e.target !== cv && G.pts.size < 2) return;
  var q = gLocal(e);
  var dx = q.x - p.x;
  p.x = q.x; p.y = q.y;
  if (G.pts.size >= 2) { gPinchMove(); return; }
  if (!G.firstMoveT && (Math.abs(dx) > 2 || Math.abs(q.y - p.y) > 2)) G.firstMoveT = e.timeStamp;
  G.moved += Math.abs(dx);
  var last = G.samples[G.samples.length - 1];
  if (!last || e.timeStamp === last.t || Math.abs(q.x - last.x) >= KIN.SAMPLE_PX) {
    G.samples.push({ x: q.x, t: e.timeStamp });
    if (G.samples.length > 8) G.samples.shift();
  }
}

function gUp(e){
  if (!G.pts.has(e.pointerId)) return;
  G.pts.delete(e.pointerId);
  if (G.pts.size > 0) { G.dRef = 0; return; }
  var wasTwoFinger = G.stats.pinches !== G._pinchMark;
  G._pinchMark = G.stats.pinches;
  G.dRef = 0;
  if (wasTwoFinger) return;
  if (V.pinch || D.drawing || V.axis || D.drag) return;
  /* TV: press->harakat 50ms dan kech bo'lsa inertsiya yo'q (long-press drag) */
  if (!G.firstMoveT || (G.firstMoveT - G.downT) > KIN.HOLD_MS) { if (G.moved > 20) G.stats.heldNoFling++; return; }
  var s = G.samples;
  if (s.length < KIN.MIN_SAMPLES) return;
  var a = s[0], b = s[s.length - 1];
  var dt = b.t - a.t;
  if (dt < 8 || dt > 260) return;
  var v = (b.x - a.x) / dt;
  if (Math.abs(v) >= 0.12) gFling(v);
}

/* ---------- double tap axes (TV: doubleTapEvent -> reset) ---------- */
var GTAP = { t: 0, x: 0, y: 0 };
function gTap(e){
  if (e.target !== cv) return;
  var q = gLocal(e);
  var now = Date.now();
  var isDbl = (now - GTAP.t < 320) && Math.hypot(q.x - GTAP.x, q.y - GTAP.y) < 30;
  GTAP.t = now; GTAP.x = q.x; GTAP.y = q.y;
  if (!isDbl) return;
  if (gInPriceAxis(q)) { V.autoPrice = true; gHaptic(12); toast('Narx avto', ''); mark(); }
  else if (gInTimeAxis(q)) { V.autoPrice = true; fit(); gHaptic(12); toast('Masshtab fit', ''); }
}

function gInit(){
  if (G.on) return;
  G.on = true;
  G._pinchMark = 0;
  document.addEventListener('pointerdown', gDown, true);
  document.addEventListener('pointermove', gMove, true);
  document.addEventListener('pointerup', gUp, true);
  document.addEventListener('pointercancel', gUp, true);
  cv.addEventListener('pointerup', gTap, false);
  window.GEST = G;
}
setTimeout(gInit, 900);
/* ==========================================================================
   MOBILE CHART ENGINE — canvas + touch gestures (TV-uslub)
   ========================================================================== */
'use strict';

var cv, ctx, DPR = 1, W = 0, H = 0;
var LAY = { priceW: 54, timeH: 20, plotW: 0, priceH: 0, volH: 0 };
var V = { spacing: 9, rightOffset: 4, autoPrice: true, cross: null, dirty: true,
          pinch: null, pan: null, axis: null, drag: null, pdown: null,
          lastTap: 0, lastTapX: 0, lastTapY: 0, longPress: null, lpTimer: null };
var D = { items: [], tool: 'crosshair', sel: null, pending: null, drag: null,
          magnet: true, undo: [], redo: [], drawing: false };
var CSSV = {};
var DK = 'xauview.m.drawings.';
var FIB_LV = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

function readVars(){
  var cs = getComputedStyle(document.body);
  ['--bg','--panel','--panel2','--border','--border2','--text','--text2','--text3','--up','--down',
   '--accent','--cross','--asiaF','--asiaB','--lonF','--nyF','--bsl','--ssl','--fvg','--fvgB']
    .forEach(function(k){ CSSV[k] = cs.getPropertyValue(k).trim(); });
}
function col(k){ return CSSV[k] || '#888'; }

/* ---------- init / layout ---------- */
function initCanvas(){
  cv = document.getElementById('chart');
  ctx = cv.getContext('2d');
  bindTouch();
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function(){ setTimeout(resize, 120); });
}
function resize(){
  DPR = Math.max(1, Math.min(2.4, window.devicePixelRatio || 1));
  var r = cv.parentElement.getBoundingClientRect();
  W = Math.max(180, Math.floor(r.width));
  H = Math.max(160, Math.floor(r.height));
  cv.width = Math.floor(W * DPR);
  cv.height = Math.floor(H * DPR);
  cv.style.width = W + 'px';
  cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  relayout();
  if (V.fitPending) { fit(); V.fitPending = false; }
  mark();
}
function relayout(){
  LAY.plotW = W - LAY.priceW;
  var inner = H - LAY.timeH;
  LAY.volH = S.ind.vol ? Math.round(inner * 0.15) : 0;
  LAY.priceH = inner - LAY.volH - (LAY.volH ? 1 : 0);
}
function mark(){ V.dirty = true; schedule(); }
var rafP = false;
function schedule(){
  if (rafP) return;
  rafP = true;
  requestAnimationFrame(function(){ rafP = false; if (V.dirty) { V.dirty = false; drawAll(); } });
}

/* ---------- coordinates ---------- */
function nB(){ return cur().length; }
function rightIdx(){ return (nB() - 1) + V.rightOffset; }
function xOf(fi){ return LAY.plotW - (rightIdx() - fi + 0.5) * V.spacing; }
function iOf(x){ return rightIdx() + 0.5 - (LAY.plotW - x) / V.spacing; }
function pY(p){
  var r = V.priceMax - V.priceMin || 1;
  return LAY.priceH - (p - V.priceMin) / r * LAY.priceH;
}
function yP(y){
  var r = V.priceMax - V.priceMin || 1;
  return V.priceMin + (LAY.priceH - y) / LAY.priceH * r;
}
function idxAtTs(ts){
  var b = cur(), lo = 0, hi = b.length - 1;
  if (ts <= b[0][0]) return 0;
  if (ts >= b[hi][0]) return hi + (ts - b[hi][0]) / TF_SEC[S.tf];
  while (hi - lo > 1) { var m = (lo + hi) >> 1; if (b[m][0] <= ts) lo = m; else hi = m; }
  var t0 = b[lo][0], t1 = b[hi][0];
  return lo + (t1 > t0 ? (ts - t0) / (t1 - t0) : 0);
}
function tsAtIdx(f){
  var b = cur(), i = Math.floor(f);
  if (i < 0) return b[0][0] + i * TF_SEC[S.tf];
  if (i >= b.length - 1) return b[b.length - 1][0] + (f - (b.length - 1)) * TF_SEC[S.tf];
  var a = b[i][0], z = b[i + 1][0];
  return a + (z - a) * (f - i);
}
function tsX(ts){ return xOf(idxAtTs(ts)); }
function xTs(x){ return tsAtIdx(iOf(x)); }
function visRange(){
  var b = cur();
  var i0 = Math.max(0, Math.floor(iOf(-1)));
  var i1 = Math.min(b.length - 1, Math.ceil(iOf(LAY.plotW + 1)));
  return { i0: i0, i1: i1 };
}
function autoPrice(){
  if (!V.autoPrice) return;
  var b = cur(), v = visRange(), mn = Infinity, mx = -Infinity;
  for (var i = v.i0; i <= v.i1; i++) {
    if (b[i][2] > mx) mx = b[i][2];
    if (b[i][3] < mn) mn = b[i][3];
  }
  if (!isFinite(mn) || !isFinite(mx)) return;
  var pad = (mx - mn) * 0.10 || 1e-4;
  V.priceMin = mn - pad;
  V.priceMax = mx + pad;
}
function fit(){
  V.spacing = clamp(LAY.plotW / 62, 3.2, 26);
  V.rightOffset = 3;
  V.autoPrice = true;
  mark();
}
function clampOffset(){ V.rightOffset = clamp(V.rightOffset, -2, nB() + 30); }

/* ---------- primitives ---------- */
function line(x1, y1, x2, y2, c, w, dash){
  ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w || 1;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function txt(s, x, y, c, align, font){
  ctx.save(); ctx.fillStyle = c; ctx.font = font || '11px -apple-system,Segoe UI,Roboto,sans-serif';
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); ctx.restore();
}
function rect(x, y, w, h, fill, stroke, lw){
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  if (stroke) { ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); ctx.restore(); }
}
function rr(x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function pill(text, x, y, bg, fg, w){
  ctx.save();
  ctx.font = '10px -apple-system,Segoe UI,Roboto,sans-serif';
  var tw = w || (ctx.measureText(text).width + 8);
  ctx.fillStyle = bg; rr(x, y - 7.5, tw, 15, 3); ctx.fill();
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + tw / 2, y + .5);
  ctx.restore();
}

/* ---------- scales / ticks ---------- */
function niceStep(range, target){
  var raw = range / Math.max(1, target);
  var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
  var norm = raw / mag;
  var m = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return m * mag;
}
function priceTicks(){
  var step = niceStep(V.priceMax - V.priceMin, LAY.priceH / 42), out = [];
  var st = Math.ceil(V.priceMin / step) * step;
  for (var p = st; p <= V.priceMax; p += step) if (p > 0) out.push(p);
  return out;
}
function timeTicks(){
  var b = cur(), v = visRange(), tfSec = TF_SEC[S.tf];
  var cands = [60,120,300,600,900,1800,3600,7200,10800,14400,21600,43200,86400,172800,604800,1209600];
  var step = null;
  for (var c = 0; c < cands.length; c++) if (cands[c] / tfSec * V.spacing >= 74) { step = cands[c]; break; }
  if (!step) step = 1209600;
  var out = [], prev = null, first = true, lim = Math.min(v.i1, b.length - 1);
  for (var i = v.i0; i <= lim; i++) {
    var bucket = Math.floor((b[i][0] + TZ_OFF) / step);
    if (bucket !== prev) { prev = bucket; if (!first) out.push({ i: i, ts: b[i][0], step: step }); }
    first = false;
  }
  return out;
}
function timeLabel(ts, step){
  var d = dts(ts);
  if (step >= 86400) return d.getUTCDate() + ' ' + MON[d.getUTCMonth()];
  var h = d.getUTCHours(), m = d.getUTCMinutes();
  if (step >= 3600 && h === 0 && m === 0) return d.getUTCDate() + ' ' + MON[d.getUTCMonth()];
  return pad2(h) + ':' + pad2(m);
}

/* ---------- render ---------- */
function drawAll(){
  var b = cur(), v = visRange();
  if (!b || !b.length) return;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = col('--bg'); ctx.fillRect(0, 0, W, H);
  autoPrice();
  if (S.ind.asia || S.ind.kill) drawSession(b, v);
  drawWatermark();
  var pt = priceTicks(), tt = timeTicks();
  drawGrid(pt, tt);
  if (S.ind.fu) drawZones();
  if (S.ind.fvg) drawFvgs(v);
  if (S.ind.asia) drawAsia(b, v);
  drawCandles(b, v);
  if (S.ind.vol) drawVolume(b, v);
  if (S.ind.sweep) drawSweeps(b, v);
  drawDrawings();
  drawLastPrice(b);
  drawAxes(pt, tt);
  drawCrosshair();
  drawLoupe();
}
/* ---------- long-press lupa (kattalashtiruvchi oyna) ---------- */
function startLongPress(id){
  V.lpTimer = null;
  var p = PTR.get(id);
  if (!p || p.moved) return;
  var b = cur(); if (!b || !b.length) return;
  var bi = clamp(Math.round(iOf(p.x)), 0, b.length - 1);
  V.longPress = { x: p.x, y: p.y, id: id };
  V.pan = null;
  V.cross = { x: xOf(bi), y: p.y };
  hideCrossTip();
  updateLegendForBar(bi);
  try { if (navigator.vibrate) navigator.vibrate(14); } catch (e) {}
  mark();
}
function drawLoupe(){
  if (!V.longPress) return;
  var p = V.longPress, r = 58, zoom = 2.6;
  var cx = clamp(p.x, r + 8, LAY.plotW - r - 8);
  var cy = clamp(p.y - 96, r + 8, LAY.priceH - r - 8);
  var half = r / zoom;
  var sx = (p.x - half) * DPR, sy = (p.y - half) * DPR, sw = half * 2 * DPR;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy + 3, r, 0, 6.2832); ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.closePath();
  ctx.fillStyle = col('--panel'); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.imageSmoothingEnabled = false;
  try { ctx.drawImage(cv, sx, sy, sw, sw, cx - r, cy - r, r * 2, r * 2); } catch (e) {}
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.strokeStyle = col('--border2'); ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - 3.5, 0, 6.2832); ctx.strokeStyle = col('--panel2'); ctx.lineWidth = 1; ctx.stroke();
  ctx.setLineDash([2, 3]); ctx.strokeStyle = col('--cross'); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - r + 4, cy + .5); ctx.lineTo(cx + r - 4, cy + .5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + .5, cy - r + 4); ctx.lineTo(cx + .5, cy + r - 4); ctx.stroke();
  ctx.setLineDash([]);
  var pr = yP(p.y);
  var pw = ctx.measureText(fpx2(pr)).width || 34;
  ctx.fillStyle = col('--panel2');
  rr(cx - 22, cy + r - 15, 44, 15, 3); ctx.fill();
  txt(fpx2(pr), cx, cy + r - 7.5, col('--text'), 'center', '9px -apple-system,Segoe UI,Roboto,sans-serif');
  ctx.restore();
}
function drawWatermark(){
  var s = ASSETS[S.sym].provider + ':' + S.sym + '  ' + S.tf;
  ctx.save();
  ctx.globalAlpha = .05; ctx.fillStyle = col('--text');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 20px -apple-system,Segoe UI,Roboto,sans-serif';
  ctx.fillText(s, LAY.plotW / 2, LAY.priceH / 2);
  ctx.restore();
}
function drawSession(b, v){
  var bw = Math.max(1, V.spacing);
  for (var i = v.i0; i <= v.i1; i++) {
    var ts = b[i][0], d = dts(ts), h = d.getUTCHours(), mi = d.getUTCMinutes();
    var c = null;
    if (S.ind.asia && h >= S.asiaStart && h < S.asiaEnd) c = col('--asiaF');
    else if (S.ind.kill && (h > S.lonStart || (h === S.lonStart && mi >= S.lonMin)) && h < S.lonEnd) c = col('--lonF');
    else if (S.ind.kill && (h > S.nyStart || (h === S.nyStart && mi >= S.nyMin)) && h < S.nyEnd) c = col('--nyF');
    if (c) { ctx.fillStyle = c; ctx.fillRect(xOf(i) - bw / 2, 0, Math.ceil(bw), LAY.priceH); }
  }
}
function drawGrid(pt, tt){
  ctx.save(); ctx.strokeStyle = col('--border'); ctx.lineWidth = 1;
  for (var i = 0; i < pt.length; i++) {
    var y = Math.round(pY(pt[i])) + .5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LAY.plotW, y); ctx.stroke();
  }
  for (var j = 0; j < tt.length; j++) {
    var x = Math.round(xOf(tt[j].i)) + .5;
    if (x < 0 || x > LAY.plotW) continue;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - LAY.timeH); ctx.stroke();
  }
  ctx.restore();
}
function drawCandles(b, v){
  var bw = Math.max(1, Math.round(V.spacing * 0.72));
  var thin = V.spacing < 2.2;
  for (var i = v.i0; i <= v.i1; i++) {
    var r = b[i], o = r[1], h = r[2], l = r[3], c = r[4];
    var up = c >= o, color = up ? col('--up') : col('--down');
    var xc = Math.round(xOf(i)) + .5;
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xc, Math.round(pY(h)) + .5); ctx.lineTo(xc, Math.round(pY(l)) + .5); ctx.stroke();
    if (thin) continue;
    var top = Math.min(pY(o), pY(c));
    var hgt = Math.max(1, Math.abs(pY(c) - pY(o)));
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(xc - bw / 2), Math.round(top), bw, Math.round(hgt));
  }
}
function drawVolume(b, v){
  if (!LAY.volH) return;
  var y0 = LAY.priceH + 1, mx = 1, i;
  for (i = v.i0; i <= v.i1; i++) if (b[i][5] > mx) mx = b[i][5];
  var bw = Math.max(1, Math.round(V.spacing * 0.72));
  for (i = v.i0; i <= v.i1; i++) {
    var r = b[i], up = r[4] >= r[1];
    var hh = Math.max(1, Math.round(r[5] / mx * (LAY.volH - 3)));
    ctx.fillStyle = up ? 'rgba(34,171,148,.5)' : 'rgba(247,82,95,.5)';
    ctx.fillRect(Math.round(xOf(i) - bw / 2), y0 + LAY.volH - hh, bw, hh);
  }
  line(0, y0 - .5, LAY.plotW, y0 - .5, col('--border'), 1);
}
function drawAsia(b, v){
  var ind = getInd(S.sym, S.tf), boxes = ind.boxes, pip = pipOf();
  var maxP = S.sym === 'XAUUSD' ? S.maxAsianPipsGold : S.maxAsianPipsFx;
  for (var k = Math.max(0, boxes.length - 10); k < boxes.length; k++) {
    var bx = boxes[k], isLast = (k === boxes.length - 1);
    if (bx.i1 < v.i0 - 20 || bx.i0 > v.i1 + 20) continue;
    var x0 = xOf(bx.i0), x1 = xOf(bx.i1), yh = pY(bx.high), yl = pY(bx.low);
    if (x1 < LAY.plotW - 2 && x0 > -2) rect(x0, yh, x1 - x0, yl - yh, null, col('--asiaB'), 1);
    else { line(x0, yh, Math.min(x1, LAY.plotW), yh, col('--asiaB'), 1); line(x0, yl, Math.min(x1, LAY.plotW), yl, col('--asiaB'), 1); }
    var endIdx = bx.i1;
    for (var j = bx.i1 + 1; j < b.length; j++) if (dayKey(b[j][0]) !== bx.key) { endIdx = j - 1; break; }
    var xe = xOf(endIdx);
    ctx.save(); ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2;
    ctx.strokeStyle = col('--bsl'); ctx.beginPath(); ctx.moveTo(x0, yh); ctx.lineTo(xe, yh); ctx.stroke();
    ctx.strokeStyle = col('--ssl'); ctx.beginPath(); ctx.moveTo(x0, yl); ctx.lineTo(xe, yl); ctx.stroke();
    ctx.restore();
    if (x1 - x0 < 58 && !isLast) continue;
    var pips = Math.round((bx.high - bx.low) / pip);
    var label = 'ASIAN ' + pips + ' ' + (pips <= maxP ? 'PRIME' : 'WIDE');
    var w = label.length * 5 + 9;
    var lx = clamp(x0 + 2, 2, Math.max(2, LAY.plotW - w - 2));
    var ly = yh - 7;
    if (lx < 210 && ly < 52) ly = yl + 8;
    if (yl > LAY.priceH - 6) continue;
    if (ly < 10) ly = 10;
    if (ly > LAY.priceH - 8) ly = LAY.priceH - 8;
    pill(label, lx, ly, col('--panel2'), col('--text'), w);
  }
}
function zoneBox(x0, x1, top, bot, color, alpha, label){
  var y0 = pY(top), y1 = pY(bot);
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.restore();
  ctx.save(); ctx.globalAlpha = .6; ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.strokeRect(x0 + .5, y0 + .5, Math.max(0, x1 - x0 - 1), Math.max(0, y1 - y0 - 1)); ctx.restore();
  if (label && x1 - x0 > 46 && Math.abs(y1 - y0) > 13) {
    var w = label.length * 4.9 + 7;
    var lx = clamp(x0 + 2, 2, Math.max(2, LAY.plotW - w - 2));
    rect(lx, y0 + 2, w, 11, col('--panel2'), null, 0);
    txt(label, lx + 3.5, y0 + 7.5, color, 'left', '8.5px -apple-system,Segoe UI,Roboto,sans-serif');
  }
}
function drawZones(){
  var ind = getInd(S.sym, S.tf), k, z;
  var own = ind.zones.slice(-5);
  for (k = 0; k < own.length; k++) {
    z = own[k];
    if (z.i1 < nB() - S.zoneLookback) continue;
    var x0 = xOf(z.i0), x1 = xOf(z.i1);
    if (x1 < -30 || x0 > LAY.plotW + 30) continue;
    var lb = (Math.abs(pY(z.top) - pY(z.bottom)) > 13 && x1 - x0 > 46) ? (S.tf + ' ' + z.kind) : '';
    zoneBox(x0, x1, z.top, z.bottom, z.bull ? '#22AB94' : '#F7525F', .10, lb);
  }
  for (var t in ind.upper) {
    if (t === S.tf) continue;
    var arr = ind.upper[t].slice(-3), bars = ASSETS[S.sym].tfs[t];
    for (k = 0; k < arr.length; k++) {
      z = arr[k];
      var xx0 = tsX(bars[z.i0][0]), xx1 = tsX(bars[z.i1][0]);
      if (xx1 < -30 || xx0 > LAY.plotW + 30) continue;
      var l2 = (Math.abs(pY(z.top) - pY(z.bottom)) > 13 && xx1 - xx0 > 46) ? (t + ' ' + z.kind) : '';
      zoneBox(xx0, xx1, z.top, z.bottom, ZONE_COL[t] || '#8C8C8C', .05, l2);
    }
  }
}
function drawFvgs(v){
  var ind = getInd(S.sym, S.tf);
  for (var k = 0; k < ind.fvgs.length; k++) {
    var f = ind.fvgs[k];
    if (f.i1 < v.i0 - 12) continue;
    rect(xOf(f.i0), pY(f.top), xOf(f.i1) - xOf(f.i0), pY(f.bottom) - pY(f.top), col('--fvg'), col('--fvgB'), 1);
  }
}
function drawSweeps(b, v){
  var ind = getInd(S.sym, S.tf);
  for (var k = 0; k < ind.sweeps.length; k++) {
    var s = ind.sweeps[k];
    if (s.i < v.i0 - 6 || s.i > v.i1 + 6) continue;
    var x = xOf(s.i), y = s.dir === 'up' ? pY(s.level) - 8 : pY(s.level) + 8;
    var c = s.dir === 'up' ? col('--down') : col('--up');
    ctx.save(); ctx.fillStyle = c; ctx.beginPath();
    if (s.dir === 'up') { ctx.moveTo(x, y - 6); ctx.lineTo(x - 4, y + 2); ctx.lineTo(x + 4, y + 2); }
    else { ctx.moveTo(x, y + 6); ctx.lineTo(x - 4, y - 2); ctx.lineTo(x + 4, y - 2); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
}
function drawLastPrice(b){
  var last = b[b.length - 1], up = last[4] >= last[1];
  var y = pY(last[4]);
  if (y < 0 || y > LAY.priceH) return;
  line(0, y, LAY.plotW, y, up ? col('--up') : col('--down'), 1, [3, 3]);
}
function drawAxes(pt, tt){
  var b = cur();
  ctx.save();
  ctx.fillStyle = col('--panel'); ctx.fillRect(LAY.plotW, 0, LAY.priceW, H);
  ctx.fillStyle = col('--panel'); ctx.fillRect(0, H - LAY.timeH, LAY.plotW, LAY.timeH);
  ctx.fillStyle = col('--panel'); ctx.fillRect(LAY.plotW, H - LAY.timeH, LAY.priceW, LAY.timeH);
  ctx.strokeStyle = col('--border'); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(LAY.plotW + .5, 0); ctx.lineTo(LAY.plotW + .5, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, H - LAY.timeH + .5); ctx.lineTo(W, H - LAY.timeH + .5); ctx.stroke();
  ctx.restore();
  for (var i = 0; i < pt.length; i++) {
    var y = pY(pt[i]);
    if (y < 9 || y > LAY.priceH - 4) continue;
    txt(fpx2(pt[i]), LAY.plotW + 5, y, col('--text3'), 'left', '10px -apple-system,Segoe UI,Roboto,sans-serif');
  }
  for (var j = 0; j < tt.length; j++) {
    var x = xOf(tt[j].i);
    if (x < 20 || x > LAY.plotW - 6) continue;
    txt(timeLabel(tt[j].ts, tt[j].step), x, H - LAY.timeH / 2, col('--text3'), 'center', '10px -apple-system,Segoe UI,Roboto,sans-serif');
  }
  var last = b[b.length - 1], y2 = pY(last[4]), up = last[4] >= last[1];
  if (y2 > 2 && y2 < LAY.priceH - 2) {
    ctx.save(); ctx.fillStyle = up ? col('--up') : col('--down');
    rr(LAY.plotW + 2, y2 - 8, LAY.priceW - 4, 16, 3); ctx.fill(); ctx.restore();
    txt(fpx(last[4]), LAY.plotW + LAY.priceW / 2, y2, '#fff', 'center', '10px -apple-system,Segoe UI,Roboto,sans-serif');
  }
}
function drawCrosshair(){
  if (!V.cross) return;
  var x = V.cross.x, y = V.cross.y;
  ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = col('--cross'); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, H - LAY.timeH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(LAY.plotW, Math.round(y) + .5); ctx.stroke();
  ctx.restore();
}

/* ---------- drawings ---------- */
function loadDrawings(){
  try { D.items = JSON.parse(localStorage.getItem(DK + S.sym) || '[]') || []; } catch (e) { D.items = []; }
  D.sel = null; D.pending = null;
}
function saveDrawings(){
  try { localStorage.setItem(DK + S.sym, JSON.stringify(D.items)); } catch (e) {}
}
function snapshot(){
  D.undo.push(JSON.stringify(D.items));
  if (D.undo.length > 60) D.undo.shift();
  D.redo.length = 0;
}
function undo(){
  if (!D.undo.length) return;
  D.redo.push(JSON.stringify(D.items));
  D.items = JSON.parse(D.undo.pop());
  D.sel = null; saveDrawings(); mark();
}
function redo(){
  if (!D.redo.length) return;
  D.undo.push(JSON.stringify(D.items));
  D.items = JSON.parse(D.redo.pop());
  D.sel = null; saveDrawings(); mark();
}
function uid(){ return 'm' + Math.random().toString(36).slice(2, 8); }
function newItem(type, pts, extra){
  var it = { id: uid(), type: type, pts: pts, color: col('--accent'), width: 1.6,
             style: 'solid', opacity: 1, fill: false, fillColor: null, fontSize: 11, locked: false };
  if (type === 'brush') { it.width = 3; it.opacity = 1; }
  if (type === 'highlighter') { it.width = 14; it.opacity = 0.35; }
  if (type === 'channel') { it.fill = true; }
  if (extra) for (var k in extra) it[k] = extra[k];
  return it;
}
var TYPE_NAME = { trendline: 'Trendline', hline: 'Horizontal', vline: 'Vertical', rect: 'Rectangle', text: 'Text', fib: 'Fibo retracement', measure: 'Olchov', ray: 'Ray', arrow: 'Streleka', hray: 'Gorizontal ray', brush: 'Brush', highlighter: 'Marker', channel: 'Kanal' };
var DASH = { solid: null, dash: [7, 5], dot: [1.5, 4] };
function drawDrawings(){
  for (var i = 0; i < D.items.length; i++) {
    if (D.items[i].hidden) continue;
    drawItem(D.items[i], D.items[i] === D.sel);
  }
  if (D.pending && D.pending.pts.length) {
    var pv = D.pending.pts.slice();
    if (D.pending.cur && (!D.freehand)) pv = pv.concat([D.pending.cur]);
    drawItem({ type: D.pending.type, pts: pv, color: col('--accent'), width: 1.2, opacity: .85, style: 'solid', fill: false }, false, true);
  }
}
function drawFreehand(pts, c, w, glow){
  var n = pts.length;
  if (n < 2) return;
  var xs = [], ys = [];
  for (var i = 0; i < n; i++) { xs.push(tsX(pts[i].ts)); ys.push(pY(pts[i].p)); }
  var pass = function(pw, pa){
    ctx.globalAlpha *= pa;
    ctx.lineWidth = pw; ctx.strokeStyle = c;
    ctx.beginPath(); ctx.moveTo(xs[0], ys[0]);
    if (n === 2) { ctx.lineTo(xs[1], ys[1]); }
    else {
      for (var j = 1; j < n - 1; j++) {
        var mx = (xs[j] + xs[j + 1]) / 2, my = (ys[j] + ys[j + 1]) / 2;
        ctx.quadraticCurveTo(xs[j], ys[j], mx, my);
      }
      ctx.lineTo(xs[n - 1], ys[n - 1]);
    }
    ctx.stroke();
    ctx.globalAlpha /= pa;
  };
  if (glow) { pass(w * 1.35, 0.30); }
  pass(w, 1);
}
function drawChannel(it){
  var a = it.pts[0], b = it.pts[1], cc = it.pts[2] || it.pts[1];
  var xa = tsX(a.ts), ya = pY(a.p), xb = tsX(b.ts), yb = pY(b.p), xc = tsX(cc.ts), yc = pY(cc.p);
  if (Math.abs(xb - xa) < 0.5) return;
  var k = (yb - ya) / (xb - xa);
  var L = -12, R = LAY.plotW + 12;
  var y1L = ya + (L - xa) * k, y1R = ya + (R - xa) * k;
  var y2L = yc + (L - xc) * k, y2R = yc + (R - xc) * k;
  if (it.fill !== false) {
    var base = ctx.globalAlpha;
    ctx.globalAlpha = base * 0.13;
    ctx.fillStyle = it.fillColor || it.color || col('--accent');
    ctx.beginPath(); ctx.moveTo(L, y1L); ctx.lineTo(R, y1R); ctx.lineTo(R, y2R); ctx.lineTo(L, y2L); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = base;
  }
  ctx.beginPath(); ctx.moveTo(L, y1L); ctx.lineTo(R, y1R); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L, y2L); ctx.lineTo(R, y2R); ctx.stroke();
  var kk = (xc - xa) / (xb - xa);
  var span = Math.abs(cc.p - (a.p + (b.p - a.p) * kk));
  if (Math.abs(y2R - y1R) > 14) txt(fpx2(span), R - 4, (y1R + y2R) / 2 - 3, it.fillColor || c0(it), 'right', '10px -apple-system,Segoe UI,Roboto,sans-serif');
}
function c0(it){ return it.color || col('--accent'); }
function drawItem(it, selected, preview){
  var c = it.color || col('--accent'), w = it.width || 1.6;
  var p0 = it.pts[0], p1 = it.pts[1];
  var AL = preview ? 0.85 : (it.opacity == null ? 1 : it.opacity);
  ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.fillStyle = c;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.globalAlpha = AL;
  if (preview) ctx.setLineDash([4, 3]);
  else if (DASH[it.style]) ctx.setLineDash(DASH[it.style]);
  if (it.type === 'hline') {
    var y = pY(p0.p);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(LAY.plotW, y); ctx.stroke();
    pill(fpx2(p0.p), LAY.plotW + 2, y, c, '#fff', LAY.priceW - 5);
  } else if (it.type === 'vline') {
    var x = tsX(p0.ts);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H - LAY.timeH); ctx.stroke();
  } else if (it.type === 'trendline') {
    if (!p1) { ctx.restore(); return; }
    ctx.beginPath(); ctx.moveTo(tsX(p0.ts), pY(p0.p)); ctx.lineTo(tsX(p1.ts), pY(p1.p)); ctx.stroke();
  } else if (it.type === 'ray') {
    if (!p1) { ctx.restore(); return; }
    var rx0 = tsX(p0.ts), ry0 = pY(p0.p), rx1 = tsX(p1.ts), ry1 = pY(p1.p);
    var rdx = rx1 - rx0, rdy = ry1 - ry0;
    if (Math.abs(rdx) < 0.5 && Math.abs(rdy) < 0.5) { ctx.restore(); return; }
    var rk = rdx > 0 ? (LAY.plotW - rx0) / rdx : -1;
    var rex = rx0 + rdx * rk, rey = ry0 + rdy * rk;
    ctx.beginPath(); ctx.moveTo(rx0, ry0); ctx.lineTo(rex, rey); ctx.stroke();
    ctx.beginPath(); ctx.arc(rx0, ry0, 3, 0, 6.2832); ctx.fillStyle = c; ctx.fill();
  } else if (it.type === 'arrow') {
    if (!p1) { ctx.restore(); return; }
    var ax0 = tsX(p0.ts), ay0 = pY(p0.p), ax1 = tsX(p1.ts), ay1 = pY(p1.p);
    ctx.beginPath(); ctx.moveTo(ax0, ay0); ctx.lineTo(ax1, ay1); ctx.stroke();
    var aang = Math.atan2(ay1 - ay0, ax1 - ax0), ahl = 9;
    ctx.beginPath();
    ctx.moveTo(ax1, ay1);
    ctx.lineTo(ax1 - ahl * Math.cos(aang - 0.4), ay1 - ahl * Math.sin(aang - 0.4));
    ctx.lineTo(ax1 - ahl * Math.cos(aang + 0.4), ay1 - ahl * Math.sin(aang + 0.4));
    ctx.closePath(); ctx.fillStyle = c; ctx.fill();
  } else if (it.type === 'rect') {
    if (!p1) { ctx.restore(); return; }
    var xa = tsX(p0.ts), ya = pY(p0.p), xb = tsX(p1.ts), yb = pY(p1.p);
    var rx = Math.min(xa, xb), ry = Math.min(ya, yb), rw = Math.abs(xb - xa), rh = Math.abs(yb - ya);
    ctx.globalAlpha = AL * (it.fillColor ? 0.22 : 0.10);
    if (it.fillColor) ctx.fillStyle = it.fillColor;
    ctx.fillRect(rx, ry, rw, rh); ctx.globalAlpha = AL;
    ctx.strokeRect(rx + .5, ry + .5, rw, rh);
    if (rw > 64 && rh > 15) {
      var diff = p1.p - p0.p, pct = p0.p ? diff / p0.p * 100 : 0;
      txt((diff >= 0 ? '+' : '') + fpx2(diff) + '  ' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%', rx + 4, ry + 10, c);
    }
  } else if (it.type === 'text') {
    var fsz = it.fontSize || 12;
    txt(it.text || '', tsX(p0.ts), pY(p0.p), c, 'left', fsz + 'px -apple-system,Segoe UI,Roboto,sans-serif');
  } else if (it.type === 'fib') {
    if (!p1) { ctx.restore(); return; }
    var fx0 = tsX(p0.ts), fx1 = tsX(p1.ts);
    var fl = Math.min(fx0, fx1), fr = Math.max(fx0, fx1);
    if (fr - fl < 30) fr = fl + 30;
    var fd = p1.p - p0.p, fy0 = pY(p0.p), fy1 = pY(p1.p);
    ctx.globalAlpha = AL * 0.07; ctx.fillStyle = it.fillColor || c;
    ctx.fillRect(fl, Math.min(fy0, fy1), fr - fl, Math.abs(fy1 - fy0));
    ctx.globalAlpha = AL;
    for (var fi = 0; fi < FIB_LV.length; fi++) {
      var flv = FIB_LV[fi], fpp = p0.p + fd * flv, fyy = pY(fpp);
      if (fyy < -24 || fyy > LAY.priceH + 24) continue;
      ctx.globalAlpha = AL * 0.9; ctx.lineWidth = 1; ctx.strokeStyle = c;
      ctx.beginPath(); ctx.moveTo(fl, fyy + .5); ctx.lineTo(fr, fyy + .5); ctx.stroke();
      ctx.globalAlpha = AL;
      var flab = flv === 0 ? '0' : (flv === 1 ? '1' : String(flv));
      txt(flab, fl + 4, fyy - 7, c, 'left', '10px -apple-system,Segoe UI,Roboto,sans-serif');
      txt(fpx2(fpp), fr - 3, fyy - 7, c, 'right', '10px -apple-system,Segoe UI,Roboto,sans-serif');
    }
    ctx.strokeStyle = c; ctx.globalAlpha = AL * 0.45; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(fl, Math.min(fy0, fy1)); ctx.lineTo(fl, Math.max(fy0, fy1)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fr, Math.min(fy0, fy1)); ctx.lineTo(fr, Math.max(fy0, fy1)); ctx.stroke();
    ctx.globalAlpha = AL;
  } else if (it.type === 'measure') {
    if (!p1) { ctx.restore(); return; }
    var mx0 = tsX(p0.ts), my0 = pY(p0.p), mx1 = tsX(p1.ts), my1 = pY(p1.p);
    ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.strokeStyle = c;
    ctx.beginPath(); ctx.moveTo(mx0, my0); ctx.lineTo(mx1, my0); ctx.lineTo(mx1, my1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(mx0, my0); ctx.lineTo(mx1, my1); ctx.stroke();
    var mdp = p1.p - p0.p, mpct = p0.p ? mdp / p0.p * 100 : 0;
    var mnb = Math.abs(Math.round(iOf(mx1) - iOf(mx0)));
    var mlab = (mdp >= 0 ? '+' : '') + fpx2(mdp) + '  ' + (mpct >= 0 ? '+' : '') + mpct.toFixed(2) + '%  ' + mnb + ' bar';
    var mtx = (mx0 + mx1) / 2, mty = Math.min(my0, my1) - 9;
    ctx.font = '10px -apple-system,Segoe UI,Roboto,sans-serif';
    var mw = ctx.measureText(mlab).width + 10;
    ctx.fillStyle = col('--panel2');
    rr(mtx - mw / 2, mty - 8, mw, 16, 3); ctx.fill();
    txt(mlab, mtx, mty, col('--text'), 'center', '10px -apple-system,Segoe UI,Roboto,sans-serif');
  } else if (it.type === 'hray') {
    var hry = pY(p0.p);
    ctx.beginPath(); ctx.moveTo(tsX(p0.ts), hry); ctx.lineTo(LAY.plotW, hry); ctx.stroke();
    pill(fpx2(p0.p), LAY.plotW + 2, hry, c, '#fff', LAY.priceW - 5);
  } else if (it.type === 'brush' || it.type === 'highlighter') {
    drawFreehand(it.pts, c, w, it.type === 'highlighter');
  } else if (it.type === 'channel') {
    if (!p1) { ctx.restore(); return; }
    drawChannel(it);
  }
  ctx.restore();
  if (selected && it.type !== 'brush' && it.type !== 'highlighter') {
    for (var i = 0; i < it.pts.length; i++) {
      var pt = it.pts[i];
      var hx = pt.ts != null ? tsX(pt.ts) : 6;
      var hy = pt.p != null ? pY(pt.p) : 6;
      if (it.type === 'hline') hx = 8;
      if (it.type === 'vline') hy = 8;
      ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fillStyle = col('--bg'); ctx.fill();
      ctx.lineWidth = 1.8; ctx.strokeStyle = c; ctx.stroke(); ctx.restore();
    }
  }
}
function distSeg(px, py, x1, y1, x2, y2){
  var dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy;
  var t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function hitTest(x, y){
  for (var i = D.items.length - 1; i >= 0; i--) {
    var it = D.items[i];
    if (it.hidden) continue;
    var p0 = it.pts[0], p1 = it.pts[1];
    if (it.type === 'hline' && Math.abs(y - pY(p0.p)) < 10) return it;
    if (it.type === 'vline' && Math.abs(x - tsX(p0.ts)) < 10) return it;
    if (it.type === 'trendline' && p1 && distSeg(x, y, tsX(p0.ts), pY(p0.p), tsX(p1.ts), pY(p1.p)) < 12) return it;
    if (it.type === 'measure' && p1 && distSeg(x, y, tsX(p0.ts), pY(p0.p), tsX(p1.ts), pY(p1.p)) < 12) return it;
    if (it.type === 'arrow' && p1 && distSeg(x, y, tsX(p0.ts), pY(p0.p), tsX(p1.ts), pY(p1.p)) < 12) return it;
    if (it.type === 'ray' && p1) {
      var Ry0 = pY(p0.p), Rx0 = tsX(p0.ts), Ry1 = pY(p1.p), Rx1 = tsX(p1.ts);
      var Rdx = Rx1 - Rx0, Rdy = Ry1 - Ry0;
      if (Math.abs(Rdx) < 0.5 && Math.abs(Rdy) < 0.5) { if (Math.hypot(x - Rx0, y - Ry0) < 12) return it; }
      else {
        var Rk = Rdx > 0 ? (LAY.plotW - Rx0) / Rdx : -1;
        var Rex = Rx0 + Rdx * Rk, Rey = Ry0 + Rdy * Rk;
        if (distSeg(x, y, Rx0, Ry0, Rex, Rey) < 12) return it;
      }
    }
    if (it.type === 'fib' && p1) {
      var hd = p1.p - p0.p;
      var hl = Math.min(tsX(p0.ts), tsX(p1.ts)) - 10, hr = Math.max(tsX(p0.ts), tsX(p1.ts)) + 10;
      if (x >= hl && x <= hr) {
        for (var fk = 0; fk < FIB_LV.length; fk++) {
          if (Math.abs(y - pY(p0.p + hd * FIB_LV[fk])) < 8) return it;
        }
      }
    }
    if (it.type === 'rect' && p1) {
      var xa = tsX(p0.ts), ya = pY(p0.p), xb = tsX(p1.ts), yb = pY(p1.p);
      var l = Math.min(xa, xb), r = Math.max(xa, xb), t = Math.min(ya, yb), b = Math.max(ya, yb);
      if (x >= l - 8 && x <= r + 8 && y >= t - 8 && y <= b + 8) {
        if (Math.abs(x - l) < 10 || Math.abs(x - r) < 10 || Math.abs(y - t) < 10 || Math.abs(y - b) < 10) return it;
        if (x > l && x < r && y > t && y < b) return it;
      }
    }
    if (it.type === 'hray' && Math.abs(y - pY(p0.p)) < 10 && x >= tsX(p0.ts) - 6) return it;
    if ((it.type === 'brush' || it.type === 'highlighter') && it.pts.length > 1) {
      var btol = Math.max(11, (it.width || 3) / 2 + 6);
      for (var bi = 1; bi < it.pts.length; bi++) {
        if (distSeg(x, y, tsX(it.pts[bi - 1].ts), pY(it.pts[bi - 1].p), tsX(it.pts[bi].ts), pY(it.pts[bi].p)) < btol) return it;
      }
    }
    if (it.type === 'channel' && p1) {
      var cha = it.pts[0], chb = it.pts[1], chc = it.pts[2] || it.pts[1];
      var cxa = tsX(cha.ts), cya = pY(cha.p), cxb = tsX(chb.ts), cyb = pY(chb.p), cxc = tsX(chc.ts), cyc = pY(chc.p);
      if (Math.abs(cxb - cxa) > 0.5) {
        var ck = (cyb - cya) / (cxb - cxa);
        var cy1 = cya + (x - cxa) * ck, cy2 = cyc + (x - cxc) * ck;
        if (Math.abs(y - cy1) < 10 || Math.abs(y - cy2) < 10) return it;
        if (x > Math.min(cxa, cxb)) {
          var lo = Math.min(cy1, cy2), hi = Math.max(cy1, cy2);
          if (y > lo && y < hi) return it;
        }
      }
    }
    if (it.type === 'text') {
      ctx.font = (it.fontSize || 12) + 'px -apple-system,Segoe UI,Roboto,sans-serif';
      var tw = ctx.measureText(it.text || '').width;
      var tx = tsX(p0.ts), ty = pY(p0.p);
      if (x >= tx - 6 && x <= tx + tw + 8 && Math.abs(y - ty) < 12) return it;
    }
  }
  return null;
}
function pointAt(x, y){
  var ts = xTs(x), p = yP(y);
  if (D.magnet) {
    var b = cur(), i = clamp(Math.round(iOf(x)), 0, b.length - 1);
    var cands = [b[i][1], b[i][2], b[i][3], b[i][4]], best = null, bd = 1e9;
    for (var k = 0; k < cands.length; k++) {
      var d = Math.abs(pY(cands[k]) - y);
      if (d < bd) { bd = d; best = cands[k]; }
    }
    if (bd < 12) p = best;
  }
  return { ts: ts, p: p };
}

/* ---------- touch ---------- */
function pos(e){
  var r = cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function bindTouch(){
  cv.addEventListener('pointerdown', onPD, { passive: false });
  cv.addEventListener('pointermove', onPM, { passive: false });
  cv.addEventListener('pointerup', onPU, { passive: false });
  cv.addEventListener('pointercancel', onPU, { passive: false });
  cv.addEventListener('contextmenu', function(e){ e.preventDefault(); });
}
var PTR = new Map();
function onPD(e){
  e.preventDefault();
  var q = pos(e);
  var p = { id: e.pointerId, x: q.x, y: q.y, sx: q.x, sy: q.y, t: Date.now(), moved: false };
  PTR.set(e.pointerId, p);
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}

  if (PTR.size === 2) {
    var arr = Array.from(PTR.values());
    V.pinch = {
      d0: Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y),
      dy0: Math.abs(arr[0].y - arr[1].y),
      sp0: V.spacing, rng0: V.priceMax - V.priceMin,
      mid0: yP((arr[0].y + arr[1].y) / 2), auto: V.autoPrice
    };
    D.pending = null; D.drawing = false; D.freehand = false;
    V.cross = null; mark();
    return;
  }
  if (PTR.size !== 1) return;

  if (q.x > LAY.plotW) { V.axis = { kind: 'price', y0: q.y, rng0: V.priceMax - V.priceMin, min0: V.priceMin }; return; }
  if (q.y > H - LAY.timeH) { V.axis = { kind: 'time', x0: q.x, sp0: V.spacing }; return; }

  /* long-press (crosshair + lupa) — 380 ms harakatsiz bosish */
  if (D.tool === 'crosshair' && !hitTest(q.x, q.y)) {
    clearTimeout(V.lpTimer);
    var lpId = e.pointerId;
    V.lpTimer = setTimeout(function(){ startLongPress(lpId); }, 380);
  }

  /* tool active -> draw */
  if (D.tool !== 'crosshair') {
    if (!D.pending) {
      if (D.tool === 'hline') { snapshot(); D.items.push(newItem('hline', [{ ts: null, p: pointAt(q.x, q.y).p }])); saveDrawings(); mark(); return; }
      if (D.tool === 'vline') { snapshot(); D.items.push(newItem('vline', [{ ts: pointAt(q.x, q.y).ts, p: null }])); saveDrawings(); mark(); return; }
      if (D.tool === 'hray') { snapshot(); var hrp = pointAt(q.x, q.y); D.items.push(newItem('hray', [{ ts: hrp.ts, p: hrp.p }])); saveDrawings(); mark(); return; }
      if (D.tool === 'text') { D.pending = { type: 'text', pts: [pointAt(q.x, q.y)], cur: null }; mark(); return; }
      if (D.tool === 'brush' || D.tool === 'highlighter') {
        var fp = pointAt(q.x, q.y);
        D.pending = { type: D.tool, pts: [fp], cur: fp };
        D.drawing = true; D.freehand = true; mark(); return;
      }
      D.pending = { type: D.tool, pts: [pointAt(q.x, q.y)], cur: null };
      D.drawing = true; mark(); return;
    }
    if (!D.drawing) { D.drawing = true; D.pending.cur = pointAt(q.x, q.y); mark(); return; }
  }
  /* select or pan */
  var hit = hitTest(q.x, q.y);
  if (hit && D.tool === 'crosshair') {
    D.sel = hit; V.cross = null;
    if (hit.locked) { mark(); return; }
    D.drag = { item: hit, sx: q.x, sy: q.y, moved: false,
               orig: hit.pts.map(function(pt){ return { ts: pt.ts, p: pt.p, sx: pt.ts != null ? tsX(pt.ts) : null, sy: pt.p != null ? pY(pt.p) : null }; }) };
    mark(); return;
  }
  D.sel = null;
  V.pan = { x0: q.x, y0: q.y, off0: V.rightOffset, min0: V.priceMin, max0: V.priceMax, auto: V.autoPrice };
}
function onPM(e){
  var p = PTR.get(e.pointerId);
  if (!p) return;
  var q = pos(e);
  p.x = q.x; p.y = q.y;
  if (Math.abs(q.x - p.sx) > 4 || Math.abs(q.y - p.sy) > 4) p.moved = true;

  if (V.pinch && PTR.size >= 2) {
    var arr = Array.from(PTR.values());
    var d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    if (V.pinch.d0 > 6 && d > 6) {
      var f = d / V.pinch.d0;
      var idxMid = iOf((arr[0].x + arr[1].x) / 2);
      setSpacing(V.pinch.sp0 * f, idxMid, (arr[0].x + arr[1].x) / 2);
      var dy = Math.abs(arr[0].y - arr[1].y);
      if (V.pinch.dy0 > 6 && dy > 6) {
        var rf = dy / V.pinch.dy0;
        var rng = V.pinch.rng0 / rf;
        var mid = V.pinch.mid0;
        V.autoPrice = false;
        V.priceMin = mid - rng * (mid - V.priceMin) / (V.pinch.rng0 || 1);
        V.priceMax = V.priceMin + rng;
        if (!isFinite(V.priceMin) || !isFinite(V.priceMax)) V.autoPrice = true;
      }
      mark();
    }
    return;
  }
  if (V.lpTimer && p.moved) { clearTimeout(V.lpTimer); V.lpTimer = null; }
  if (V.longPress) {
    if (PTR.size === 1) {
      V.longPress.x = q.x; V.longPress.y = q.y;
      var lbi = clamp(Math.round(iOf(q.x)), 0, nB() - 1);
      V.cross = { x: xOf(lbi), y: q.y };
      updateLegendForBar(lbi);
      mark(); return;
    }
    V.longPress = null;
  }
  if (V.axis) {
    if (V.axis.kind === 'price') {
      var dyA = q.y - V.axis.y0;
      var f2 = Math.max(0.2, 1 + dyA / 120);
      var mid2 = (V.priceMax + V.priceMin) / 2;
      var rng2 = V.axis.rng0 * f2;
      V.autoPrice = false;
      V.priceMin = mid2 - rng2 / 2; V.priceMax = mid2 + rng2 / 2;
    } else {
      setSpacing(V.axis.sp0 * Math.max(0.3, 1 + (q.x - V.axis.x0) / 90), null, null);
    }
    mark(); return;
  }
  if (D.drag) {
    var dx = q.x - D.drag.sx, dy = q.y - D.drag.sy;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) D.drag.moved = true;
    for (var i = 0; i < D.drag.item.pts.length; i++) {
      var o = D.drag.orig[i], pt = D.drag.item.pts[i];
      if (pt.ts != null && o.sx != null) pt.ts = xTs(o.sx + dx);
      if (pt.p != null && o.sy != null) pt.p = yP(o.sy + dy);
    }
    mark(); return;
  }
  if (D.pending && D.drawing) {
    var np = pointAt(q.x, q.y);
    if (D.freehand) {
      var lpt = D.pending.pts[D.pending.pts.length - 1];
      if (Math.abs(tsX(np.ts) - tsX(lpt.ts)) + Math.abs(pY(np.p) - pY(lpt.p)) > 2.2 && D.pending.pts.length < 600) D.pending.pts.push(np);
      D.pending.cur = np;
    } else D.pending.cur = np;
    mark(); return;
  }
  if (V.pan) {
    var ddx = q.x - V.pan.x0, ddy = q.y - V.pan.y0;
    V.rightOffset = V.pan.off0 + ddx / V.spacing;
    clampOffset();
    if (Math.abs(ddy) > 3) {
      var rr2 = (V.pan.max0 - V.pan.min0);
      var shift = -(ddy / LAY.priceH) * rr2;
      V.autoPrice = false;
      V.priceMin = V.pan.min0 + shift;
      V.priceMax = V.pan.max0 + shift;
    }
    mark(); return;
  }
}
function onPU(e){
  var p = PTR.get(e.pointerId);
  PTR.delete(e.pointerId);
  if (V.lpTimer) { clearTimeout(V.lpTimer); V.lpTimer = null; }
  if (PTR.size < 2) V.pinch = null;
  if (V.longPress && PTR.size === 0) {
    V.longPress = null; V.cross = null; hideCrossTip(); V.pan = null;
    mark(); return;
  }
  if (PTR.size === 0) {
    if (V.axis) { V.axis = null; }
    if (D.drag) { D.drag = null; mark(); return; }
    if (D.pending && D.drawing) {
      D.drawing = false;
      var pr = D.pending;
      if (D.freehand) {
        D.freehand = false;
        if (pr.pts.length >= 2) {
          snapshot();
          var fit2 = newItem(pr.type, pr.pts.slice());
          D.items.push(fit2); D.sel = fit2; saveDrawings();
        }
        D.pending = null; setTool('crosshair'); mark(); return;
      }
      if (pr.type === 'channel') {
        var chMoved = pr.cur && (Math.abs(tsX(pr.cur.ts) - tsX(pr.pts[0].ts)) > 6 || Math.abs(pY(pr.cur.p) - pY(pr.pts[0].p)) > 6);
        if (chMoved && pr.pts.length === 1) {
          D.pending = { type: 'channel', pts: [pr.pts[0], pr.cur], cur: null, need: 3 };
          toast('Kanaling 2-nuqtasi: kenglik uchun yana sudra');
          mark(); return;
        }
        if (chMoved && pr.pts.length >= 2) {
          snapshot();
          var chIt = newItem('channel', [pr.pts[0], pr.pts[1], pr.cur]);
          D.items.push(chIt); D.sel = chIt; saveDrawings();
          D.pending = null; setTool('crosshair'); mark(); return;
        }
        mark(); return;
      }
      if (pr.cur && (Math.abs(tsX(pr.cur.ts) - tsX(pr.pts[0].ts)) > 6 || Math.abs(pY(pr.cur.p) - pY(pr.pts[0].p)) > 6)) {
        if (pr.type === 'text') {
          var t = window.prompt('Matn:', '');
          if (t) { snapshot(); D.items.push(newItem('text', [pr.pts[0]], { text: t })); saveDrawings(); }
        } else {
          snapshot();
          var it = newItem(pr.type, [pr.pts[0], pr.cur]);
          D.items.push(it); D.sel = it; saveDrawings();
        }
        D.pending = null; setTool('crosshair');
        mark(); return;
      }
      /* tap-tap rejim: pending qoldiramiz */
      if (pr.type === 'text') {
        var t2 = window.prompt('Matn:', '');
        if (t2) { snapshot(); D.items.push(newItem('text', [pr.pts[0]], { text: t2 })); saveDrawings(); }
        D.pending = null; mark(); return;
      }
      mark(); return;
    }
    if (p && !p.moved && (Date.now() - p.t) < 400) {
      var now = Date.now();
      if (now - V.lastTap < 320 && Math.hypot(p.sx - V.lastTapX, p.sy - V.lastTapY) < 30) {
        V.lastTap = 0; V.cross = null; V.autoPrice = true; fit(); return;
      }
      V.lastTap = now; V.lastTapX = p.sx; V.lastTapY = p.sy;
      if (D.tool !== 'crosshair') { D.pending = { type: D.tool, pts: [pointAt(p.sx, p.sy)], cur: null }; mark(); return; }
      V.cross = { x: p.sx, y: p.sy };
      updateLegendForBar(Math.round(iOf(p.sx)));
      showCrossTip(p.sx, p.sy);
      mark(); return;
    }
    if (p && p.moved) { V.cross = null; hideCrossTip(); }
    V.pan = null;
    mark();
  }
}
function setSpacing(s, idx, mx){
  s = clamp(s, 1.4, 40);
  V.spacing = s;
  if (idx != null && mx != null) {
    var ri = idx + 0.5 - (LAY.plotW - mx) / s;
    V.rightOffset = ri - (nB() - 1);
  }
  clampOffset(); mark();
}
function setTool(t){
  D.tool = t; D.pending = null; D.drawing = false; D.freehand = false;
  document.querySelectorAll('#bottom .tbtn').forEach(function(b){
    b.classList.toggle('on', b.dataset.tool === t);
  });
  mark();
}
function delSel(){
  if (!D.sel) return;
  snapshot();
  var s = D.sel;
  D.items = D.items.filter(function(it){ return it !== s; });
  D.sel = null; saveDrawings(); mark();
}

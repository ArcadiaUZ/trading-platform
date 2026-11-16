/* _m9_style.js - per-drawing style editing (draw-studio)
   - window.openStyleSheet(id): bottom sheet "Chizma sozlamalari" editing ONE drawing
   - floating mini toolbar #drawBar on tap / double-tap of an existing drawing
   Drawing model v2 (rendered by _m3_chart.js, only EDITED here):
     { id, type, pts[], color, width, style:'solid'|'dash'|'dot', opacity 0.15..1,
       fill, fillColor, text, fontSize, locked, hidden }
   Never drops fields: mutations touch only the requested keys on the live object. */
(function(){
'use strict';

var PALETTE = ['#2962FF','#22AB94','#F7525F','#FF9800','#FFEB3B','#9C27B0','#00BCD4','#FFFFFF','#DBDBDB','#8C8C8C','#E91E63','#4CAF50'];
var FILLS   = ['#2962FF','#22AB94','#F7525F','#FF9800','#9C27B0','#FFFFFF'];
var BAR_COLORS = ['#2962FF','#F7525F','#22AB94','#FF9800','#9C27B0','#FFFFFF'];
var WIDTHS = [1,2,3,4];
var STYLE_ORDER = ['solid','dash','dot'];
var STYLE_NAME = { solid: 'Solid', dash: 'Dash', dot: 'Nuqta' };
var FILL_TYPES = { rect: 1, channel: 1, fib: 1 };
var SHEET_TITLE = 'Chizma sozlamalari';
var FONT_SIZES = [11,14,18,24];

var ICON_GEAR = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13a7.9 7.9 0 0 0 0-2l2.05-1.6-2-3.5-2.44 1a7.8 7.8 0 0 0-1.73-1L14.8 3.3H9.2l-.48 2.6c-.63.24-1.21.58-1.73 1l-2.44-1-2 3.5L4.6 11a7.9 7.9 0 0 0 0 2l-2.05 1.6 2 3.5 2.44-1c.52.42 1.1.76 1.73 1l.48 2.6h5.6l.48-2.6c.63-.24 1.21-.58 1.73-1l2.44 1 2-3.5L19.4 13z"/></svg>';
var ICON_TRASH = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9.5 7V4.8h5V7M6.2 7l.9 13.2h9.8L17.8 7M10.2 10.5v6.4M13.8 10.5v6.4"/></svg>';

var STY = { bar: null, barFor: null, barX: 0, barY: 0, sheetId: null,
            snapDone: false, tapT: 0, tapX: 0, tapY: 0, cssDone: false };
var PD = {};

/* ---------- tiny helpers ---------- */
function el(id){ return document.getElementById(id); }
function escH(s){
  return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}
function sameCol(a, b){ return String(a == null ? '' : a).toLowerCase() === String(b == null ? '' : b).toLowerCase(); }
function itColor(it){
  if (it && it.color) return it.color;
  try { if (typeof col === 'function') return col('--accent'); } catch (e) {}
  return '#2962FF';
}
function itOpacity(it){ var o = it && it.opacity; return (o == null || !isFinite(o)) ? 1 : Math.max(.15, Math.min(1, o)); }
function byId(id){
  try {
    var a = (typeof D !== 'undefined' && D && D.items) ? D.items : [];
    for (var i = 0; i < a.length; i++) if (a[i] && a[i].id === id) return a[i];
  } catch (e) {}
  return null;
}
function typeName(it){
  try {
    if (typeof TYPE_NAME !== 'undefined' && TYPE_NAME && TYPE_NAME[it.type]) return TYPE_NAME[it.type];
  } catch (e) {}
  return it.type || 'Chizma';
}
function rrect(g, x, y, w, h, r){
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
function dashBg(c, kind){
  if (kind === 'dash') return 'repeating-linear-gradient(90deg,' + c + ' 0 7px,transparent 7px 12px)';
  if (kind === 'dot') return 'repeating-linear-gradient(90deg,' + c + ' 0 2px,transparent 2px 6px)';
  return c;
}
function lineSample(kind, c, w, h){
  return '<i class="ds-line" style="width:' + w + 'px;height:' + h + 'px;background:' + dashBg(c, kind) + '"></i>';
}
function ringStyle(on){
  return on ? 'box-shadow:0 0 0 2px var(--text),inset 0 0 0 1px rgba(0,0,0,.35)'
            : 'box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)';
}
function sect(t){ return '<div class="ds-sec">' + escH(t) + '</div>'; }
function newId(){
  var guard = 0, z;
  do { z = 'm' + Math.random().toString(36).slice(2, 8); } while (byId(z) && guard++ < 80);
  return z;
}

/* ---------- injected CSS (head file is off-limits) ---------- */
function injectCss(){
  if (STY.cssDone || el('dsCss')) { STY.cssDone = true; return; }
  var css = ''
  + '#drawBar{position:absolute;z-index:20;display:none;align-items:center;gap:5px;padding:5px 7px;'
  +   'border-radius:10px;background:rgba(31,31,31,.98);border:1px solid var(--border2);'
  +   'box-shadow:0 8px 22px rgba(0,0,0,.55);touch-action:manipulation;max-width:calc(100% - 8px)}'
  + '#drawBar.on{display:flex}'
  + '#drawBar .ds-bsw{width:20px;height:20px;border-radius:50%;flex:none;padding:0}'
  + '#drawBar .ds-bsw.on{box-shadow:0 0 0 2px var(--text)}'
  + '#drawBar .ds-bb{height:26px;min-width:26px;border-radius:6px;display:grid;place-items:center;'
  +   'color:var(--text2);padding:0 4px}'
  + '#drawBar .ds-bb:active{background:var(--border)}'
  + '#drawBar .ds-sep{width:1px;height:18px;background:var(--border);margin:0 1px}'
  + '#drawBar svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;'
  +   'stroke-linecap:round;stroke-linejoin:round}'
  + '.ds-hd{display:flex;align-items:center;gap:9px;padding:10px 4px 2px}'
  + '.ds-hd .ds-dot{width:15px;height:15px;border-radius:50%;flex:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)}'
  + '.ds-hd .ds-hd-t{flex:1;min-width:0}'
  + '.ds-hd b{font-size:13px;display:block}'
  + '.ds-hd small{display:block;color:var(--text3);font-size:10.5px;margin-top:1px}'
  + '.ds-badge{font-size:10px;font-weight:700;letter-spacing:.3px;color:var(--text3);'
  +   'border:1px solid var(--border2);border-radius:5px;padding:2px 6px;flex:none}'
  + '.ds-prev{display:block;width:100%;height:44px;border-radius:9px;margin:8px 0 2px}'
  + '.ds-sec{font-size:10.5px;letter-spacing:.7px;text-transform:uppercase;color:var(--text3);'
  +   'padding:14px 4px 7px;font-weight:700}'
  + '.ds-swgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;padding:0 2px}'
  + '.ds-sw{height:34px;border-radius:8px;padding:0;position:relative}'
  + '.ds-sw:active{opacity:.75}'
  + '.ds-row{display:flex;gap:8px;padding:0 2px}'
  + '.ds-row button{flex:1;height:40px;border-radius:8px;background:var(--panel2);display:flex;'
  +   'align-items:center;justify-content:center;gap:7px;font-size:12px;color:var(--text);padding:0 4px}'
  + '.ds-row button.on{background:var(--accent);color:#fff;font-weight:600}'
  + '.ds-row button:active{opacity:.8}'
  + '.ds-line{display:inline-block;vertical-align:middle;border-radius:1px;flex:none}'
  + '.ds-op{display:flex;align-items:center;gap:10px;padding:2px 4px 6px;font-size:12px;color:var(--text2)}'
  + '.ds-op input{flex:1;min-width:0;accent-color:var(--accent)}'
  + '.ds-op b{width:46px;text-align:right;font-variant-numeric:tabular-nums;color:var(--text)}'
  + '.ds-fillrow{display:flex;align-items:center;justify-content:space-between;padding:2px 4px 9px;font-size:13px}'
  + '#shBody .gear{color:var(--text2);padding:4px 8px;font-size:16px;line-height:1}'
  + '#shBody .gear:active{color:var(--text)}';
  var st = document.createElement('style');
  st.id = 'dsCss';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
  STY.cssDone = true;
}

/* ---------- sheet markup ---------- */
function sheetHtml(it){
  var c = itColor(it), op = itOpacity(it), kind = it.type;
  var h = '';
  h += '<div class="ds-hd"><span class="ds-dot" style="background:' + c + '"></span>' +
       '<div class="ds-hd-t"><b>' + escH(typeName(it)) + '</b><small>' + escH(it.type) + ' &middot; ' + escH(it.id) + '</small></div>' +
       (it.locked ? '<span class="ds-badge">QULF</span>' : '') +
       (it.hidden ? '<span class="ds-badge">YASHIRIN</span>' : '') + '</div>';
  h += '<canvas class="ds-prev" id="dsPrev"></canvas>';

  h += sect('Rang');
  h += '<div class="ds-swgrid">';
  for (var i = 0; i < PALETTE.length; i++) {
    var cc = PALETTE[i], on = sameCol(c, cc);
    h += '<button class="ds-sw' + (on ? ' on' : '') + '" data-color="' + cc + '" ' +
         'style="background:' + cc + ';' + ringStyle(on) + '"></button>';
  }
  h += '</div>';

  h += sect('Qalinlik');
  h += '<div class="ds-row">';
  for (var w = 0; w < WIDTHS.length; w++) {
    var ww = WIDTHS[w], won = Math.abs((Number(it.width) || 1.6) - ww) < 0.01;
    h += '<button class="' + (won ? 'on' : '') + '" data-width="' + ww + '">' +
         '<i class="ds-line" style="width:28px;height:' + ww + 'px;background:' + c + '"></i>' +
         '<span>' + ww + '</span></button>';
  }
  h += '</div>';

  h += sect('Uslub');
  h += '<div class="ds-row">';
  var curStyle = it.style || 'solid';
  for (var s = 0; s < STYLE_ORDER.length; s++) {
    var sk = STYLE_ORDER[s];
    h += '<button class="' + (curStyle === sk ? 'on' : '') + '" data-style="' + sk + '">' +
         lineSample(sk, c, 28, 2) + '<span>' + STYLE_NAME[sk] + '</span></button>';
  }
  h += '</div>';

  h += sect('Shaffoflik');
  var pct = Math.round(op * 100);
  h += '<div class="ds-op"><input type="range" id="dsOp" min="15" max="100" step="5" value="' + pct + '">' +
       '<b id="dsOpv">' + pct + '%</b></div>';

  if (FILL_TYPES[kind]) {
    var fOn = !!it.fill, fc = it.fillColor || c;
    h += sect("To'ldirish");
    h += '<div class="ds-fillrow"><span>Fill</span><div class="sw' + (fOn ? ' on' : '') + '" data-filltoggle></div></div>';
    h += '<div class="ds-swgrid">';
    for (var f = 0; f < FILLS.length; f++) {
      var ff = FILLS[f], fon = fOn && sameCol(fc, ff);
      h += '<button class="ds-sw' + (fon ? ' on' : '') + '" data-fillcolor="' + ff + '" ' +
           'style="background:' + ff + ';' + ringStyle(fon) + '"></button>';
    }
    h += '</div>';
  }

  if (kind === 'text') {
    h += sect("Matn o'lchami");
    h += '<div class="ds-row">';
    for (var t = 0; t < FONT_SIZES.length; t++) {
      var fs = FONT_SIZES[t], fson = (Number(it.fontSize) || 11) === fs;
      h += '<button class="' + (fson ? 'on' : '') + '" data-fs="' + fs + '">' +
           '<span style="font-size:' + Math.min(fs, 19) + 'px;line-height:1">Aa</span><span>' + fs + '</span></button>';
    }
    h += '</div>';
  }

  h += '<div class="btnrow" style="padding-top:16px">' +
       '<button class="btn" id="dsDup">Nusxa</button>' +
       '<button class="btn" id="dsLock">' + (it.locked ? 'Qulfdan chiqarish' : 'Qulflash') + '</button>' +
       '</div>';
  h += '<div class="btnrow">' +
       '<button class="btn danger" id="dsDel">O&#39;chirish</button>' +
       '<button class="btn" id="dsClose">Yopish</button>' +
       '</div>';
  h += '<div class="hint">O&#39;zgarish darhol saqlanadi. Butun shu sessiya bitta Undo qadam bo&#39;ladi.</div>';
  return h;
}

/* ---------- live preview swatch (canvas) ---------- */
function paintPreview(it){
  var c = el('dsPrev');
  if (!c || !it) return;
  var w = Math.max(120, Math.floor(c.clientWidth || (c.parentNode && c.parentNode.clientWidth) || 300));
  var h = 44, dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  var g = c.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  var cs = {};
  try { cs = getComputedStyle(document.body); } catch (e) {}
  var bg = (cs.getPropertyValue ? cs.getPropertyValue('--panel2') : '').trim() || '#1F1F1F';
  g.clearRect(0, 0, w, h);
  g.fillStyle = bg; rrect(g, .5, .5, w - 1, h - 1, 9); g.fill();
  var color = itColor(it) || (typeof col === 'function' ? col('--accent') : '#2962FF');
  var lw = Math.max(1, Number(it.width) || 1.6);
  var op = itOpacity(it);
  var dash = it.style === 'dash' ? [7, 5] : (it.style === 'dot' ? [1.5, 4] : []);
  var kind = it.type;
  g.save();
  g.globalAlpha = op; g.strokeStyle = color; g.fillStyle = color;
  g.lineWidth = lw; g.setLineDash(dash);
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'text') {
    g.font = '600 ' + (Number(it.fontSize) || 11) + 'px -apple-system,Segoe UI,Roboto,sans-serif';
    g.textBaseline = 'middle';
    g.fillText(it.text || 'Aa', 14, h / 2);
  } else if (kind === 'hline') {
    g.beginPath(); g.moveTo(12, h / 2); g.lineTo(w - 12, h / 2); g.stroke();
  } else if (kind === 'vline') {
    g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(w / 2, h - 8); g.stroke();
  } else if (FILL_TYPES[kind]) {
    if (it.fill) {
      g.save();
      g.globalAlpha = Math.min(.34, .16 + op * .2);
      g.fillStyle = it.fillColor || color;
      g.fillRect(12, 10, w - 24, h - 20);
      g.restore();
    }
    g.globalAlpha = op;
    g.strokeRect(12.5, 10.5, w - 25, h - 21);
  } else if (kind === 'measure') {
    g.setLineDash([3, 3]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(14, 14); g.lineTo(w - 14, 14); g.lineTo(w - 14, h - 12); g.stroke();
    g.setLineDash([]); g.lineWidth = lw;
    g.beginPath(); g.moveTo(14, 14); g.lineTo(w - 14, h - 12); g.stroke();
  } else if (kind === 'brush' || kind === 'highlighter') {
    g.beginPath(); g.moveTo(14, h - 14);
    g.quadraticCurveTo(w * .35, 6, w * .55, h / 2);
    g.quadraticCurveTo(w * .75, h - 12, w - 14, 14);
    g.stroke();
  } else {
    g.beginPath(); g.moveTo(14, h - 14); g.lineTo(w - 14, 14); g.stroke();
  }
  g.restore();
}

/* ---------- mutation helpers ---------- */
function ensureSnap(){
  if (STY.snapDone) return;
  try { if (typeof snapshot === 'function') snapshot(); } catch (e) {}
  STY.snapDone = true;
}
function patch(id, p){
  var it = byId(id);
  if (!it) return null;
  ensureSnap();
  for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) it[k] = p[k];
  try { if (typeof saveDrawings === 'function') saveDrawings(); } catch (e) {}
  try { if (typeof mark === 'function') mark(); } catch (e) {}
  return it;
}
function renderSheet(id){
  var it = byId(id);
  if (!it) { STY.sheetId = null; try { closeSheet(); } catch (e) {} hideBar(); return; }
  var body = el('shBody');
  var sc = body ? body.scrollTop : 0;
  try {
    openSheet(SHEET_TITLE, sheetHtml(it), function(b){ bindSheet(id, b); });
  } catch (e) { return; }
  STY.sheetId = id;
  if (body) body.scrollTop = sc;
  paintPreview(it);
}
function openStyleSheet(id){
  injectCss();
  var it = byId(id);
  if (!it) { try { toast('Chizma topilmadi'); } catch (e) {} return; }
  STY.sheetId = id;
  STY.snapDone = false;
  hideBar();
  try {
    if (typeof D !== 'undefined' && D) D.sel = it;
    if (typeof mark === 'function') mark();
  } catch (e) {}
  renderSheet(id);
}
function dupItem(id){
  var it = byId(id);
  if (!it) return;
  ensureSnap();
  var cp;
  try { cp = JSON.parse(JSON.stringify(it)); } catch (e) { return; }
  cp.id = newId();
  try { D.items.push(cp); } catch (e) { return; }
  try { if (typeof saveDrawings === 'function') saveDrawings(); } catch (e) {}
  try { if (typeof mark === 'function') mark(); } catch (e) {}
  try { toast('Nusxa yaratildi', typeName(cp)); } catch (e) {}
}
function lockItem(id){
  var it = byId(id);
  if (!it) return;
  patch(id, { locked: !it.locked });
  renderSheet(id);
}
function delItem(id){
  var it = byId(id);
  if (!it) return;
  ensureSnap();
  try {
    D.items = D.items.filter(function(x){ return x !== it; });
    if (D.sel === it) D.sel = null;
  } catch (e) { return; }
  try { if (typeof saveDrawings === 'function') saveDrawings(); } catch (e) {}
  try { if (typeof mark === 'function') mark(); } catch (e) {}
  STY.sheetId = null;
  try { closeSheet(); } catch (e) {}
  hideBar();
  try { toast("O'chirildi", typeName(it)); } catch (e) {}
}

/* ---------- sheet binders ---------- */
function bindSheet(id, body){
  if (!body) return;
  var it = byId(id);
  if (!it) return;

  body.querySelectorAll('[data-color]').forEach(function(b){
    b.addEventListener('click', function(){ if (patch(id, { color: b.getAttribute('data-color') })) renderSheet(id); });
  });
  body.querySelectorAll('[data-width]').forEach(function(b){
    b.addEventListener('click', function(){ if (patch(id, { width: Number(b.getAttribute('data-width')) })) renderSheet(id); });
  });
  body.querySelectorAll('[data-style]').forEach(function(b){
    b.addEventListener('click', function(){ if (patch(id, { style: b.getAttribute('data-style') })) renderSheet(id); });
  });
  body.querySelectorAll('[data-fillcolor]').forEach(function(b){
    b.addEventListener('click', function(){
      if (patch(id, { fillColor: b.getAttribute('data-fillcolor'), fill: true })) renderSheet(id);
    });
  });
  body.querySelectorAll('[data-fs]').forEach(function(b){
    b.addEventListener('click', function(){ if (patch(id, { fontSize: Number(b.getAttribute('data-fs')) })) renderSheet(id); });
  });
  var ft = body.querySelector('[data-filltoggle]');
  if (ft) ft.addEventListener('click', function(){
    var cur = byId(id); if (!cur) return;
    var nx = !cur.fill;
    var p = { fill: nx };
    if (nx && !cur.fillColor) p.fillColor = itColor(cur);
    if (patch(id, p)) renderSheet(id);
  });

  var rng = body.querySelector('#dsOp');
  if (rng) {
    rng.addEventListener('input', function(){
      var cur = byId(id); if (!cur) return;
      ensureSnap();
      cur.opacity = Math.max(.15, Math.min(1, Number(rng.value) / 100));
      try { if (typeof saveDrawings === 'function') saveDrawings(); } catch (e) {}
      try { if (typeof mark === 'function') mark(); } catch (e) {}
      var lb = el('dsOpv'); if (lb) lb.textContent = rng.value + '%';
      paintPreview(cur);
    });
    rng.addEventListener('change', function(){ paintPreview(byId(id)); });
  }

  var dup = body.querySelector('#dsDup');
  if (dup) dup.addEventListener('click', function(){ dupItem(id); });
  var lk = body.querySelector('#dsLock');
  if (lk) lk.addEventListener('click', function(){ lockItem(id); });
  var dl = body.querySelector('#dsDel');
  if (dl) dl.addEventListener('click', function(){ delItem(id); });
  var cl = body.querySelector('#dsClose');
  if (cl) cl.addEventListener('click', function(){ STY.sheetId = null; try { closeSheet(); } catch (e) {} });

  var op = body.querySelector('#dsOp');
  if (op) paintPreview(it);
}

/* ---------- floating mini toolbar ---------- */
function makeBar(){
  if (STY.bar) return STY.bar;
  var host = el('chartwrap');
  if (!host) return null;
  var d = document.createElement('div');
  d.id = 'drawBar';
  var h = '';
  for (var i = 0; i < BAR_COLORS.length; i++) {
    h += '<button class="ds-bsw" data-act="color" data-c="' + BAR_COLORS[i] +
         '" style="background:' + BAR_COLORS[i] + ';box-shadow:inset 0 0 0 1px rgba(0,0,0,.35)"></button>';
  }
  h += '<span class="ds-sep"></span>';
  h += '<button class="ds-bb" data-act="style" title="Uslub"></button>';
  h += '<button class="ds-bb" data-act="gear" title="Sozlamalar">' + ICON_GEAR + '</button>';
  h += '<button class="ds-bb" data-act="del" title="O&#39;chirish">' + ICON_TRASH + '</button>';
  d.innerHTML = h;
  d.addEventListener('pointerdown', function(e){ e.stopPropagation(); }, true);
  d.addEventListener('click', onBarClick);
  host.appendChild(d);
  STY.bar = d;
  return d;
}
function barApply(it, p){
  try { if (typeof snapshot === 'function') snapshot(); } catch (e) {}
  for (var k in p) if (Object.prototype.hasOwnProperty.call(p, k)) it[k] = p[k];
  try { if (typeof saveDrawings === 'function') saveDrawings(); } catch (e) {}
  try { if (typeof mark === 'function') mark(); } catch (e) {}
}
function onBarClick(e){
  var b = e.target;
  while (b && b !== STY.bar && !(b.getAttribute && b.getAttribute('data-act'))) b = b.parentNode;
  if (!b || b === STY.bar || !b.getAttribute) return;
  var act = b.getAttribute('data-act');
  var it = byId(STY.barFor);
  if (!it) { hideBar(); return; }
  if (act === 'color') {
    barApply(it, { color: b.getAttribute('data-c') });
    barPaint(it);
  } else if (act === 'style') {
    var nx = STYLE_ORDER[(STYLE_ORDER.indexOf(it.style || 'solid') + 1) % STYLE_ORDER.length];
    barApply(it, { style: nx });
    barPaint(it);
  } else if (act === 'gear') {
    openStyleSheet(it.id);
  } else if (act === 'del') {
    try { if (typeof snapshot === 'function') snapshot(); } catch (e2) {}
    try {
      D.items = D.items.filter(function(x){ return x !== it; });
      if (D.sel === it) D.sel = null;
    } catch (e3) {}
    try { if (typeof saveDrawings === 'function') saveDrawings(); } catch (e4) {}
    try { if (typeof mark === 'function') mark(); } catch (e5) {}
    hideBar();
    try { toast("O'chirildi", typeName(it)); } catch (e6) {}
  }
}
function barPaint(it){
  var d = STY.bar;
  if (!d || !it) return;
  var c = itColor(it), sw = d.querySelectorAll('[data-act="color"]');
  for (var i = 0; i < sw.length; i++) {
    var on = sameCol(c, sw[i].getAttribute('data-c'));
    sw[i].className = 'ds-bsw' + (on ? ' on' : '');
  }
  var sb = d.querySelector('[data-act="style"]');
  if (sb) sb.innerHTML = lineSample(it.style || 'solid', c, 20, 2);
}
function showBar(it, x, y){
  if (!it) { hideBar(); return; }
  var d = makeBar();
  if (!d) return;
  STY.barFor = it.id; STY.barX = x; STY.barY = y;
  barPaint(it);
  d.classList.add('on');
  d.style.display = 'flex';
  var cvEl = el('chart');
  var cw = cvEl ? cvEl.getBoundingClientRect().width : 320;
  var ch = cvEl ? cvEl.getBoundingClientRect().height : 400;
  var bw = d.offsetWidth || 240, bh = d.offsetHeight || 38;
  var bx = Math.round(x - bw / 2);
  bx = Math.max(6, Math.min(bx, cw - bw - 6));
  var by = Math.round(y - bh - 14);
  if (by < 6) by = Math.round(y + 18);
  by = Math.max(6, Math.min(by, ch - bh - 6));
  d.style.left = bx + 'px';
  d.style.top = by + 'px';
}
function hideBar(){
  var d = STY.bar;
  if (d) { d.classList.remove('on'); d.style.display = 'none'; }
  STY.barFor = null;
}
function pickAt(x, y){
  try {
    if (typeof hitTest === 'function') {
      var hit = hitTest(x, y);
      if (hit) return hit;
    }
  } catch (e) {}
  try {
    if (typeof D !== 'undefined' && D && D.sel && D.items && D.items.indexOf(D.sel) >= 0) return D.sel;
  } catch (e2) {}
  return null;
}
function insideChart(t){
  var cvEl = el('chart');
  return !!(cvEl && (t === cvEl || cvEl.contains(t) || t === el('chartwrap')));
}
function onDown(e){
  var d = STY.bar;
  if (d && d.style.display !== 'none' && !d.contains(e.target)) hideBar();
  if (!insideChart(e.target)) return;
  PD[e.pointerId] = { x: e.clientX, y: e.clientY, t: Date.now() };
}
function onUp(e){
  var pd = PD[e.pointerId];
  if (pd) delete PD[e.pointerId];
  if (!pd) return;
  if (e.pointerType === 'mouse' && e.button > 0) return;
  if (Date.now() - pd.t > 700) return;
  if (Math.hypot(e.clientX - pd.x, e.clientY - pd.y) > 7) return;
  var sheet = el('sheet');
  if (sheet && sheet.classList.contains('on')) return;
  var tool = 'crosshair';
  try { if (typeof D !== 'undefined' && D && D.tool) tool = D.tool; } catch (e2) {}
  if (tool !== 'crosshair') { hideBar(); return; }
  var cvEl = el('chart');
  if (!cvEl) return;
  var r = cvEl.getBoundingClientRect();
  var x = e.clientX - r.left, y = e.clientY - r.top;
  if (x < 0 || y < 0 || x > r.width || y > r.height) { hideBar(); return; }
  var hit = pickAt(x, y);
  if (!hit) { hideBar(); return; }
  var now = Date.now();
  if (STY.tapT && now - STY.tapT < 340 && Math.hypot(x - STY.tapX, y - STY.tapY) < 30) {
    STY.tapT = 0;
    hideBar();
    openStyleSheet(hit.id);
    return;
  }
  STY.tapT = now; STY.tapX = x; STY.tapY = y;
  showBar(hit, x, y);
}
function onCancel(e){ if (PD[e.pointerId]) delete PD[e.pointerId]; }

/* ---------- init ---------- */
injectCss();
try {
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('pointerup', onUp, false);
  document.addEventListener('pointercancel', onCancel, false);
  window.addEventListener('resize', function(){
    hideBar();
    if (STY.sheetId && el('dsPrev')) paintPreview(byId(STY.sheetId));
  });
} catch (e) {}

window.openStyleSheet = openStyleSheet;
window.__drawStyle = {
  open: openStyleSheet,
  hideBar: hideBar,
  bar: function(){ return STY.bar; },
  sheetId: function(){ return STY.sheetId; }
};
})();

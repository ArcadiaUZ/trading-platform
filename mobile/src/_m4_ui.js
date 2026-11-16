/* ==========================================================================
   MOBILE UI — top bar, bottom toolbar, sheets, live feed, alerts, init
   ========================================================================== */
'use strict';

var FEED = { ws: null, ok: false, retry: 0, closed: false, fallbackTimer: null };
var ALERTS = [];
var LAST = { bid: null, ask: null, t: 0 };

/* ---------- legend / crosshair tip ---------- */
function renderLegend(r){
  var a = ASSETS[S.sym];
  var prev = r[1], diff = r[4] - prev, pct = prev ? diff / prev * 100 : 0;
  var cls = diff >= 0 ? 'u' : 'd', sign = diff >= 0 ? '+' : '';
  var el = document.getElementById('legend');
  el.innerHTML =
    '<div class="l1"><span class="feed">' + a.provider + ':</span>' + S.sym +
      '<span class="tf">' + S.tf + '</span></div>' +
    '<div class="l2">O <b>' + fpx(r[1]) + '</b> H <b>' + fpx(r[2]) + '</b> L <b>' + fpx(r[3]) + '</b> C <b>' + fpx(r[4]) + '</b> ' +
      '<span class="' + cls + '">' + sign + pct.toFixed(2) + '%</span></div>';
}
function updateLegend(){
  var b = cur();
  if (!b || !b.length) return;
  renderLegend(b[b.length - 1]);
}
function updateLegendForBar(i){
  var b = cur();
  if (!b || !b.length) return;
  renderLegend(b[clamp(i, 0, b.length - 1)]);
}
function showCrossTip(x, y){
  var b = cur(), i = clamp(Math.round(iOf(x)), 0, b.length - 1), r = b[i];
  var el = document.getElementById('crossTip');
  var d = dts(r[0]);
  el.innerHTML = '<div style="color:var(--text3);font-size:10px">' + pad2(d.getUTCDate()) + ' ' + MON[d.getUTCMonth()] + ' ' + hhmm(r[0]) + '</div>' +
    'O ' + fpx(r[1]) + '  H ' + fpx(r[2]) + '<br>L ' + fpx(r[3]) + '  C ' + fpx(r[4]);
  el.style.display = 'block';
  var tw = 118;
  el.style.left = Math.min(Math.max(6, x + 12), W - tw - 6) + 'px';
  el.style.top = Math.max(6, y - 54) + 'px';
}
function hideCrossTip(){ document.getElementById('crossTip').style.display = 'none'; }

/* ---------- toast ---------- */
var toastTimer = null;
function toast(msg, sub){
  var el = document.getElementById('toast');
  el.querySelector('.t').innerHTML = '<b>' + msg + '</b>' + (sub ? '<br><span>' + sub + '</span>' : '');
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ el.classList.remove('on'); }, 4200);
}

/* ---------- notifications ---------- */
function askNotify(){
  if (window.__PWA && window.__PWA.request) {
    window.__PWA.request().then(function(p){
      toast('Bildirishnoma: ' + p, p === 'granted' ? 'Alert ishga tushganda system notification keladi' : (p === 'unavailable' ? 'Brauzer Notification bermaydi' : 'Ruxsat berilmadi - Chrome sozlamalaridan yoqing'));
    });
    return;
  }
  if (!('Notification' in window)) { toast('Bildirishnoma qollanmaydi', 'Brauzer Notification API bermaydi'); return; }
  if (!window.isSecureContext) {
    toast('HTTPS kerak', 'Telefonda bildirishnoma uchun sahifa https:// bolishi shart (yoki localhost)');
    return;
  }
  Notification.requestPermission().then(function(p){
    toast('Bildirishnoma: ' + p, p === 'granted' ? 'Alert ishga tushganda keladi' : 'Ruxsat berilmadi');
  });
}
function notify(title, body){
  /* v7: Android Chrome'da 'new Notification' ishlamaydi -> PWA service worker orqali */
  try {
    if (window.__PWA && window.__PWA.notify) { window.__PWA.notify(title, body); return; }
  } catch (e) {}
  try {
    if (window.isSecureContext && ('Notification' in window) && Notification.permission === 'granted') {
      new Notification(title, { body: body, silent: false });
    }
  } catch (e2) {}
}
function beep(){
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ac = new AC(), o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    o.connect(g); g.connect(ac.destination);
    g.gain.value = 0.07; o.start();
    setTimeout(function(){ try { o.stop(); ac.close(); } catch (e) {} }, 200);
  } catch (e) {}
}
function vibrate(){ if (navigator.vibrate) { try { navigator.vibrate([40, 60, 40]); } catch (e) {} } }

/* ---------- live feed ---------- */
function feedBase(){
  var ls = null;
  try { ls = localStorage.getItem('xauview.feed'); } catch (e) {}
  if (ls) return ls.replace(/\/+$/, '');
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  }
  return null;
}
function httpBase(){
  var b = feedBase();
  if (!b) return null;
  return b.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
}
function setLive(on){
  FEED.ok = on;
  var el = document.getElementById('live');
  el.textContent = on ? 'LIVE' : 'OFFLINE';
  el.classList.toggle('off', !on);
}
function connect(){
  var base = feedBase();
  if (!base) { setLive(false); return; }
  FEED.closed = false;
  var url = base + '/ws?symbol=' + S.sym + '&tf=' + S.tf;
  try { FEED.ws = new WebSocket(url); } catch (e) { setLive(false); return; }
  FEED.ws.onopen = function(){
    FEED.retry = 0; setLive(true);
    clearTimeout(FEED.fallbackTimer);
  };
  FEED.ws.onmessage = function(ev){
    var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    handleMsg(m);
  };
  FEED.ws.onclose = function(){
    setLive(false);
    if (!FEED.closed) scheduleReconnect();
  };
  FEED.ws.onerror = function(){ try { FEED.ws.close(); } catch (e) {} };
}
function scheduleReconnect(){
  FEED.retry = Math.min(FEED.retry + 1, 6);
  var wait = Math.min(1000 * Math.pow(1.6, FEED.retry), 12000);
  clearTimeout(FEED.timer);
  FEED.timer = setTimeout(function(){ if (!FEED.closed) connect(); }, wait);
}
function reconnectNow(){
  FEED.closed = true;
  try { if (FEED.ws) FEED.ws.close(); } catch (e) {}
  FEED.closed = false;
  clearTimeout(FEED.timer);
  connect();
}
function handleMsg(m){
  if (m.type === 'snapshot') {
    if (!ASSETS[S.sym]) return;
    if (m.digits != null) ASSETS[S.sym].digits = m.digits;
    ASSETS[S.sym].tfs[S.tf] = m.bars;
    invalidate();
    fit(); updateLegend(); mark();
  } else if (m.type === 'tick') {
    applyTick(m);
  } else if (m.type === 'alert') {
    onAlert(m.alert);
  }
}
function applyTick(m){
  if (!m || !m.bar) return;
  var b = m.bar;
  var bars = ASSETS[S.sym] && ASSETS[S.sym].tfs[S.tf];
  LAST.bid = m.bid; LAST.ask = m.ask; LAST.t = m.time;
  if (!bars || !bars.length) { if (ASSETS[S.sym]) ASSETS[S.sym].tfs[S.tf] = [b]; mark(); return; }
  var last = bars[bars.length - 1];
  if (b[0] > last[0]) {
    bars.push(b);
    if (bars.length > 4000) bars.shift();
  } else if (b[0] === last[0]) {
    last[1] = b[1];
    last[2] = Math.max(last[2], b[2]);
    last[3] = Math.min(last[3], b[3]);
    last[4] = b[4];
    last[5] = b[5];
  }
  if (!V.cross) updateLegend();
  mark();
}

/* ---------- alerts ---------- */
function renderAlerts(){
  var body = document.getElementById('shBody');
  var h = '';
  if (!ALERTS.length) {
    h += '<div class="empty">Hali alert yoq.<br>Quyida narx kiritib qoshasan — narx yetganda telefon bildirishnomasi keladi.</div>';
  } else {
    ALERTS.forEach(function(a){
      var st = a.triggered ? 'ishlagan' : (a.active === false ? 'ochirilgan' : 'kutmoqda');
      h += '<div class="alertrow' + (a.triggered ? ' trig' : '') + '">' +
        '<span class="dott" style="background:' + (a.dir === 'above' ? 'var(--up)' : 'var(--down)') + '"></span>' +
        '<div class="info"><b>' + a.symbol + ' ' + (a.dir === 'above' ? '&ge;' : '&le;') + '</b>' +
          '<small>' + st + (a.note ? ' - ' + a.note : '') + '</small></div>' +
        '<div class="p">' + Number(a.price).toFixed(ASSETS[a.symbol] ? ASSETS[a.symbol].digits : 3) + '</div>' +
        '<button class="del" data-del="' + a.id + '">&#10005;</button></div>';
    });
  }
  var curPrice = cur().length ? cur()[cur().length - 1][4] : 0;
  h += '<div class="btnrow" style="padding-top:16px"><button class="btn" id="alNotify">Bildirishnomani yoqish</button></div>';
  h += '<div class="hint">Alert narxni serverda kuzatadi; trigger bolganda shu sahifa va telefon bildirishnomasi orqali xabar keladi. HTTPS bolsa notification kafolatlangan (http LAN bolsa faqat sahifa ichida).</div>';
  h += '<div class="ctl" style="margin-top:10px"><div class="seg" id="alDir" style="flex:1">' +
       '<button data-dir="above" class="on">&ge; yuqoridan</button><button data-dir="below">&le; pastdan</button></div></div>' +
       '<div class="ctl"><input type="number" step="any" id="alPrice" value="' + Number(curPrice).toFixed(ASSETS[S.sym].digits) + '"></div>' +
       '<div class="ctl"><input type="text" id="alNote" placeholder="izoh (ixtiyoriy)"></div>' +
       '<div class="btnrow"><button class="btn primary" id="alAdd">Alert qoshish (' + S.sym + ')</button></div>';
  body.innerHTML = h;

  body.querySelectorAll('[data-del]').forEach(function(btn){
    btn.addEventListener('click', function(){ delAlert(btn.dataset.del); });
  });
  var dir = 'above';
  body.querySelectorAll('#alDir button').forEach(function(b){
    b.addEventListener('click', function(){
      dir = b.dataset.dir;
      body.querySelectorAll('#alDir button').forEach(function(x){ x.classList.toggle('on', x === b); });
    });
  });
  body.querySelector('#alAdd').addEventListener('click', function(){
    var p = parseFloat(body.querySelector('#alPrice').value);
    var note = body.querySelector('#alNote').value || '';
    if (!isFinite(p) || p <= 0) { toast('Narx notogri'); return; }
    addAlert(dir, p, note);
  });
  body.querySelector('#alNotify').addEventListener('click', askNotify);
}
async function loadAlerts(){
  var base = httpBase();
  if (!base) { ALERTS = []; return; }
  try {
    var r = await fetch(base + '/api/alerts');
    if (!r.ok) throw 0;
    var j = await r.json();
    ALERTS = j.alerts || [];
  } catch (e) { ALERTS = []; }
}
/* v8: barcha alert turlari uchun umumiy POST */
async function postAlert(payload){
  var base = httpBase();
  if (!base) { toast('Server yoq', 'Oflayn rejimda alert qoshilmaydi'); return false; }
  try {
    var r = await fetch(base + '/api/alerts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var j = await r.json();
    if (j.alert) ALERTS.push(j.alert);
    toast('Alert qoshildi', alertTitle(j.alert || payload));
    renderAlerts();
    return true;
  } catch (e) {
    toast('Server javob bermadi', 'Alert saqlanmadi: ' + String(e.message || e).slice(0, 40));
    return false;
  }
}
function addAlert(dir, price, note){
  return postAlert({ symbol: S.sym, type: 'price', dir: dir, price: price, note: note });
}
async function delAlert(id){
  var base = httpBase();
  try {
    if (base) await fetch(base + '/api/alerts/' + id, { method: 'DELETE' });
  } catch (e) {}
  ALERTS = ALERTS.filter(function(a){ return a.id !== id; });
  renderAlerts();
}
function onAlert(a){
  var row = ALERTS.filter(function(x){ return x.id === a.id; })[0];
  if (row) { row.triggered = a.triggered; row.price_at = a.price_at; }
  else { ALERTS.push(a); }
  /* v8: yangi alert turlari (zone/sweep/session) 'message' maydonini yuboradi */
  var sub;
  if (a.message) sub = a.message;
  else sub = (a.dir === 'above' ? 'yuqoridan' : 'pastdan') + ' ' + (a.price != null ? a.price : '') + (a.note ? ' - ' + a.note : '');
  toast('ALERT: ' + (a.symbol || ''), sub);
  notify('XAUView alert - ' + (a.symbol || ''), sub);
  beep(); vibrate();
  document.getElementById('alertBtn').classList.add('has');
  renderAlerts();
}

/* ---------- sheets ---------- */
function openSheet(title, html, after){
  document.getElementById('shTitle').textContent = title;
  document.getElementById('shBody').innerHTML = html;
  document.getElementById('sheet').classList.add('on');
  document.getElementById('scrim').classList.add('on');
  if (after) after(document.getElementById('shBody'));
  mark();
}
function closeSheet(){
  document.getElementById('sheet').classList.remove('on');
  document.getElementById('scrim').classList.remove('on');
  mark();
}
function symSheet(){
  var h = '<div class="chips" style="flex-direction:column;align-items:stretch;gap:8px">';
  Object.keys(ASSETS).forEach(function(sym){
    var a = ASSETS[sym], m1 = a.tfs.M1, last = m1[m1.length - 1][4];
    h += '<button class="chip ' + (sym === S.sym ? 'on' : '') + '" data-sym="' + sym + '" style="display:flex;justify-content:space-between;align-items:center">' +
      '<span>' + a.provider + ':' + sym + '</span><span style="font-variant-numeric:tabular-nums">' + Number(last).toFixed(a.digits) + '</span></button>';
  });
  h += '</div><div class="hint">XAUUSD - OANDA feed, GBPUSD - FXCM feed.</div>';
  openSheet('Asset', h, function(body){
    body.querySelectorAll('[data-sym]').forEach(function(b){
      b.addEventListener('click', function(){ closeSheet(); setSym(b.dataset.sym); });
    });
  });
}
function tfSheet(){
  var h = '<div class="grid4">';
  TFS.forEach(function(t){
    h += '<button class="opt ' + (t === S.tf ? 'on' : '') + '" data-tf="' + t + '">' + t + '</button>';
  });
  h += '</div>';
  openSheet('Timeframe', h, function(body){
    body.querySelectorAll('[data-tf]').forEach(function(b){
      b.addEventListener('click', function(){ closeSheet(); setTF(b.dataset.tf); });
    });
  });
}
function indSheet(){
  var items = [
    ['asia', 'Asian box + BSL/SSL'],
    ['kill', 'Killzones (London/NY)'],
    ['fu', 'FU / SFU / AFU zonalar'],
    ['sweep', 'Sweep belgilari'],
    ['fvg', 'Sniper FVG'],
    ['vol', 'Volume pane'],
    ['magnet', 'Magnet (OHLC stick)']
  ];
  var h = '';
  items.forEach(function(it){
    var val = (it[0] === 'magnet') ? D.magnet : S.ind[it[0]];
    h += '<div class="ck"><span>' + it[1] + '</span><div class="sw ' + (val ? 'on' : '') + '" data-ind="' + it[0] + '"></div></div>';
  });
  h += '<div class="ctl" style="margin-top:12px"><span>Tema</span><div class="seg" style="flex:1" id="thSeg">' +
       '<button data-th="dark" class="on">Black</button><button data-th="light">Light</button></div></div>' +
       '<div class="hint">Asia sessiyasi 05:00-11:00 (UTC+5). Chart D1 da Asia moduli avtomatik ochiriladi.</div>';
  openSheet('Indikatorlar', h, function(body){
    body.querySelectorAll('[data-ind]').forEach(function(sw){
      sw.addEventListener('click', function(){
        var k = sw.dataset.ind;
        if (k === 'magnet') { D.magnet = !D.magnet; sw.classList.toggle('on', D.magnet); mark(); return; }
        S.ind[k] = !S.ind[k];
        if (k === 'vol') relayout();
        sw.classList.toggle('on', S.ind[k]);
        invalidate(); mark();
      });
    });
    body.querySelectorAll('#thSeg button').forEach(function(b){
      b.addEventListener('click', function(){
        body.querySelectorAll('#thSeg button').forEach(function(x){ x.classList.toggle('on', x === b); });
        applyTheme(b.dataset.th);
      });
    });
  });
}
function applyTheme(t){
  document.body.classList.toggle('light', t === 'light');
  S.theme = t;
  readVars();
  try { localStorage.setItem('xauview.m.theme', t); } catch (e) {}
  mark();
}
function toolsSheet(){
  D.sel = null;
  var h = '<div class="grid2">';
  [['trendline','Trendline','ic_trend_line_drawings'],['rect','Rectangle','ic_rectangle_drawing_drawings'],
   ['hline','Horizontal','ic_horizontal_line_drawings'],['vline','Vertical','ic_vertical_line_drawings'],
   ['text','Text','ic_text_drawings'],['fib','Fibo','ic_fib_retracement_drawings'],
   ['measure','Olchov','ic_measure_drawings'],['ray','Ray','ic_ray_drawings'],
   ['arrow','Streleka','ic_arrow_drawings'],['crosshair','Crosshair','ic_cross_line_drawings'],
   ['brush','Brush','ic_curve_drawings'],['highlighter','Marker','ic_highlighter_drawings'],
   ['channel','Kanal','ic_parallel_channel_drawings'],['hray','Gor.ray','ic_horizontal_ray_drawings']].forEach(function(t){
    var ic = apkIcon(t[2], 'oi') || apkIcon('ic_curve_drawings', 'oi') || apkIcon('ic_trend_line_drawings', 'oi');
    h += '<button class="opt ' + (D.tool === t[0] ? 'on' : '') + '" data-tool2="' + t[0] + '">' + ic + t[1] + '</button>';
  });
  h += '</div>';
  h += '<div class="btnrow"><button class="btn" id="tUndo">' + apkIcon('ic_chart_native_panel_undo','bi') + 'Undo</button>' +
       '<button class="btn" id="tRedo">' + apkIcon('ic_chart_native_panel_redo','bi') + 'Redo</button>' +
       '<button class="btn danger" id="tClear">' + apkIcon('ic_chart_context_menu_trash','bi') + 'Tozalash</button></div>';
  h += '<div class="hint">Chizmalar har symbol uchun alohida saqlanadi. Chartda chizish: asbobni tanla - barmoq bilan sudra (yoki 2 marta bos). Ro&#39;yxatdagi &#9881; - chizma rangi/qalinligi/uslubi.</div>';
  if (D.items.length) {
    h += '<div style="margin-top:10px">';
    D.items.forEach(function(it, i){
      var nm = TYPE_NAME[it.type] || it.type;
      var cc = it.color || '#2962FF';
      h += '<div class="row"><span class="dott" style="background:' + cc + ';box-shadow:inset 0 0 0 1px rgba(0,0,0,.4)"></span>' +
           '<span class="lbl">' + nm + (it.text ? ' - ' + esc(it.text) : '') + (it.locked ? ' &middot; qulf' : '') + (it.hidden ? ' &middot; yashirin' : '') + '</span>' +
           '<button class="gear" data-style="' + it.id + '" title="Stil">&#9881;</button>' +
           '<button class="del" data-delitem="' + it.id + '">&#10005;</button></div>';
    });
    h += '</div>';
  }
  openSheet('Asboblar', h, function(body){
    body.querySelectorAll('[data-tool2]').forEach(function(b){
      b.addEventListener('click', function(){ closeSheet(); setTool(b.dataset.tool2); });
    });
    body.querySelector('#tUndo').addEventListener('click', function(){ undo(); closeSheet(); });
    body.querySelector('#tRedo').addEventListener('click', function(){ redo(); closeSheet(); });
    body.querySelector('#tClear').addEventListener('click', function(){
      if (!D.items.length) { closeSheet(); return; }
      snapshot(); D.items = []; saveDrawings(); closeSheet(); mark();
    });
    body.querySelectorAll('[data-style]').forEach(function(b){
      b.addEventListener('click', function(){
        if (typeof openStyleSheet === 'function') openStyleSheet(b.dataset.style);
      });
    });
    body.querySelectorAll('[data-delitem]').forEach(function(b){
      b.addEventListener('click', function(){
        snapshot();
        D.items = D.items.filter(function(x){ return x.id !== b.dataset.delitem; });
        saveDrawings(); closeSheet(); mark();
      });
    });
  });
}
function menuSheet(){
  var base = feedBase() || '';
  var h = '<div class="row" id="mChartType"><span class="lbl">Chart turi<small>sham / hollow / bar / chiziq / area</small></span><span class="val" id="mChartVal">' + chartTypeName(S.chartType) + '</span></div>' +
    '<div class="row" id="mDrawList"><span class="lbl">Chizmalar<small>barcha chizmalarni boshqarish</small></span><span class="val">' + (D.items.length ? D.items.length + ' ta' : 'yoq') + '</span></div>' +
    '<div class="row"><span class="lbl">Rejim<small>live yoki oflayn snapshot</small></span><span class="val">' + (FEED.ok ? 'LIVE' : 'OFFLINE') + '</span></div>' +
    '<div class="row"><span class="lbl">Manba<small>server manzili</small></span><span class="val">' + (base ? base.replace(/^wss?:\/\//, '') : 'fayl (oflayn)') + '</span></div>' +
    '<div class="ctl" style="margin-top:8px"><input type="text" id="feedUrl" placeholder="ws://192.168.1.10:8765" value="' + esc(base) + '"></div>' +
    '<div class="btnrow"><button class="btn" id="mReconnect">Ulanish</button><button class="btn" id="mNotify">Bildirishnoma</button></div>' +
    '<div class="row" style="margin-top:6px"><span class="lbl">Demo ma\'lumot<small>MT5 snapshot, ' + META.source + '</small></span></div>' +
    '<div class="hint">Ma\'lumot: ' + S.sym + ' ' + S.tf + ', ' + cur().length + ' bar. OANDA/FXCM - feed yorlig\'i; real feed server orqali ulanadi. Savdo yo\'q - faqat chart va alertlar.</div>';
  openSheet('Menyu', h, function(body){
    body.querySelector('#mReconnect').addEventListener('click', function(){
      var v = body.querySelector('#feedUrl').value.trim();
      try { localStorage.setItem('xauview.feed', v); } catch (e) {}
      closeSheet(); reconnectNow();
    });
    body.querySelector('#mNotify').addEventListener('click', askNotify);
    var ctv = body.querySelector('#mChartType');
    if (ctv) ctv.addEventListener('click', function(){ closeSheet(); setTimeout(chartSheet, 210); });
    var dl = body.querySelector('#mDrawList');
    if (dl) dl.addEventListener('click', function(){ closeSheet(); setTimeout(toolsSheet, 210); });
  });
}

/* ---------- top / bottom ---------- */
function buildBottom(){
  var el = document.getElementById('bottom');
  var items = [
    ['crosshair', 'Cross', 'ic_cross_line_drawings'],
    ['trendline', 'Trend', 'ic_trend_line_drawings'],
    ['hline', 'H-Line', 'ic_horizontal_line_drawings'],
    ['rect', 'Rect', 'ic_rectangle_drawing_drawings'],
    ['more', 'Yana', 'ic_more_dots_vertical']
  ];
  el.innerHTML = items.map(function(it){
    return '<button class="tbtn' + (it[0] === 'crosshair' ? ' on' : '') + '" data-tool="' + it[0] + '">' +
      apkIcon(it[2]) + '<span>' + it[1] + '</span></button>';
  }).join('');
  el.querySelectorAll('.tbtn').forEach(function(b){
    b.addEventListener('click', function(){
      if (b.dataset.tool === 'more') { toolsSheet(); return; }
      setTool(b.dataset.tool);
    });
  });
}
function bindTop(){
  document.getElementById('symBtn').addEventListener('click', symSheet);
  document.getElementById('tfBtn').addEventListener('click', tfSheet);
  document.getElementById('indBtn').addEventListener('click', indSheet);
  document.getElementById('alertBtn').addEventListener('click', async function(){
    document.getElementById('alertBtn').classList.remove('has');
    await loadAlerts();
    openSheet('Alertlar', '', null);
    renderAlerts();
  });
  document.getElementById('menuBtn').addEventListener('click', menuSheet);
  document.getElementById('shClose').addEventListener('click', closeSheet);
  document.getElementById('scrim').addEventListener('click', closeSheet);
  document.getElementById('toastX').addEventListener('click', function(){
    document.getElementById('toast').classList.remove('on');
  });
}
function setSym(sym){
  S.sym = sym;
  document.getElementById('feedLbl').textContent = ASSETS[sym].provider + ':';
  document.getElementById('symLbl').textContent = sym;
  loadDrawings();
  V.rightOffset = 3; V.autoPrice = true;
  fit(); updateLegend(); mark();
  reconnectNow();
}
function setTF(tf){
  S.tf = tf;
  document.getElementById('tfBtn').innerHTML = tf + ' <span style="color:var(--text3);font-size:10px">&#9662;</span>';
  D.pending = null; D.sel = null;
  V.rightOffset = 3; V.autoPrice = true;
  fit(); updateLegend(); mark();
  reconnectNow();
}
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* ---------- init ---------- */
function init(){
  readVars();
  S.theme = 'dark';
  S.ind.vol = true;
  S.zoneTFs = ['H4'];
  S.zoneLookback = 120;
  try {
    var th = localStorage.getItem('xauview.m.theme');
    if (th === 'light') document.body.classList.add('light');
    var ct = localStorage.getItem('xauview.m.chart');
    if (ct) S.chartType = ct;
  } catch (e) {}
  loadDrawings();
  initCanvas();
  try { applyIcons(); } catch (e) {}
  buildBottom();
  bindTop();
  setSym('XAUUSD');
  document.getElementById('tfBtn').innerHTML = S.tf + ' <span style="color:var(--text3);font-size:10px">&#9662;</span>';
  V.fitPending = true;
  fit();
  updateLegend();
  connect();
  try { startFeedWatchdog(); } catch (e) {}
  FEED.fallbackTimer = setTimeout(function(){
    if (!FEED.ok) {
      setLive(false);
      toast('Oflayn rejim', 'Server topilmadi - MT5 snapshot ishlatilmoqda');
    }
  }, 2500);
  window.__M = { S: S, V: V, D: D, ASSETS: ASSETS, setSym: setSym, setTF: setTF, setTool: setTool,
                 fit: fit, getInd: getInd, connect: connect, FEED: FEED, ALERTS: function(){ return ALERTS; } };
}
window.addEventListener('load', init);

/* ===== v2: feed race guard ===== */
function handleMsg(m){
  if (m.type === "alert") { onAlert(m.alert); return; }
  if (!m.symbol || !m.tf) return;
  if (m.symbol !== S.sym || m.tf !== S.tf) return;
  if (m.type === "snapshot") {
    if (!ASSETS[m.symbol]) return;
    if (m.digits != null) ASSETS[m.symbol].digits = m.digits;
    ASSETS[m.symbol].tfs[m.tf] = m.bars;
    V.autoPrice = true;
    invalidate(); fit(); updateLegend(); mark();
  } else if (m.type === "tick") {
    applyTick(m);
  }
}
function applyTick(m){
  if (!m || !m.bar) return;
  if (m.symbol && m.symbol !== S.sym) return;
  if (m.tf && m.tf !== S.tf) return;
  var b = m.bar;
  var bars = ASSETS[S.sym] && ASSETS[S.sym].tfs[S.tf];
  LAST.bid = m.bid; LAST.ask = m.ask; LAST.t = m.time;
  if (!bars || !bars.length) { if (ASSETS[S.sym]) ASSETS[S.sym].tfs[S.tf] = [b]; mark(); return; }
  var last = bars[bars.length - 1];
  if (b[0] > last[0]) { bars.push(b); if (bars.length > 4000) bars.shift(); }
  else if (b[0] === last[0]) {
    last[1] = b[1]; last[2] = Math.max(last[2], b[2]); last[3] = Math.min(last[3], b[3]); last[4] = b[4]; last[5] = b[5];
  }
  if (!V.cross) updateLegend();
  mark();
}


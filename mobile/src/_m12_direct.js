/* _m12_direct.js - serverless (to'g'ridan-to'g'ri internet) rejim
   Manba: data-api.binance.vision (PAXGUSDT = oltin proxy, CORS *)
   + api.gold-api.com (XAU spot, CORS *) - narxni spotga moslash uchun
   GBPUSD: TwelveData bepul kaliti bo'lsa (localStorage 'xauview.tdkey'), aks holda oflayn. */
var DIRECT = { on: false, timer: null, watch: null, ratio: 1, src: '', last: '', n: 0, busy: false };
var DHOST = 'https://data-api.binance.vision/api/v3/';
var DTFS = { M1: '1m', M3: '3m', M5: '5m', M15: '15m', M30: '30m', H1: '1h', H4: '4h', D1: '1d' };
var DMAP = {
  XAUUSD: { k: 'PAXGUSDT', spot: 'XAU', digits: 3 },
  GBPUSD: { td: 'GBP/USD', digits: 5 }
};

function dStore(k, v){ try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
function dMap(){ return DMAP[S.sym] || null; }
function dTf(tf){ return DTFS[tf] || '1m'; }

function dJson(url){
  return fetch(url, { cache: 'no-store' }).then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
}

function dMakeBars(kl, ratio){
  var out = [];
  for (var i = 0; i < kl.length; i++) {
    var k = kl[i];
    out.push([Math.round(k[0] / 1000), +k[1] * ratio, +k[2] * ratio, +k[3] * ratio, +k[4] * ratio, +k[5]]);
  }
  return out;
}

/* XAU: PAXG -> spot nisbati (bir marta hisoblanadi, chart siljib ketmasligi uchun) */
function dRatio(cb){
  var m = dMap();
  if (!m || !m.spot) { DIRECT.ratio = 1; DIRECT.src = m && m.td ? 'twelvedata' : 'paxg'; cb(); return; }
  dJson('https://api.gold-api.com/price/' + m.spot).then(function(j){
    var spot = +j.price;
    return dJson(DHOST + 'ticker/price?symbol=' + m.k).then(function(t){
      var p = +t.price;
      DIRECT.ratio = (spot > 0 && p > 0) ? spot / p : 1;
      DIRECT.src = 'paxg+spot';
      try { console.log('[direct] ratio', DIRECT.ratio.toFixed(5), 'spot', spot, 'paxg', p); } catch (e) {}
      cb();
    });
  }).catch(function(){ DIRECT.ratio = 1; DIRECT.src = 'paxg'; cb(); });
}

function dSnapshot(cb){
  var m = dMap();
  if (!m) { setLive(false); if (cb) cb(false); return; }
  if (m.td) return dTwelve(cb);
  dJson(DHOST + 'klines?symbol=' + m.k + '&interval=' + dTf(S.tf) + '&limit=600').then(function(kl){
    var bars = dMakeBars(kl, DIRECT.ratio);
    if (!bars.length) throw new Error('bars 0');
    ASSETS[S.sym].digits = m.digits;
    handleMsg({ type: 'snapshot', symbol: S.sym, tf: S.tf, bars: bars, digits: m.digits, provider: DIRECT.src });
    if (bars.length) { LAST.bid = bars[bars.length - 1][4]; LAST.ask = LAST.bid; LAST.t = bars[bars.length - 1][0]; }
    setLive(true, 'direct');
    if (cb) cb(true);
  }).catch(function(e){ if (cb) cb(false); toast('Direct: ' + String(e.message || e).slice(0, 40), ''); });
}

function dTwelve(cb){
  var m = dMap(), key = dStore('xauview.tdkey');
  if (!key) { setLive(false); if (cb) cb(false); toast('GBPUSD: TwelveData kaliti kerak', 'bepul: twelvedata.com'); return; }
  var iv = { M1: '1min', M3: '1min', M5: '5min', M15: '15min', M30: '30min', H1: '1h', H4: '4h', D1: '1day' }[S.tf] || '1min';
  var n = S.tf === 'M3' ? 1800 : 600;
  dJson('https://api.twelvedata.com/time_series?symbol=' + encodeURIComponent(m.td) + '&interval=' + iv + '&outputsize=' + n + '&order=ASC&apikey=' + key).then(function(j){
    if (!j.values) throw new Error(j.message || 'no values');
    var bars = j.values.map(function(v){
      var t = Math.floor(new Date(v.datetime.replace(' ', 'T') + 'Z').getTime() / 1000);
      return [t, +v.open, +v.high, +v.low, +v.close, +(v.volume || 0)];
    });
    if (S.tf === 'M3') bars = bars.filter(function(b, i){ return i % 3 === 0; });
    ASSETS[S.sym].digits = m.digits;
    handleMsg({ type: 'snapshot', symbol: S.sym, tf: S.tf, bars: bars, digits: m.digits, provider: 'twelvedata' });
    setLive(true, 'twelve');
    if (cb) cb(true);
  }).catch(function(e){ if (cb) cb(false); toast('TwelveData: ' + String(e.message || e).slice(0, 40), ''); });
}

function dPoll(){
  if (!DIRECT.on || DIRECT.busy) return;
  var m = dMap();
  if (!m) return;
  DIRECT.busy = true;
  if (m.td) {
    if (DIRECT.n % 4 === 0) dSnapshot();
    DIRECT.n++; DIRECT.busy = false; return;
  }
  dJson(DHOST + 'klines?symbol=' + m.k + '&interval=' + dTf(S.tf) + '&limit=2').then(function(kl){
    DIRECT.busy = false;
    if (!kl || !kl.length) return;
    var b = dMakeBars(kl, DIRECT.ratio);
    var bar = b[b.length - 1];
    handleMsg({ type: 'tick', symbol: S.sym, tf: S.tf, bar: bar, bid: bar[4], ask: bar[4], time: bar[0] });
    setLive(true, 'direct');
    DIRECT.n++;
  }).catch(function(){ DIRECT.busy = false; setLive(false); });
}

function dWatchState(){
  var k = S.sym + '|' + S.tf;
  if (k === DIRECT.last) return;
  DIRECT.last = k;
  if (!DIRECT.on) return;
  dRatio(function(){ dSnapshot(); });
}

function directStart(quiet){
  DIRECT.on = true;
  dStore('xauview.direct', '1');
  FEED.closed = true;
  try { if (FEED.ws) FEED.ws.close(); } catch (e) {}
  clearInterval(DIRECT.timer); clearInterval(DIRECT.watch);
  DIRECT.last = '';
  dRatio(function(){ DIRECT.last = S.sym + '|' + S.tf; dSnapshot(); });
  DIRECT.timer = setInterval(dPoll, 4000);
  DIRECT.watch = setInterval(dWatchState, 700);
  if (!quiet) toast('Direct rejim', 'internet manba, server kerak emas');
  if (typeof opPaint === 'function') opPaint();
}

function directStop(quiet){
  DIRECT.on = false;
  dStore('xauview.direct', '0');
  clearInterval(DIRECT.timer); clearInterval(DIRECT.watch);
  FEED.closed = false;
  if (typeof reconnectNow === 'function') reconnectNow();
  if (!quiet) toast('Server rejimi', 'qayta ulanmoqda');
  if (typeof opPaint === 'function') opPaint();
}

function directToggle(){ if (DIRECT.on) directStop(); else directStart(); }

setTimeout(function(){
  if (dStore('xauview.direct') === '1') { DIRECT.on = true; FEED.closed = true; dStore('xauview.direct', '1'); directStart(true); }
}, 1200);
/* LIVE badge: direct rejimda 'LIVE · DIR' */
function setLive(on, tag){
  FEED.ok = on;
  var el = document.getElementById('live');
  if (!el) return;
  el.textContent = on ? (tag === 'direct' || tag === 'twelve' ? 'LIVE · DIR' : 'LIVE') : 'OFFLINE';
  el.classList.toggle('off', !on);
}

/* provayder chip: direct rejimda DIRECT */
function opPaint(){
  var el = document.getElementById('provChip');
  if (!el) return;
  if (DIRECT.on) { el.textContent = 'DIRECT'; el.className = 'provchip open'; return; }
  if (!OP.ok) { el.textContent = 'MANBA ?'; el.className = 'provchip off'; return; }
  var a = OP.active || '--', pv = null;
  for (var i = 0; i < OP.list.length; i++) if (OP.list[i].name === a) pv = OP.list[i];
  el.textContent = String(a).toUpperCase() + (pv && pv.ok === false ? ' !' : '');
  el.className = 'provchip' + (a === 'mt5' ? ' mt5' : ' open') + (pv && pv.ok === false ? ' warn' : '');
}
/* WS qatlamini to'liq o'chirish (direct rejimda 404 urinishlar bo'lmasin) */
function connect(){
  if (DIRECT.on) return;
  var base = feedBase();
  if (!base) { setLive(false); return; }
  FEED.gen = (FEED.gen || 0) + 1;
  var gen = FEED.gen;
  var url = base + '/ws?symbol=' + S.sym + '&tf=' + S.tf;
  try { FEED.ws = new WebSocket(url); } catch (e) { setLive(false); return; }
  var sock = FEED.ws;
  sock.onopen = function(){
    if (gen !== FEED.gen) return;
    FEED.retry = 0; setLive(true); clearTimeout(FEED.fallbackTimer);
  };
  sock.onmessage = function(ev){
    if (gen !== FEED.gen) return;
    FEED.lastMsg = Date.now();
    var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    handleMsg(m);
  };
  sock.onclose = function(){
    if (gen !== FEED.gen || DIRECT.on) return;
    setLive(false);
    if (!FEED.closed) scheduleReconnect();
  };
  sock.onerror = function(){
    if (gen !== FEED.gen) return;
    try { sock.close(); } catch (e) {}
  };
}
function reconnectNow(){
  if (DIRECT.on) { DIRECT.last = ''; scheduleReconnectDirect(); return; }
  clearTimeout(FEED.timer);
  FEED.closed = false;
  FEED.gen = (FEED.gen || 0) + 1;
  var old = FEED.ws;
  FEED.ws = null;
  try { if (old) old.close(); } catch (e) {}
  setTimeout(connect, 80);
}
function scheduleReconnectDirect(){
  clearTimeout(DIRECT.reloadT);
  DIRECT.reloadT = setTimeout(function(){
    if (!DIRECT.on) return;
    dRatio(function(){ dSnapshot(); });
  }, 120);
}

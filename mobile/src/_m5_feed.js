/* ==========================================================================
   v5: live feed qatlami — generation guard bilan (symbol/TF almashganda race yo'q)
   ========================================================================== */
'use strict';

function connect(){
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
    if (gen !== FEED.gen) return;
    setLive(false);
    if (!FEED.closed) scheduleReconnect();
  };
  sock.onerror = function(){
    if (gen !== FEED.gen) return;
    try { sock.close(); } catch (e) {}
  };
}
function scheduleReconnect(){
  FEED.retry = Math.min(FEED.retry + 1, 6);
  var wait = Math.min(1000 * Math.pow(1.6, FEED.retry), 12000);
  clearTimeout(FEED.timer);
  FEED.timer = setTimeout(function(){ if (!FEED.closed) connect(); }, wait);
}
function reconnectNow(){
  clearTimeout(FEED.timer);
  FEED.closed = false;
  FEED.gen = (FEED.gen || 0) + 1;
  var old = FEED.ws;
  FEED.ws = null;
  try { if (old) old.close(); } catch (e) {}
  setTimeout(connect, 80);
}
/* v7: watchdog — jim o'chgan/uzilgan WS ni o'zi tiklaydi */
function startFeedWatchdog(){
  if (FEED.wd) return;
  FEED.wd = setInterval(function(){
    if (FEED.closed) return;
    var ws = FEED.ws;
    if (!ws || ws.readyState === 3) { if (!FEED.timer) reconnectNow(); return; }
    if (ws.readyState !== 1) return;
    var age = Date.now() - (FEED.lastMsg || Date.now());
    if (age > 25000) reconnectNow();
  }, 8000);
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState !== 'visible' || FEED.closed) return;
    var ws = FEED.ws;
    if (!ws || ws.readyState !== 1) reconnectNow();
  });
}
function handleMsg(m){
  if (m.type === 'alert') { onAlert(m.alert); return; }
  if (!m.symbol || !m.tf) return;
  if (m.symbol !== S.sym || m.tf !== S.tf) return;
  if (m.type === 'snapshot') {
    if (!ASSETS[m.symbol]) return;
    if (m.digits != null) ASSETS[m.symbol].digits = m.digits;
    ASSETS[m.symbol].tfs[m.tf] = m.bars;
    V.autoPrice = true;
    invalidate();
    fit(); updateLegend(); mark();
  } else if (m.type === 'tick') {
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

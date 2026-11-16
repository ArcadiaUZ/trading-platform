/* _m14_trade.js - MT5 savdo paneli (order management, telefon uchun) - Lead */
/* Server: /api/trade/* (server/trade.py). Mock rejim: XAUVIEW_TRADE_MOCK=1 */
var TR = {
  st: null, at: 0, err: null, tab: 'pos', timer: null, busy: false,
  draft: { side: 'buy', type: 'market', vol: 0.01, price: 0, sl: 0, tp: 0 }
};

function trBase(){
  try { var b = httpBase(); if (!b) return ''; return b.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:'); }
  catch (e) { return ''; }
}
function trHdr(){
  var h = { 'Content-Type': 'application/json' };
  try { var t = localStorage.getItem('xauview.tradeToken'); if (t) h['X-Trade-Token'] = t; } catch (e) {}
  return h;
}
function trReq(method, path, body){
  var base = trBase();
  if (!base) return Promise.resolve({ ok: false, status: 0, j: { detail: 'no_server' } });
  var opt = { method: method, headers: trHdr(), cache: 'no-store' };
  if (body) opt.body = JSON.stringify(body);
  return fetch(base + path, opt).then(function(r){
    return r.json().then(function(j){ return { ok: r.ok, status: r.status, j: j }; })
      .catch(function(){ return { ok: false, status: r.status, j: {} }; });
  }).catch(function(e){ return { ok: false, status: 0, j: { detail: String(e).slice(0, 80) } }; });
}
function trFmt(n, d){
  if (n == null || isNaN(n)) return '-';
  var x = Number(n).toFixed(d == null ? 2 : d);
  var p = x.split('.');
  p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return p.join('.');
}
function trDg(sym){ var s = TR.st && TR.st.symbols && TR.st.symbols[sym]; return s ? s.digits : (sym === 'GBPUSD' ? 5 : 3); }
function trSym(sym){
  var s = TR.st && TR.st.symbols && TR.st.symbols[sym];
  return s || { digits: trDg(sym), point: sym === 'GBPUSD' ? 0.00001 : 0.001, min_lot: 0.01, max_lot: 100, lot_step: 0.01, spread: 0, bid: 0, ask: 0, market_open: true };
}
function trModeTxt(){
  if (!TR.st) return { t: 'OFF', c: 'off', why: 'yuklanmoqda...' };
  var m = TR.st.mode, why = TR.st.why;
  if (m === 'mock') return { t: 'PAPER', c: 'mock', why: 'mock rejim (MT5 kerak emas)' };
  if (m === 'live') return why === 'mt5_unavailable'
    ? { t: 'OFF', c: 'off', why: 'MT5 topilmadi - terminal ochiq va ulangan bolsin' }
    : { t: 'LIVE', c: 'live', why: 'MT5 akkaunt' };
  return { t: 'OFF', c: 'off', why: 'savdo serverda ochirilgan (XAUVIEW_TRADE=0)' };
}
function trPaint(){
  var st = TR.st;
  var m = trModeTxt();
  var bd = document.getElementById('trBadge');
  if (bd) { bd.textContent = m.t; bd.className = 'trbadge ' + m.c; }
  var ac = document.getElementById('trAcct');
  if (ac) {
    if (st && st.account) {
      ac.innerHTML = '<b>' + esc(st.account.company || st.account.server || '') + '</b>' +
        '<small>' + esc(st.account.server || '') + ' &middot; #' + esc(String(st.account.login)) +
        ' &middot; 1:' + esc(String(st.account.leverage)) + ' &middot; ' + esc(st.account.currency || '') + '</small>';
    } else {
      ac.innerHTML = '<b>Akkaunt ulanmagan</b><small>' + esc(m.why) + '</small>';
    }
  }
  var a = (st && st.account) || {};
  var set = function(id, v, col){
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = v;
    if (col) el.style.color = col; else el.style.color = '';
  };
  var pos = (st && st.positions) || [], ord = (st && st.orders) || [];
  var floatPnl = 0; pos.forEach(function(p){ floatPnl += Number(p.profit || 0) + Number(p.swap || 0); });
  var pnlCol = floatPnl > 0.0001 ? '#22AB94' : (floatPnl < -0.0001 ? '#F6465D' : 'var(--text)');
  set('trBal', trFmt(a.balance, 2));
  set('trEq', trFmt(a.equity, 2));
  set('trPnl', (floatPnl > 0 ? '+' : '') + trFmt(floatPnl, 2), pnlCol);
  set('trMl', a.margin_level ? trFmt(a.margin_level, 1) + '%' : '-');
  set('trFree', trFmt(a.free_margin, 2));
  set('trMargin', trFmt(a.margin, 2));
  var s = trSym(S.sym);
  var sb = document.getElementById('trSell'), bb = document.getElementById('trBuy');
  if (sb) sb.querySelector('.p').textContent = s.bid ? trFmt(s.bid, s.digits) : '-';
  if (bb) bb.querySelector('.p').textContent = s.ask ? trFmt(s.ask, s.digits) : '-';
  document.querySelectorAll('[data-trtab]').forEach(function(b){
    var k = b.getAttribute('data-trtab');
    var n = k === 'pos' ? pos.length : (k === 'ord' ? ord.length : 0);
    b.className = 'opt' + (TR.tab === k ? ' on' : '');
    b.innerHTML = (k === 'pos' ? 'Pozitsiya' : (k === 'ord' ? 'Order' : 'Tarix')) + (n ? ' (' + n + ')' : '');
  });
  var list = document.getElementById('trList');
  if (list) list.innerHTML = TR.tab === 'pos' ? trPosHtml(pos, s) : (TR.tab === 'ord' ? trOrdHtml(ord) : '<div class="hint">Tarix yuklanmoqda...</div>');
  trBind();
}
function trPosHtml(pos, s){
  if (TR.err) return '<div class="hint" style="color:#F6465D">' + esc(TR.err) + '</div>';
  if (!pos.length) return '<div class="hint">Ochiq pozitsiya yoq. Pastdagi SELL / BUY bilan boshlang.</div>';
  return pos.map(function(p){
    var d = trDg(p.symbol), buy = p.type === 'buy';
    var pr = Number(p.profit || 0) + Number(p.swap || 0);
    var col = pr > 0 ? '#22AB94' : (pr < 0 ? '#F6465D' : 'var(--text)');
    return '<div class="trcard">' +
      '<div class="trrow1"><span class="trside ' + (buy ? 'b' : 's') + '">' + (buy ? 'BUY' : 'SELL') + '</span>' +
      '<b>' + esc(p.symbol) + '</b><span class="trvol">' + trFmt(p.volume, 2) + ' lot</span>' +
      '<span class="trprofit" style="color:' + col + '">' + (pr > 0 ? '+' : '') + trFmt(pr, 2) + '</span></div>' +
      '<div class="trrow2"><span>Kirish <b>' + trFmt(p.price_open, d) + '</b></span>' +
      '<span>Joriy <b>' + trFmt(p.price_current, d) + '</b></span>' +
      '<span>SL <b>' + (p.sl ? trFmt(p.sl, d) : '-') + '</b></span>' +
      '<span>TP <b>' + (p.tp ? trFmt(p.tp, d) : '-') + '</b></span></div>' +
      '<div class="trrow3"><button class="btn small" data-trmod="' + p.ticket + '">SL/TP</button>' +
      '<button class="btn small" data-trclose="' + p.ticket + '">Yopish</button>' +
      '<span class="trtick">#' + p.ticket + '</span></div></div>';
  }).join('');
}
function trOrdHtml(ord){
  if (TR.err) return '<div class="hint" style="color:#F6465D">' + esc(TR.err) + '</div>';
  if (!ord.length) return '<div class="hint">Kutilayotgan order yoq. Order turi: Limit / Stop / Stop-limit.</div>';
  var nm = { buy_limit: 'BUY LIMIT', sell_limit: 'SELL LIMIT', buy_stop: 'BUY STOP', sell_stop: 'SELL STOP', buy_stop_limit: 'BUY STOP-LIMIT', sell_stop_limit: 'SELL STOP-LIMIT' };
  return ord.map(function(o){
    var d = trDg(o.symbol);
    return '<div class="trcard">' +
      '<div class="trrow1"><span class="trside ' + (o.type.indexOf('buy') === 0 ? 'b' : 's') + '">' + esc(nm[o.type] || o.type) + '</span>' +
      '<b>' + esc(o.symbol) + '</b><span class="trvol">' + trFmt(o.volume, 2) + ' lot</span></div>' +
      '<div class="trrow2"><span>Narx <b>' + trFmt(o.price, d) + '</b></span>' +
      '<span>SL <b>' + (o.sl ? trFmt(o.sl, d) : '-') + '</b></span>' +
      '<span>TP <b>' + (o.tp ? trFmt(o.tp, d) : '-') + '</b></span></div>' +
      '<div class="trrow3"><button class="btn small" data-trmod="' + o.ticket + '">Ozgartirish</button>' +
      '<button class="btn small" data-trcancel="' + o.ticket + '">Bekor</button>' +
      '<span class="trtick">#' + o.ticket + '</span></div></div>';
  }).join('');
}
function trBind(){
  document.querySelectorAll('[data-trtab]').forEach(function(b){
    b.onclick = function(){ TR.tab = b.getAttribute('data-trtab'); trPaint(); if (TR.tab === 'hist') trHistory(); };
  });
  document.querySelectorAll('[data-trclose]').forEach(function(b){ b.onclick = function(){ trCloseSheet(b.getAttribute('data-trclose')); }; });
  document.querySelectorAll('[data-trmod]').forEach(function(b){ b.onclick = function(){ trModSheet(b.getAttribute('data-trmod')); }; });
  document.querySelectorAll('[data-trcancel]').forEach(function(b){ b.onclick = function(){ trCancel(b.getAttribute('data-trcancel')); }; });
}
function trLoad(cb){
  trReq('GET', '/api/trade/state').then(function(r){
    TR.at = Date.now();
    if (r.ok && r.j) { TR.st = r.j; TR.err = null; }
    else { TR.err = (r.j && r.j.detail) ? String(r.j.detail) : ('HTTP ' + r.status); }
    if (cb) cb(TR.st);
    return TR.st;
  });
}
function trPollStart(){
  if (TR.timer) return;
  TR.timer = setInterval(function(){ if (!document.hidden && document.getElementById('sheet').classList.contains('on')) trLoad(trPaint); }, 2500);
}
function trPollStop(){ if (TR.timer) { clearInterval(TR.timer); TR.timer = null; } }

function tradeSheet(){
  var m = trModeTxt();
  var h = '';
  h += '<div class="trhead"><span id="trBadge" class="trbadge ' + m.c + '">' + m.t + '</span><span id="trAcct">yuklanmoqda...</span></div>';
  h += '<div class="trgrid"><div><small>Balans</small><b id="trBal">-</b></div><div><small>Equity</small><b id="trEq">-</b></div><div><small>P/L</small><b id="trPnl">-</b></div></div>';
  h += '<div class="trgrid2"><div><small>Margin</small><b id="trMargin">-</b></div><div><small>Erkin</small><b id="trFree">-</b></div><div><small>Margin lvl</small><b id="trMl">-</b></div></div>';
  h += '<div class="trbtns"><button class="trbtn sell" id="trSell"><small>SELL</small><span class="p">-</span></button>' +
       '<button class="trbtn buy" id="trBuy"><small>BUY</small><span class="p">-</span></button></div>';
  h += '<div class="chiprow" data-trtabs><button class="opt on" data-trtab="pos">Pozitsiya</button><button class="opt" data-trtab="ord">Order</button><button class="opt" data-trtab="hist">Tarix</button></div>';
  h += '<div id="trList"><div class="hint">Yuklanmoqda...</div></div>';
  h += '<div class="btnrow" style="margin-top:10px"><button class="btn" id="trNew">Yangi order</button>' +
       '<button class="btn" id="trAcctBtn">Akkaunt</button><button class="btn danger" id="trFlat">Hammasini yopish</button></div>';
  openSheet('Savdo (MT5)', h, function(body){
    body.querySelector('#trSell').onclick = function(){ trTicket('sell'); };
    body.querySelector('#trBuy').onclick = function(){ trTicket('buy'); };
    body.querySelector('#trNew').onclick = function(){ trTicket(null); };
    body.querySelector('#trAcctBtn').onclick = function(){ trAccountSheet(); };
    body.querySelector('#trFlat').onclick = trFlat;
    trPaint();
  });
  trLoad(function(){ trPaint(); });
  trPollStart();
}
function trTicket(side){
  if (side) TR.draft.side = side;
  var d = TR.draft;
  var s = trSym(S.sym);
  if (d.vol < s.min_lot) d.vol = s.min_lot;
  var h = '';
  h += '<div class="chiprow" id="trSideRow"><button class="opt ' + (d.side === 'buy' ? 'on' : '') + '" data-side="buy">BUY</button>' +
       '<button class="opt ' + (d.side === 'sell' ? 'on' : '') + '" data-side="sell">SELL</button></div>';
  h += '<div class="chiprow" id="trTypeRow">';
  [['market', 'Market'], ['limit', 'Limit'], ['stop', 'Stop'], ['stop_limit', 'Stop-limit']].forEach(function(t){
    h += '<button class="opt ' + (d.type === t[0] ? 'on' : '') + '" data-type="' + t[0] + '">' + t[1] + '</button>';
  });
  h += '</div>';
  h += '<div class="row"><span class="lbl">Hajm (lot)<small>min ' + s.min_lot + ' / qadam ' + s.lot_step + '</small></span>' +
       '<span class="stepper"><button class="stp" data-vol="-">-</button><input id="trVol" inputmode="decimal" value="' + d.vol + '"><button class="stp" data-vol="+">+</button></span></div>';
  h += '<div class="chiprow" id="trQuick">' + [0.01, 0.05, 0.1, 0.5, 1].filter(function(v){ return v >= s.min_lot; }).map(function(v){
    return '<button class="opt" data-quick="' + v + '">' + v + '</button>';
  }).join('') + '</div>';
  h += '<div class="row" id="trPriceRow"' + (d.type === 'market' ? ' style="display:none"' : '') + '><span class="lbl">Narx<small>' + (d.type === 'stop_limit' ? 'stop narx' : 'order narx') + '</small></span>' +
       '<input class="num" id="trPrice" inputmode="decimal" value="' + (d.price ? trFmt(d.price, s.digits) : '') + '"></div>';
  h += '<div class="row"><span class="lbl">Stop-Loss<small>0 = yoq</small></span><input class="num" id="trSl" inputmode="decimal" value="' + (d.sl ? trFmt(d.sl, s.digits) : '') + '"></div>';
  h += '<div class="row"><span class="lbl">Take-Profit<small>0 = yoq</small></span><input class="num" id="trTp" inputmode="decimal" value="' + (d.tp ? trFmt(d.tp, s.digits) : '') + '"></div>';
  h += '<div class="trquote" id="trQuote"></div>';
  h += '<div class="btnrow"><button class="btn" id="trCheck">Tekshirish</button><button class="btn primary" id="trSend">Yuborish</button></div>';
  h += '<div class="hint" id="trRes"></div>';
  openSheet('Yangi order - ' + S.sym, h, function(body){
    var upd = function(){
      var q = trSym(S.sym);
      var b = document.getElementById('trQuote');
      if (b) b.innerHTML = 'Bid <b>' + trFmt(q.bid, q.digits) + '</b> &middot; Ask <b>' + trFmt(q.ask, q.digits) + '</b> &middot; spread ' + trFmt(q.spread, 1) + ' &middot; ' +
        (q.market_open === false ? '<span style="color:#FF9800">bozor yopiq</span>' : '<span style="color:#22AB94">bozor ochiq</span>');
      var pr = document.getElementById('trPriceRow');
      if (pr) pr.style.display = TR.draft.type === 'market' ? 'none' : '';
    };
    upd();
    body.querySelectorAll('[data-side]').forEach(function(b){ b.onclick = function(){ TR.draft.side = b.getAttribute('data-side'); body.querySelectorAll('[data-side]').forEach(function(x){ x.className = 'opt' + (x === b ? ' on' : ''); }); }; });
    body.querySelectorAll('[data-type]').forEach(function(b){
      b.onclick = function(){
        TR.draft.type = b.getAttribute('data-type');
        body.querySelectorAll('[data-type]').forEach(function(x){ x.className = 'opt' + (x === b ? ' on' : ''); });
        upd();
      };
    });
    body.querySelectorAll('[data-quick]').forEach(function(b){ b.onclick = function(){ TR.draft.vol = Number(b.getAttribute('data-quick')); body.querySelector('#trVol').value = TR.draft.vol; }; });
    body.querySelectorAll('[data-vol]').forEach(function(b){
      b.onclick = function(){
        var q = trSym(S.sym);
        var st = Number(q.lot_step || 0.01);
        var v = Number(body.querySelector('#trVol').value) || q.min_lot;
        v = b.getAttribute('data-vol') === '+' ? v + st : v - st;
        v = Math.max(q.min_lot, Math.min(q.max_lot || 100, Math.round(v / st) * st));
        TR.draft.vol = Number(v.toFixed(2));
        body.querySelector('#trVol').value = TR.draft.vol;
      };
    });
    body.querySelector('#trCheck').onclick = function(){ trSend(body, true); };
    body.querySelector('#trSend').onclick = function(){ trSend(body, false); };
  });
}
function trReadTicket(body){
  var d = TR.draft;
  var q = trSym(S.sym);
  var rd = function(sel){ var el = body.querySelector(sel); return el ? Number(String(el.value).replace(/\s/g, '').replace(',', '.')) || 0 : 0; };
  d.vol = rd('#trVol') || q.min_lot;
  d.price = d.type === 'market' ? 0 : rd('#trPrice');
  d.sl = rd('#trSl');
  d.tp = rd('#trTp');
  return d;
}
function trSend(body, dry){
  if (TR.busy) return;
  var d = trReadTicket(body);
  var q = trSym(S.sym);
  if (d.type !== 'market' && !d.price) { toast('Narx kerak', 'Limit/Stop uchun narxni kiriting'); return; }
  TR.busy = true;
  var res = document.getElementById('trRes');
  if (res) res.textContent = dry ? 'tekshirilmoqda...' : 'yuborilmoqda...';
  trReq('POST', '/api/trade/order', {
    symbol: S.sym, side: d.side, type: d.type, volume: d.vol,
    price: d.price || null, sl: d.sl, tp: d.tp, deviation: 20, comment: 'XAUView', dry_run: !!dry
  }).then(function(r){
    TR.busy = false;
    var j = r.j || {};
    var ok = r.ok && j.ok;
    var msg = j.comment || j.message || j.detail || ('HTTP ' + r.status);
    if (res) {
      res.innerHTML = (ok ? '<span style="color:#22AB94">OK</span> ' : '<span style="color:#F6465D">XATO ' + (j.retcode != null ? j.retcode : r.status) + '</span> ') + esc(msg) +
        (j.check && j.check.margin != null ? '<br>margin: <b>' + trFmt(j.check.margin, 2) + '</b> &middot; erkin: <b>' + trFmt(j.check.margin_free, 2) + '</b>' : '');
    }
    if (ok && !dry) { vibrate(); toast('Order yuborildi', '#ticket ' + (j.ticket || '-')); closeSheet(); setTimeout(tradeSheet, 220); }
    else if (ok) { vibrate(); }
    else { toast('Rad etildi', String(msg).slice(0, 60)); }
  });
  if (!dry) beep();
}
function trCloseSheet(ticket){
  trLoad(function(st){
    var p = ((st && st.positions) || []).filter(function(x){ return String(x.ticket) === String(ticket); })[0];
    if (!p) { toast('Pozitsiya topilmadi', 'yangilang'); return; }
    var d = trDg(p.symbol);
    var h = '<div class="hint">' + esc(p.symbol) + ' ' + (p.type === 'buy' ? 'BUY' : 'SELL') + ' &middot; ' + trFmt(p.volume, 2) + ' lot &middot; kirish ' + trFmt(p.price_open, d) + ' &middot; P/L ' + trFmt(p.profit, 2) + '</div>' +
      '<div class="row"><span class="lbl">Hajm<small>qoldirish uchun kamroq kiriting (qismli yopish)</small></span><input class="num" id="trCVol" inputmode="decimal" value="' + trFmt(p.volume, 2) + '"></div>' +
      '<div class="btnrow"><button class="btn danger" id="trCFull">Hammasini yopish</button><button class="btn primary" id="trCPart">Qismli yopish</button></div><div class="hint" id="trCRes"></div>';
    openSheet('Pozitsiyani yopish #' + ticket, h, function(body){
      var send = function(vol){
        var res = body.querySelector('#trCRes');
        if (res) res.textContent = 'yuborilmoqda...';
        trReq('POST', '/api/trade/close', { ticket: Number(ticket), volume: vol, dry_run: false }).then(function(r){
          var j = r.j || {};
          var ok = r.ok && j.ok;
          if (ok) { toast('Yopildi', '#ticket ' + ticket); closeSheet(); setTimeout(tradeSheet, 220); }
          else { if (res) res.innerHTML = '<span style="color:#F6465D">' + esc(j.comment || j.detail || ('HTTP ' + r.status)) + '</span>'; toast('Yopilmadi', String(j.comment || j.detail || '').slice(0, 60)); }
        });
      };
      body.querySelector('#trCFull').onclick = function(){ send(null); };
      body.querySelector('#trCPart').onclick = function(){ send(Number(String(body.querySelector('#trCVol').value).replace(',', '.'))); };
    });
  });
}
function trModSheet(ticket){
  trLoad(function(st){
    var all = ((st && st.positions) || []).concat((st && st.orders) || []);
    var it = all.filter(function(x){ return String(x.ticket) === String(ticket); })[0];
    if (!it) { toast('Topilmadi', 'yangilang'); return; }
    var d = trDg(it.symbol);
    var isPos = it.price_current != null;
    var h = '<div class="hint">' + esc(it.symbol) + ' &middot; #' + ticket + (isPos ? ' &middot; pozitsiya' : ' &middot; pending order') + '</div>';
    if (!isPos) h += '<div class="row"><span class="lbl">Narx<small>order narxi</small></span><input class="num" id="trMPrice" inputmode="decimal" value="' + trFmt(it.price, d) + '"></div>';
    h += '<div class="row"><span class="lbl">Stop-Loss<small>0 = olib tashlash</small></span><input class="num" id="trMSl" inputmode="decimal" value="' + (it.sl ? trFmt(it.sl, d) : '') + '"></div>';
    h += '<div class="row"><span class="lbl">Take-Profit</span><input class="num" id="trMTp" inputmode="decimal" value="' + (it.tp ? trFmt(it.tp, d) : '') + '"></div>';
    h += '<div class="btnrow"><button class="btn primary" id="trMSend">Saqlash</button><button class="btn" id="trMBreak">SL ni tenglashtirish</button></div><div class="hint" id="trMRes"></div>';
    openSheet('Ozgartirish #' + ticket, h, function(body){
      var rd = function(sel){ var el = body.querySelector(sel); return el ? Number(String(el.value).replace(/\s/g, '').replace(',', '.')) || 0 : 0; };
      body.querySelector('#trMBreak').onclick = function(){
        var pr = isPos ? Number(it.price_current) : Number(it.price);
        body.querySelector('#trMSl').value = trFmt(pr, d);
      };
      body.querySelector('#trMSend').onclick = function(){
        var payload = { ticket: Number(ticket), sl: rd('#trMSl'), tp: rd('#trMTp'), dry_run: false };
        if (!isPos) payload.price = rd('#trMPrice') || null;
        var res = body.querySelector('#trMRes');
        if (res) res.textContent = 'saqlanmoqda...';
        trReq('POST', '/api/trade/modify', payload).then(function(r){
          var j = r.j || {};
          if (r.ok && j.ok) { toast('Saqlandi', '#' + ticket); closeSheet(); setTimeout(tradeSheet, 220); }
          else { if (res) res.innerHTML = '<span style="color:#F6465D">' + esc(j.comment || j.detail || ('HTTP ' + r.status)) + '</span>'; toast('Saqalmadi', String(j.comment || j.detail || '').slice(0, 60)); }
        });
      };
    });
  });
}
function trCancel(ticket){
  trReq('POST', '/api/trade/cancel', { ticket: Number(ticket) }).then(function(r){
    var j = r.j || {};
    if (r.ok && j.ok) { toast('Bekor qilindi', '#' + ticket); trLoad(trPaint); }
    else toast('Bekor qilinmadi', String(j.comment || j.detail || ('HTTP ' + r.status)).slice(0, 60));
  });
}
function trFlat(){
  var n = ((TR.st && TR.st.positions) || []).length, o = ((TR.st && TR.st.orders) || []).length;
  if (!n && !o) { toast('Yopish uchun narsa yoq', ''); return; }
  if (!window.confirm('Hamma pozitsiya yopiladi (' + n + ' ta) va pending orderlar bekor qilinadi (' + o + ' ta). Davom?')) return;
  trReq('POST', '/api/trade/flat', { confirm: true }).then(function(r){
    var j = r.j || {};
    if (r.ok && j.ok) { toast('Yopildi', 'pozitsiya: ' + j.closed + ', bekor: ' + j.canceled); trLoad(trPaint); }
    else toast('Xato', String(j.detail || j.comment || ('HTTP ' + r.status)).slice(0, 60));
  });
}
function trHistory(){
  trReq('GET', '/api/trade/history?days=7').then(function(r){
    var list = document.getElementById('trList');
    if (!list) return;
    var j = r.j || {};
    var deals = j.deals || [];
    if (!r.ok) { list.innerHTML = '<div class="hint">Tarix olinmadi: ' + esc(j.detail || ('HTTP ' + r.status)) + '</div>'; return; }
    if (!deals.length) { list.innerHTML = '<div class="hint">Oxirgi 7 kunda deal yoq.</div>'; return; }
    list.innerHTML = deals.slice().reverse().map(function(x){
      var pr = Number(x.profit || 0), col = pr > 0 ? '#22AB94' : (pr < 0 ? '#F6465D' : 'var(--text)');
      var t = new Date((x.time || 0) * 1000);
      var hh = ('0' + t.getHours()).slice(-2) + ':' + ('0' + t.getMinutes()).slice(-2);
      return '<div class="trcard"><div class="trrow1"><span class="trside ' + (x.type === 'buy' ? 'b' : 's') + '">' + esc((x.type || '').toUpperCase()) + '</span>' +
        '<b>' + esc(x.symbol) + '</b><span class="trvol">' + trFmt(x.volume, 2) + '</span>' +
        '<span class="trprofit" style="color:' + col + '">' + (pr > 0 ? '+' : '') + trFmt(pr, 2) + '</span></div>' +
        '<div class="trrow2"><span>' + trFmt(x.price, trDg(x.symbol)) + '</span><span>' + hh + '</span><span>' + esc(x.entry || '') + '</span></div></div>';
    }).join('');
  });
}
function trAccountSheet(){
  var st = TR.st || {}, a = st.account || {};
  var mode = trModeTxt();
  var h = '<div class="row"><span class="lbl">Server rejimi<small>' + esc(mode.why) + '</small></span><span class="val">' + mode.t + '</span></div>';
  if (a.login) {
    h += '<div class="row"><span class="lbl">Ulangan<small>' + esc(a.company || '') + '</small></span><span class="val">#' + esc(String(a.login)) + '</span></div>';
    h += '<div class="row"><span class="lbl">Server</span><span class="val">' + esc(a.server || '-') + '</span></div>';
  }
  h += '<div class="row"><span class="lbl">Kompaniya<small>masalan Exness, IC Markets</small></span><input class="num" id="trLc" value="' + esc(a.company || '') + '" placeholder="Exness"></div>';
  h += '<div class="row"><span class="lbl">Server nomi<small>MT5 terminal -> pastdagi nom</small></span><input class="num" id="trLs" value="' + esc(a.server || '') + '" placeholder="Exness-MT5Trial8"></div>';
  h += '<div class="row"><span class="lbl">Login</span><input class="num" id="trLl" inputmode="numeric" value="" placeholder="474932446"></div>';
  h += '<div class="row"><span class="lbl">Parol<small>faqat xotirada, saqlanmaydi</small></span><input class="num" id="trLp" type="password" value="" placeholder="******"></div>';
  h += '<div class="row"><span class="lbl">Trade token<small>server XAUVIEW_TRADE_TOKEN sozlagan bolsa</small></span><input class="num" id="trLt" value="" placeholder="ixtiyoriy"></div>';
  h += '<div class="btnrow"><button class="btn primary" id="trLogin">Ulanish</button><button class="btn" id="trLogout">Uzish</button></div>';
  h += '<div class="hint">MT5 terminal kompyuterda ochiq va bir marta login qilingan bolishi kerak. Render/Linux serverda MT5 yoq - savdo faqat Windows server orqali (yoki XAUVIEW_TRADE_MOCK=1 paper rejim).</div>';
  h += '<div class="hint" id="trLRes"></div>';
  openSheet('Akkaunt', h, function(body){
    try { var t = localStorage.getItem('xauview.tradeToken'); if (t) body.querySelector('#trLt').value = t; } catch (e) {}
    body.querySelector('#trLogin').onclick = function(){
      var v = function(sel){ return String(body.querySelector(sel).value || '').trim(); };
      var tok = v('#trLt');
      try { if (tok) localStorage.setItem('xauview.tradeToken', tok); else localStorage.removeItem('xauview.tradeToken'); } catch (e) {}
      var res = body.querySelector('#trLRes');
      if (res) res.textContent = 'ulanmoqda...';
      trReq('POST', '/api/trade/login', { company: v('#trLc'), server: v('#trLs'), login: Number(v('#trLl')) || 0, password: v('#trLp') }).then(function(r){
        var j = r.j || {};
        if (r.ok && j.ok) { toast('Ulandi', (j.account && j.account.company) || ''); closeSheet(); setTimeout(tradeSheet, 200); }
        else if (res) res.innerHTML = '<span style="color:#F6465D">' + esc(j.detail || j.comment || ('HTTP ' + r.status)) + '</span>';
      });
    };
    body.querySelector('#trLogout').onclick = function(){
      trReq('POST', '/api/trade/logout', {}).then(function(){ toast('Uzildi', ''); closeSheet(); });
    };
  });
}
function trInit(){
  var s = document.createElement('style');
  s.textContent =
    '#sheet .trhead{display:flex;align-items:center;gap:8px;margin-bottom:8px}' +
    '#sheet .trbadge{font:700 10px/20px -apple-system,Segoe UI,Roboto,sans-serif;padding:0 7px;border-radius:5px;letter-spacing:.5px}' +
    '#sheet .trbadge.live{background:#12291f;color:#22AB94;border:1px solid #1d4d43}' +
    '#sheet .trbadge.mock{background:#1b2340;color:#5b8cff;border:1px solid #2a3a6d}' +
    '#sheet .trbadge.off{background:#2a2a2a;color:#9aa0a6;border:1px solid #3a3a3a}' +
    '#sheet #trAcct{display:flex;flex-direction:column;min-width:0}' +
    '#sheet #trAcct b{font:600 12px -apple-system,Segoe UI,Roboto,sans-serif;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#sheet #trAcct small{font:400 10px -apple-system,Segoe UI,Roboto,sans-serif;color:var(--text3)}' +
    '#sheet .trgrid,#sheet .trgrid2{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:8px 0}' +
    '#sheet .trgrid>div,#sheet .trgrid2>div{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:6px 8px;display:flex;flex-direction:column}' +
    '#sheet .trgrid small,#sheet .trgrid2 small{font:400 9px -apple-system,Segoe UI,Roboto,sans-serif;color:var(--text3);text-transform:uppercase;letter-spacing:.4px}' +
    '#sheet .trgrid b,#sheet .trgrid2 b{font:600 14px/18px -apple-system,Segoe UI,Roboto,sans-serif;color:var(--text);font-variant-numeric:tabular-nums}' +
    '#sheet .trbtns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}' +
    '#sheet .trbtn{display:flex;flex-direction:column;align-items:center;padding:10px 0;border-radius:10px;border:1px solid transparent}' +
    '#sheet .trbtn small{font:700 11px -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:1px}' +
    '#sheet .trbtn .p{font:600 16px/20px -apple-system,Segoe UI,Roboto,sans-serif;font-variant-numeric:tabular-nums}' +
    '#sheet .trbtn.sell{background:#2a1215;color:#F6465D;border-color:#5a1e24}' +
    '#sheet .trbtn.buy{background:#0f2a20;color:#22AB94;border-color:#1d4d43}' +
    '#sheet .chiprow{display:flex;gap:6px;margin:8px 0}' +
    '#sheet .chiprow .opt{flex:1;height:30px;font:600 11px -apple-system,Segoe UI,Roboto,sans-serif}' +
    '#sheet .trcard{background:var(--panel);border:1px solid var(--border);border-radius:9px;padding:8px;margin:8px 0}' +
    '#sheet .trrow1{display:flex;align-items:center;gap:6px}' +
    '#sheet .trrow1 b{font:600 12px -apple-system,Segoe UI,Roboto,sans-serif}' +
    '#sheet .trside{font:700 9px/16px -apple-system,Segoe UI,Roboto,sans-serif;padding:0 5px;border-radius:4px}' +
    '#sheet .trside.b{background:#0f2a20;color:#22AB94}#sheet .trside.s{background:#2a1215;color:#F6465D}' +
    '#sheet .trvol{font:400 10px -apple-system,Segoe UI,Roboto,sans-serif;color:var(--text3)}' +
    '#sheet .trprofit{margin-left:auto;font:600 12px -apple-system,Segoe UI,Roboto,sans-serif;font-variant-numeric:tabular-nums}' +
    '#sheet .trrow2{display:flex;gap:10px;margin-top:4px;font:400 10px -apple-system,Segoe UI,Roboto,sans-serif;color:var(--text3)}' +
    '#sheet .trrow2 b{color:var(--text2);font-variant-numeric:tabular-nums}' +
    '#sheet .trrow3{display:flex;gap:6px;align-items:center;margin-top:6px}' +
    '#sheet .trrow3 .btn.small{height:26px;padding:0 10px;font:600 10px -apple-system,Segoe UI,Roboto,sans-serif}' +
    '#sheet .trtick{margin-left:auto;font:400 9px -apple-system,Segoe UI,Roboto,sans-serif;color:var(--text3)}' +
    '#sheet .stepper{display:flex;align-items:center;gap:6px}' +
    '#sheet .stepper .stp{width:30px;height:30px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--text);font:700 16px/28px -apple-system,Segoe UI,Roboto,sans-serif}' +
    '#sheet .stepper input{width:66px;height:30px;text-align:center;background:var(--panel);border:1px solid var(--border);border-radius:8px;color:var(--text);font:600 13px -apple-system,Segoe UI,Roboto,sans-serif}' +
    '#sheet input.num{width:96px;height:30px;text-align:right;background:var(--panel);border:1px solid var(--border);border-radius:8px;color:var(--text);font:600 12px -apple-system,Segoe UI,Roboto,sans-serif;padding:0 8px}' +
    '#sheet .trquote{margin:8px 0;font:400 11px -apple-system,Segoe UI,Roboto,sans-serif;color:var(--text3)}' +
    '#sheet .trquote b{color:var(--text2);font-variant-numeric:tabular-nums}' +
    '#sheet .btn.primary{background:#2962FF;border-color:#2962FF;color:#fff}' +
    '#sheet .btn.danger{background:#2a1215;border-color:#5a1e24;color:#F6465D}';
  document.head.appendChild(s);
  trLoad(function(){});   // menyudagi holat uchun kesh
  setInterval(function(){ if (!document.hidden && Date.now() - TR.at > 30000) trLoad(function(){ if (document.getElementById('sheet').classList.contains('on')) trPaint(); }); }, 31000);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(trInit, 900); });
else setTimeout(trInit, 900);

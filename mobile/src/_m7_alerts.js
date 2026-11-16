/* ==========================================================================
   v9: ALERT TURLARI — narx / zona / Asia sweep / sessiya
   (_m4_ui.js dagi renderAlerts va onAlert ni almashtiradi)
   Server API: POST /api/alerts  {symbol, type}
     type=price   {dir:'above'|'below', price, note}
     type=zone    {tf, lo, hi, label, repeat}
     type=sweep   {} (Asia diapazoni serverda hisoblanadi)
     type=session {which:'london'|'ny'}
   ========================================================================== */
'use strict';

var ALUI = { type: 'price', dir: 'above', tf: 'M15', which: 'london', repeat: false, cross: false };

function alertTitle(a){
  if (!a) return '';
  var dg = ASSETS[a.symbol] ? ASSETS[a.symbol].digits : 3;
  var t = a.type || 'price';
  if (t === 'price') return a.symbol + ' ' + (a.dir === 'above' ? '>=' : '<=') + ' ' + Number(a.price).toFixed(dg);
  if (t === 'zone') return a.symbol + ' zona ' + Number(a.lo).toFixed(dg) + ' - ' + Number(a.hi).toFixed(dg);
  if (t === 'sweep') return a.symbol + ' Asia sweep';
  if (t === 'session') return a.symbol + ' ' + (a.which === 'london' ? 'London' : 'NY') + ' killzone';
  return a.symbol || '';
}

function alertRowHtml(a){
  var dg = ASSETS[a.symbol] ? ASSETS[a.symbol].digits : 3;
  var t = a.type || 'price';
  var fired = a.status === 'triggered' || !!a.triggered;
  var icn = t === 'zone' ? 'ic_rectangle_drawing_drawings' : (t === 'sweep' ? 'ic_arrow_drawings' : (t === 'session' ? 'ic_alert_bell' : 'ic_horizontal_line_drawings'));
  var sub = fired ? 'ishlagan' : 'kutmoqda';
  if (t === 'zone') sub += ' - ' + (a.tf || 'M15') + (a.repeat ? ' - qayta' : '') + (a.label ? ' - ' + a.label : '');
  if (t === 'sweep') {
    if (a.range && a.range.high != null) sub += ' - H ' + Number(a.range.high).toFixed(dg) + ' / L ' + Number(a.range.low).toFixed(dg);
    if (a.sides) sub += ' - BSL ' + (a.sides.bsl ? 'ok' : '-') + ' SSL ' + (a.sides.ssl ? 'ok' : '-');
  }
  if (t === 'session' && a.target_ts) sub += ' - ' + new Date(a.target_ts * 1000).toTimeString().slice(0, 5);
  if (a.message) sub += ' - ' + a.message;
  var right = '';
  if (t === 'price') right = Number(a.price).toFixed(dg);
  else if (a.distance != null) right = a.distance === 0 ? 'ichida' : Number(a.distance).toFixed(dg);
  return '<div class="alertrow' + (fired ? ' trig' : '') + '">' +
    '<span class="dott" style="background:' + (fired ? 'var(--text3)' : 'var(--accent)') + '"></span>' +
    '<div class="info"><b>' + apkIcon(icn, 'ti') + alertTitle(a) + '</b><small>' + sub + '</small></div>' +
    (right ? '<div class="p">' + right + '</div>' : '') +
    '<button class="del" data-del="' + a.id + '">&#10005;</button></div>';
}

function renderAlerts(){
  var body = document.getElementById('shBody');
  if (!body) return;
  var curPrice = cur().length ? cur()[cur().length - 1][4] : 0;
  var dg = ASSETS[S.sym].digits;
  var h = '';
  if (!ALERTS.length) {
    h += '<div class="empty">Hali alert yoq.<br>Pastdan tur tanlab qosh: narx, zona, Asia sweep yoki sessiya.</div>';
  } else {
    ALERTS.forEach(function(a){ h += alertRowHtml(a); });
  }
  h += '<div class="btnrow" style="padding-top:12px"><button class="btn" id="alNotify">Bildirishnoma ruxsati</button></div>';
  h += '<div class="hint" style="padding-top:12px;font-weight:600;color:var(--text2)">Yangi alert turi</div>';
  h += '<div class="chips" id="alType">';
  [['price','Narx'],['zone','Zona'],['sweep','Asia sweep'],['session','Sessiya']].forEach(function(t){
    h += '<button class="chip' + (ALUI.type === t[0] ? ' on' : '') + '" data-type="' + t[0] + '">' + t[1] + '</button>';
  });
  h += '</div>';
  if (ALUI.type === 'price') {
    h += '<div class="ctl"><div class="seg" id="alDir" style="flex:1">' +
         '<button data-dir="above"' + (ALUI.dir === 'above' ? ' class="on"' : '') + '>&ge; yuqoridan</button>' +
         '<button data-dir="below"' + (ALUI.dir === 'below' ? ' class="on"' : '') + '>&le; pastdan</button></div></div>' +
         '<div class="ctl"><input type="number" step="any" id="alPrice" value="' + Number(curPrice).toFixed(dg) + '"></div>' +
         '<div class="ctl"><input type="text" id="alNote" placeholder="izoh (ixtiyoriy)"></div>';
  } else if (ALUI.type === 'zone') {
    var stp = dg === 5 ? 0.0010 : 1;
    h += '<div class="ctl"><span style="width:20px;color:var(--text3)">lo</span>' +
         '<input type="number" step="any" id="alLo" value="' + (curPrice - stp).toFixed(dg) + '">' +
         '<span style="width:20px;color:var(--text3)">hi</span>' +
         '<input type="number" step="any" id="alHi" value="' + (curPrice + stp).toFixed(dg) + '"></div>' +
         '<div class="chips" id="alTf">' +
         '<button class="chip' + (ALUI.tf === 'M5' ? ' on' : '') + '" data-tf="M5">M5</button>' +
         '<button class="chip' + (ALUI.tf === 'M15' ? ' on' : '') + '" data-tf="M15">M15</button>' +
         '<button class="chip' + (ALUI.tf === 'H1' ? ' on' : '') + '" data-tf="H1">H1</button></div>' +
         '<div class="ctl"><input type="text" id="alNote" placeholder="zona nomi (ixtiyoriy)"></div>' +
         '<div class="ck"><span class="lbl">Faqat kirish paytida<small>narx hozir zonada bolsa darhol ishlamasin - tashqaridan kirganda signal</small></span>' +
         '<span class="sw' + (ALUI.cross ? ' on' : '') + '" id="alCross"></span></div>' +
         '<div class="ck"><span class="lbl">Qayta qurollansin<small>narx zonadan chiqib yana kirsa qayta signal</small></span>' +
         '<span class="sw' + (ALUI.repeat ? ' on' : '') + '" id="alRepeat"></span></div>';
  } else if (ALUI.type === 'sweep') {
    h += '<div class="hint">Server Asia (05:00-11:00 Toshkent) high/low ni ozi hisoblaydi. Asia yopilgandan keyin narx wick bilan tashqariga chiqib yana ichkariga qaytsa signal beradi: BSL = yuqori tomondan, SSL = pastki tomondan. Har tomon uchun kuniga bir marta.</div>';
  } else {
    h += '<div class="chips" id="alWhich">' +
         '<button class="chip' + (ALUI.which === 'london' ? ' on' : '') + '" data-which="london">London 11:30</button>' +
         '<button class="chip' + (ALUI.which === 'ny' ? ' on' : '') + '" data-which="ny">NY 16:30</button></div>' +
         '<div class="hint">Killzone ochilishida eslatma yuboradi (Toshkent vaqti).</div>';
  }
  h += '<div class="btnrow"><button class="btn primary" id="alAdd">Alert qoshish - ' + S.sym + '</button></div>';
  h += '<div class="hint">Alertlarni server (MT5) kuzatadi. Trigger bolganda WS orqali xabar + system notification keladi (https yoki localhost bolsa).</div>';
  body.innerHTML = h;

  body.querySelectorAll('[data-del]').forEach(function(btn){
    btn.addEventListener('click', function(){ delAlert(btn.dataset.del); });
  });
  body.querySelectorAll('#alType .chip').forEach(function(c){
    c.addEventListener('click', function(){ ALUI.type = c.dataset.type; renderAlerts(); });
  });
  body.querySelectorAll('#alDir button').forEach(function(b){
    b.addEventListener('click', function(){ ALUI.dir = b.dataset.dir; renderAlerts(); });
  });
  body.querySelectorAll('#alTf .chip').forEach(function(c){
    c.addEventListener('click', function(){ ALUI.tf = c.dataset.tf; renderAlerts(); });
  });
  body.querySelectorAll('#alWhich .chip').forEach(function(c){
    c.addEventListener('click', function(){ ALUI.which = c.dataset.which; renderAlerts(); });
  });
  var sw = body.querySelector('#alRepeat');
  if (sw) sw.addEventListener('click', function(){ ALUI.repeat = !ALUI.repeat; sw.classList.toggle('on', ALUI.repeat); });
  var swc = body.querySelector('#alCross');
  if (swc) swc.addEventListener('click', function(){ ALUI.cross = !ALUI.cross; swc.classList.toggle('on', ALUI.cross); });
  body.querySelector('#alNotify').addEventListener('click', askNotify);
  body.querySelector('#alAdd').addEventListener('click', function(){
    var noteEl = body.querySelector('#alNote');
    var note = noteEl ? noteEl.value : '';
    if (ALUI.type === 'price') {
      var p = parseFloat(body.querySelector('#alPrice').value);
      if (!isFinite(p) || p <= 0) { toast('Narx notogri'); return; }
      addAlert(ALUI.dir, p, note);
    } else if (ALUI.type === 'zone') {
      var lo = parseFloat(body.querySelector('#alLo').value);
      var hi = parseFloat(body.querySelector('#alHi').value);
      if (!isFinite(lo) || !isFinite(hi) || lo <= 0 || hi <= lo) { toast('Zona notogri', 'lo < hi bolishi kerak'); return; }
      postAlert({ symbol: S.sym, type: 'zone', tf: ALUI.tf, lo: lo, hi: hi, label: note, repeat: !!ALUI.repeat, on_cross: !!ALUI.cross });
    } else if (ALUI.type === 'sweep') {
      postAlert({ symbol: S.sym, type: 'sweep' });
    } else {
      postAlert({ symbol: S.sym, type: 'session', which: ALUI.which });
    }
  });
}

function onAlert(a){
  var src = (a && a.alert) ? a.alert : a;
  if (!src) return;
  var row = ALERTS.filter(function(x){ return x.id === src.id; })[0];
  if (row) {
    row.status = src.status; row.triggered_at = src.triggered_at;
    row.message = src.message; row.triggered = src.triggered_at; row.price_at = src.price_at;
  } else { ALERTS.push(src); }
  var sub = src.message || alertTitle(src);
  toast('ALERT: ' + (src.symbol || ''), sub);
  notify('XAUView alert - ' + (src.symbol || ''), sub);
  beep(); vibrate();
  var btn = document.getElementById('alertBtn');
  if (btn) btn.classList.add('has');
  renderAlerts();
}

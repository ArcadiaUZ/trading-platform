/* _m10_open.js - open-data provider badge + switch (Lead) */
/* provider chip css */
(function(){ var s=document.createElement('style');
 s.textContent = '#top .provchip{height:26px;padding:0 8px;border-radius:7px;border:1px solid var(--border);background:var(--panel);color:var(--text2);font:600 10px/26px -apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.3px;margin-left:6px;flex:0 0 auto}' +
 '#top .provchip.mt5{color:#22AB94;border-color:#1d4d43}' +
 '#top .provchip.open{color:#2962FF;border-color:#1f3a7a}' +
 '#top .provchip.warn{color:#FF9800;border-color:#5a3b0a}' +
 '#top .provchip.off{color:var(--text3)}';
 document.head.appendChild(s); })();

var OP = { list: [], active: null, at: 0, ok: false };

function opBase(){
  try { return httpBase(); } catch (e) { return ''; }
}

function opChip(){
  var el = document.getElementById('provChip');
  if (!el) return null;
  return el;
}

function opPaint(){
  var el = opChip();
  if (!el) return;
  var a = OP.active || '--';
  if (!OP.ok) { el.textContent = 'MANBA ?'; el.className = 'provchip off'; return; }
  var nm = String(a).toUpperCase();
  var pv = null;
  for (var i = 0; i < OP.list.length; i++) if (OP.list[i].name === a) pv = OP.list[i];
  el.textContent = nm + (pv && pv.ok === false ? ' !' : '');
  el.className = 'provchip' + (a === 'mt5' ? ' mt5' : ' open') + (pv && pv.ok === false ? ' warn' : '');
}

function opLoad(cb){
  var base = opBase();
  if (!base) { OP.ok = false; opPaint(); if (cb) cb(); return; }
  fetch(base + '/api/providers', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(j){
    OP.ok = true; OP.active = j.active || null; OP.list = j.providers || []; OP.at = Date.now();
    opPaint(); if (cb) cb();
  }).catch(function(){ OP.ok = false; opPaint(); if (cb) cb(); });
}

function opSheet(){
  opLoad(function(){
    var h = '<div class="row"><span class="lbl">Aktiv manba<small>narx qayerdan olinadi</small></span><span class="val">' + esc(String(OP.active || '--').toUpperCase()) + '</span></div>';
    h += '<div class="hint">Bepul/ochiq manbalar (API kalit kerak emas). OANDA/FXCM O\'zbekistonda ishlamaydi, shuning uchun Yahoo/Stooq/gold-api. MT5 ulangan bo\'lsa - birinchi navbatda MT5.</div>';
    h += '<div class="row" id="opDir"><span class="lbl">Serverless rejim<small>' + (typeof DIRECT !== 'undefined' && DIRECT.on ? 'yonilgan - server/laptop kerak emas' : 'ochirilgan - server kerak') + '</small></span><span class="val">' + (typeof DIRECT !== 'undefined' && DIRECT.on ? 'OFF' : 'ON') + '</span></div>';
    h += '<div class="row" id="opTd"><span class="lbl">GBPUSD kaliti (TwelveData)<small>' + (function(){ try { return localStorage.getItem('xauview.tdkey') ? 'kiritilgan' : 'bepul kalit kerak'; } catch (e) { return '-'; } })() + '</small></span><span class="val">kiritish</span></div>';
    if (typeof And !== 'undefined' && And && And.getServer) {
      h += '<div class="row" id="opSrv"><span class="lbl">APK server manzili<small>' + esc(And.getServer() || 'offline') + '</small></span><span class="val">ozgartirish</span></div>';
    }
    if (OP.list.length) {
      h += '<div style="margin-top:8px">';
      OP.list.forEach(function(p){
        var st = p.ok === true ? 'ok' : (p.ok === false ? 'xato' : '?');
        var lat = p.latency_ms != null ? ' <small>' + p.latency_ms + ' ms</small>' : '';
        h += '<div class="row" data-prov="' + esc(p.name) + '"><span class="lbl">' + esc(String(p.name).toUpperCase()) + '<small>' + esc(st) + (p.last_err ? ' - ' + esc(String(p.last_err).slice(0, 40)) : '') + '</small></span>' +
             '<span class="val">' + (p.name === OP.active ? 'aktiv' : 'tanlash') + lat + '</span></div>';
      });
      h += '</div>';
    } else h += '<div class="hint">Server /api/providers bermadi (eski versiya bo\'lishi mumkin).</div>';
    openSheet('Malumot manbasi', h, function(body){
      var drow = body.querySelector('#opDir');
      if (drow) drow.addEventListener('click', function(){ closeSheet(); setTimeout(directToggle, 200); });
      var tdr = body.querySelector('#opTd');
      if (tdr) tdr.addEventListener('click', function(){
        var k = window.prompt('TwelveData API kaliti (bepul: twelvedata.com/register):', '');
        if (k) { try { localStorage.setItem('xauview.tdkey', k.trim()); } catch (e) {} closeSheet(); toast('Kalit saqlandi', 'GBPUSD direct rejimda ishlaydi'); }
      });
      var sr = body.querySelector('#opSrv');
      if (sr) sr.addEventListener('click', function(){ closeSheet(); setTimeout(function(){ And.chooseServer(); }, 200); });
      body.querySelectorAll('[data-prov]').forEach(function(row){
        row.addEventListener('click', function(){
          var nm = row.getAttribute('data-prov');
          fetch(opBase() + '/api/provider', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: nm }) })
            .then(function(r){ return r.json(); }).then(function(j){ closeSheet(); toast('Manba: ' + nm, j && j.active ? j.active : ''); opLoad(); })
            .catch(function(){ toast('Almashtirilmadi', ''); });
        });
      });
    });
  });
}

function opInit(){
  var top = document.getElementById('top');
  if (!top || document.getElementById('provChip')) return;
  var el = document.createElement('button');
  el.id = 'provChip'; el.className = 'provchip'; el.textContent = '...';
  el.addEventListener('click', opSheet);
  var tf = document.getElementById('tfBtn');
  if (tf && tf.parentNode === top) top.insertBefore(el, tf.nextSibling); else top.appendChild(el);
  opLoad();
  setInterval(function(){ if (!document.hidden && Date.now() - OP.at > 15000) opLoad(); }, 16000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(opInit, 400); });
else setTimeout(opInit, 400);
/* [part: _m6_pwa.js] =========================================================
   v6: PWA qatlami — service worker + Notification API (secure context)
   FAQAT https:// yoki localhost'da to'liq ishlaydi (http LAN'da SW yo'q).
   ========================================================================== */
'use strict';

var PWA_ICON  = 'icons/icon-192.png';
var PWA_BADGE = 'icons/favicon-32.png';
var PWA_SWV   = 'sw.js';

function pwaSecure(){
  try {
    if (window.isSecureContext) return true;
    var h = location.hostname || '';
    return location.protocol === 'https:' ||
           h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch (e) { return false; }
}

function pwaHasNotification(){
  return (typeof window !== 'undefined') && ('Notification' in window);
}

function pwaPerm(){
  try { return pwaHasNotification() ? Notification.permission : 'unavailable'; }
  catch (e) { return 'unavailable'; }
}

/* ---------- head'ga ikonka linklarini qo'shish (head Lead'da, tegmaymiz) ---------- */
function pwaInjectIcons(){
  try {
    function add(rel, href, sizes){
      if (document.querySelector('link[rel="' + rel + '"]')) return;
      var l = document.createElement('link');
      l.rel = rel; l.href = href;
      if (sizes) l.sizes = sizes;
      document.head.appendChild(l);
    }
    add('apple-touch-icon', 'icons/apple-touch-icon.png', '180x180');
    add('icon', 'icons/favicon-32.png', '32x32');
    add('icon', PWA_ICON, '192x192');
  } catch (e) {}
}

/* ---------- service worker ---------- */
function pwaRegisterSW(){
  try {
    if (!('serviceWorker' in navigator)) return false;
    if (!pwaSecure()) return false;
    navigator.serviceWorker.register(PWA_SWV, { scope: './' }).then(function(reg){
      try {
        if (reg.waiting) { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); }
        reg.addEventListener('updatefound', function(){
          var sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', function(){
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              try { sw.postMessage({ type: 'SKIP_WAITING' }); } catch (e) {}
            }
          });
        });
      } catch (e) {}
    }, function(err){
      try { console.warn('[PWA] SW ro\u02bbyxatdan o\u02bbtkazilmadi:', (err && err.message) || err); } catch (e) {}
    });
    return true;
  } catch (e) { return false; }
}

/* ---------- Notification ruxsati ---------- */
function pwaRequest(){
  return new Promise(function(resolve){
    try {
      if (!pwaHasNotification()) { resolve('unavailable'); return; }
      if (!pwaSecure()) { resolve('insecure'); return; }
      if (Notification.permission === 'granted') { resolve('granted'); return; }
      if (Notification.permission === 'denied') { resolve('denied'); return; }
      var p = Notification.requestPermission(function(res){ resolve(res || pwaPerm()); });
      if (p && typeof p.then === 'function') {
        p.then(function(res){ resolve(res || pwaPerm()); }, function(){ resolve(pwaPerm()); });
      }
    } catch (e) { resolve(pwaPerm()); }
  });
}

/* ---------- system notification ---------- */
function pwaNativeNotify(title, body){
  try {
    if (!pwaHasNotification() || Notification.permission !== 'granted') return false;
    new Notification(title, { body: body, icon: PWA_ICON, badge: PWA_BADGE, tag: 'xauview' });
    return true;
  } catch (e) { return false; }
}

function pwaNotify(title, body){
  var t = title || 'XAUView';
  var b = body || '';
  /* toast har holda (sahifa ichida) */
  try { if (typeof toast === 'function') toast(t, b); } catch (e) {}
  if (!pwaHasNotification() || Notification.permission !== 'granted') return false;
  /* Android Chrome'da "new Notification" taqiqlangan -> SW registration orqali */
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready &&
        navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(function(reg){
        try {
          reg.showNotification(t, {
            body: b, icon: PWA_ICON, badge: PWA_BADGE,
            tag: 'xauview', renotify: true, silent: false,
            vibrate: [60, 40, 60], data: { ts: Date.now() }
          });
        } catch (e) { pwaNativeNotify(t, b); }
      }, function(){ pwaNativeNotify(t, b); });
      return true;
    }
  } catch (e) {}
  return pwaNativeNotify(t, b);
}

/* ---------- birinchi bosishda ruxsat so'rash (faqat secure context) ---------- */
function pwaAskOnFirstTap(){
  try {
    if (!pwaHasNotification() || !pwaSecure()) return;
    if (Notification.permission !== 'default') return;
    var done = false;
    var handler = function(){
      if (done) return;
      done = true;
      try { document.removeEventListener('pointerdown', handler, true); } catch (e) {}
      try { document.removeEventListener('click', handler, true); } catch (e) {}
      pwaRequest().then(function(p){
        try { console.log('[PWA] birinchi bosish -> ruxsat:', p); } catch (e) {}
      });
    };
    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('click', handler, true);
  } catch (e) {}
}

/* ---------- public API ---------- */
window.__PWA = {
  supported: pwaHasNotification() && ('serviceWorker' in navigator),
  secure: pwaSecure(),
  get perm(){ return pwaPerm(); },
  request: function(){ return pwaRequest(); },
  notify: function(title, body){ return pwaNotify(title, body); }
};

/* ---------- init ---------- */
(function pwaInit(){
  try {
    pwaInjectIcons();
    var swOn = pwaRegisterSW();
    pwaAskOnFirstTap();
    /* holat logi — faqat bir marta */
    var msg = '[PWA] holat: protocol=' + location.protocol +
              ', secure=' + pwaSecure() +
              ', sw=' + (swOn ? 'registered' : (('serviceWorker' in navigator) ? 'insecure/off' : 'unsupported')) +
              ', Notification=' + (pwaHasNotification() ? pwaPerm() : 'yo\u02bbq');
    if (pwaSecure()) {
      console.log(msg);
    } else {
      console.log(msg + ' | https:// tunnel orqali oching — system notification uchun shart');
    }
  } catch (e) {
    try { console.warn('[PWA] init xato:', (e && e.message) || e); } catch (e2) {}
  }
})();

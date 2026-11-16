/* ==========================================================================
   XAUView — Service Worker (PWA)
   - navigation (index.html) : NETWORK-FIRST  (dev paytida eski fayl ko'rinmasin)
   - icons/*, manifest      : CACHE-FIRST
   - /api/*                 : NETWORK-FIRST + oflayn JSON xato (HECH QACHON keshlanmaydi)
   - /ws                    : HECH QACHON keshlanmaydi (WebSocket upgrade SW'dan o'tmasligi kerak)
   ========================================================================== */
'use strict';

var CACHE_VERSION = 'xauview-v6-2026-11-16';
var STATIC_CACHE  = CACHE_VERSION + '-static';

/* install'da keshga uriniladigan fayllar — mavjud bo'lmagani install'ni buzmaydi */
var PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-512-maskable.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png'
];

function isApi(url){ return url.pathname === '/api' || url.pathname.indexOf('/api/') === 0; }
function isWs(url){ return url.pathname === '/ws' || url.pathname.indexOf('/ws/') === 0; }
function isStaticAsset(url){
  return url.pathname.indexOf('/icons/') === 0 ||
         url.pathname === '/manifest.webmanifest' ||
         url.pathname === '/favicon.ico' ||
         /\.(png|jpg|jpeg|svg|webp|ico|webmanifest)$/i.test(url.pathname);
}

/* ---------------- install ---------------- */
self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache){
      /* Promise.allSettled: bitta fayl 404 bo'lsa ham install fail BO'LMAYDI */
      var jobs = PRECACHE.map(function(u){
        return fetch(new Request(u, { cache: 'reload' })).then(function(res){
          if (res && (res.ok || res.type === 'opaque')) return cache.put(u, res);
          return null;
        }).catch(function(){ return null; });
      });
      if (typeof Promise.allSettled === 'function') {
        return Promise.allSettled(jobs).then(function(){
          return self.skipWaiting();
        });
      }
      return Promise.all(jobs.map(function(p){ return p.catch(function(){ return null; }); }))
        .then(function(){ return self.skipWaiting(); });
    }).catch(function(){
      return self.skipWaiting();
    })
  );
});

/* ---------------- activate ---------------- */
self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){
        if (k !== STATIC_CACHE) return caches.delete(k);
        return null;
      }));
    }).then(function(){
      return self.clients.claim();
    })
  );
});

/* ---------------- fetch ---------------- */
self.addEventListener('fetch', function(event){
  var req = event.request;
  if (req.method !== 'GET') return;                 // POST/DELETE -> to'g'ridan-to'g'ri tarmoq

  var url;
  try { url = new URL(req.url); } catch (e) { return; }

  /* 1) WebSocket (va umuman /ws) — hech qachon keshlanmaydi, tegilmaydi */
  if (isWs(url)) return;

  /* 2) API — network-first, oflayn bo'lsa aniq JSON xato. Kesh YO'Q. */
  if (isApi(url)) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(function(){
        return new Response(
          JSON.stringify({ ok: false, offline: true, error: 'oflayn: server javob bermadi' }),
          { status: 503, statusText: 'Offline', headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
      })
    );
    return;
  }

  /* 3) static asset (ikonka / manifest) — cache-first */
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(req, { ignoreSearch: true }).then(function(hit){
        if (hit) return hit;
        return fetch(req).then(function(res){
          if (res && (res.ok || res.type === 'opaque')) {
            var copy = res.clone();
            caches.open(STATIC_CACHE).then(function(c){ c.put(req, copy).catch(function(){}); });
          }
          return res;
        });
      })
    );
    return;
  }

  /* 4) navigation (index.html) — NETWORK-FIRST (dev paytida eski fayl ko'rinmasin) */
  var isNav = req.mode === 'navigate' ||
              (req.headers.get('accept') || '').indexOf('text/html') !== -1;
  if (isNav) {
    event.respondWith(
      fetch(new Request(req.url, { cache: 'no-store', credentials: 'same-origin' })).then(function(res){
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(STATIC_CACHE).then(function(c){
            c.put('index.html', copy).catch(function(){});
          });
        }
        return res;
      }).catch(function(){
        return caches.match('index.html').then(function(hit){
          if (hit) return hit;
          return caches.match('./').then(function(h2){
            if (h2) return h2;
            return new Response(
              '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
              '<body style="margin:0;background:#000;color:#DBDBDB;font:14px system-ui;display:grid;place-items:center;height:100vh">' +
              '<div style="text-align:center"><b>XAUView — oflayn</b><br><span style="color:#8C8C8C">' +
              'Internet yo\u2019q va sahifa keshlanmagan.<br>Ulanishni tekshirib qayta urinib ko\u2019ring.</span></div></body>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        });
      })
    );
    return;
  }

  /* 5) qolgan hammasi — tarmoq, oflayn bo'lsa kesh */
  event.respondWith(
    fetch(req).catch(function(){
      return caches.match(req).then(function(hit){ return hit || Response.error(); });
    })
  );
});

/* ---------------- message ---------------- */
self.addEventListener('message', function(event){
  var data = event.data || {};
  if (data.type === 'SKIP_WAITING') { self.skipWaiting(); }
  if (data.type === 'GET_VERSION' && event.source) {
    try { event.source.postMessage({ type: 'VERSION', version: CACHE_VERSION }); } catch (e) {}
  }
});

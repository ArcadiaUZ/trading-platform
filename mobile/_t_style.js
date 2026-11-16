const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const OUT = 'D:/Project/AI/tvclone/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const NOISE = ['navigator.vibrate','AudioContext','favicon','Failed to load resource: net::ERR_CONNECTION','WebSocket','ws://','Manifest'];
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  const errs = [], res = [], netBad = [];
  const ok = (n, c, x) => res.push((c ? 'PASS' : 'FAIL') + ' ' + n + (x ? ' :: ' + x : ''));
  p.on('pageerror', e => errs.push(String(e).slice(0, 170)));
  p.on('console', m => { if (m.type() !== 'error') return; const t = m.text(); if (t.indexOf('Failed to load resource') >= 0) return; if (NOISE.some(s => t.indexOf(s) >= 0)) return; errs.push(t.slice(0, 170)); });
  p.on('response', r => { if (r.status() >= 400) netBad.push(r.status() + ' ' + r.url()); });
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await sleep(2600);
  await p.evaluate(() => { try { localStorage.removeItem('xauview.m.drawings.XAUUSD'); } catch (e) {} D.items = []; D.sel = null; saveDrawings(); mark(); });
  // (a) programmatic trendline
  const a = await p.evaluate(() => {
    var b = cur(), i0 = b.length - 40, i1 = b.length - 10;
    var it = { id: 't1', type: 'trendline', pts: [{ ts: b[i0][0], p: b[i0][4] }, { ts: b[i1][0], p: b[i1][4] }], color: '#2962FF', width: 1.6, style: 'solid', opacity: 1 };
    D.items.push(it); saveDrawings(); mark();
    return { n: D.items.length, id: D.items[0].id };
  });
  ok('(a) trendline drawn', a.n === 1 && a.id === 't1', JSON.stringify(a));
  // (b) open style sheet
  await p.evaluate(() => openStyleSheet('t1')); await sleep(430);
  const sh = await p.evaluate(() => ({
    title: document.getElementById('shTitle').textContent, on: document.getElementById('sheet').classList.contains('on'),
    colors: document.querySelectorAll('#shBody [data-color]').length, widths: document.querySelectorAll('#shBody [data-width]').length,
    styles: document.querySelectorAll('#shBody [data-style]').length, range: !!document.getElementById('dsOp'),
    del: !!document.getElementById('dsDel'), prev: !!document.getElementById('dsPrev')
  }));
  ok('(b) style sheet opens', sh.title === 'Chizma sozlamalari' && sh.on && sh.colors === 12 && sh.widths === 4 && sh.styles === 3 && sh.range && sh.del && sh.prev, JSON.stringify(sh));
  // (c) red + width 4 + dash + opacity 60
  await p.evaluate(() => { document.querySelector('#shBody [data-color="#F7525F"]').click(); }); await sleep(170);
  await p.evaluate(() => { document.querySelector('#shBody [data-width="4"]').click(); }); await sleep(170);
  await p.evaluate(() => { document.querySelector('#shBody [data-style="dash"]').click(); }); await sleep(170);
  await p.evaluate(() => { var r = document.getElementById('dsOp'); r.value = 60; r.dispatchEvent(new Event('input', { bubbles: true })); }); await sleep(220);
  // (d) assert live object + UI selection
  const d = await p.evaluate(() => {
    var it = D.items[0], on = document.querySelector('#shBody .ds-sw.on');
    return { color: it.color, width: it.width, style: it.style, opacity: it.opacity,
             open: document.getElementById('sheet').classList.contains('on'),
             selCol: on ? on.getAttribute('data-color') : null,
             widthsOn: document.querySelectorAll('#shBody [data-width].on').length };
  });
  ok('(d) live color/width/style/opacity', d.color === '#F7525F' && d.width === 4 && d.style === 'dash' && Math.abs(d.opacity - 0.6) < 0.001, JSON.stringify(d));
  ok('(d) sheet stays open + selection UI', d.open && d.selCol === '#F7525F' && d.widthsOn === 1, 'selCol=' + d.selCol + ' widthsOn=' + d.widthsOn);
  // (e) screenshot of the sheet
  await p.screenshot({ path: OUT + 's01-style-sheet.png' });
  await p.evaluate(() => document.getElementById('dsClose').click()); await sleep(300);
  // floating toolbar on tap
  const mid = await p.evaluate(() => {
    var it = D.items[0], r = document.getElementById('chart').getBoundingClientRect();
    return { x: r.left + (tsX(it.pts[0].ts) + tsX(it.pts[1].ts)) / 2, y: r.top + (pY(it.pts[0].p) + pY(it.pts[1].p)) / 2 };
  });
  const cdp = await p.createCDPSession();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mid.x, y: mid.y }] }); await sleep(60);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(420);
  const bar = await p.evaluate(() => {
    var d = document.getElementById('drawBar');
    return { exists: !!d, visible: !!d && d.style.display !== 'none', dots: d ? d.querySelectorAll('[data-act=color]').length : 0,
             gear: !!(d && d.querySelector('[data-act=gear]')), trash: !!(d && d.querySelector('[data-act=del]')) };
  });
  ok('floating toolbar on tap', bar.exists && bar.visible && bar.dots === 6 && bar.gear && bar.trash, JSON.stringify(bar));
  await p.screenshot({ path: OUT + 's02-floating-toolbar.png' });
  await p.evaluate(() => { document.querySelector('#drawBar [data-act=gear]').click(); }); await sleep(420);
  const t2 = await p.evaluate(() => document.getElementById('shTitle').textContent);
  ok('gear opens style sheet', t2 === 'Chizma sozlamalari', t2);
  await p.evaluate(() => document.getElementById('dsClose').click()); await sleep(250);
  // toolsSheet: 14 tools + per-row gear
  await p.evaluate(() => { document.querySelector('#bottom .tbtn[data-tool=more]').click(); }); await sleep(480);
  const ts = await p.evaluate(() => ({
    tools: document.querySelectorAll('#shBody [data-tool2]').length,
    gear: document.querySelectorAll('#shBody .gear[data-style]').length,
    hasBrush: !!document.querySelector('#shBody [data-tool2=brush]'), hasHl: !!document.querySelector('#shBody [data-tool2=highlighter]'),
    hasCh: !!document.querySelector('#shBody [data-tool2=channel]'), hasHray: !!document.querySelector('#shBody [data-tool2=hray]')
  }));
  ok('toolsSheet: 4 new tools + gear row', ts.tools === 14 && ts.gear === 1 && ts.hasBrush && ts.hasHl && ts.hasCh && ts.hasHray, JSON.stringify(ts));
  // highlighter widths 4/8/14/22
  await p.evaluate(() => {
    var b = cur();
    D.items.push({ id: 'h1', type: 'highlighter', pts: [{ ts: b[b.length-30][0], p: b[b.length-30][4] }, { ts: b[b.length-20][0], p: b[b.length-20][4] }], color: '#FFEB3B', width: 14, style: 'solid', opacity: 0.35 });
    saveDrawings(); openStyleSheet('h1');
  }); await sleep(380);
  const hw = await p.evaluate(() => ({ widths: Array.from(document.querySelectorAll('#shBody [data-width]')).map(x => +x.getAttribute('data-width')), range: !!document.getElementById('dsOp') }));
  ok('highlighter widths 4/8/14/22', JSON.stringify(hw.widths) === JSON.stringify([4, 8, 14, 22]) && hw.range, JSON.stringify(hw));
  await p.evaluate(() => document.getElementById('dsClose').click()); await sleep(200);
  // (f) persistence after reload
  await p.reload({ waitUntil: 'load' }); await sleep(2600);
  const per = await p.evaluate(() => {
    var raw = JSON.parse(localStorage.getItem('xauview.m.drawings.XAUUSD') || '[]'), it = raw[0];
    return { n: raw.length, color: it && it.color, width: it && it.width, style: it && it.style, opacity: it && it.opacity, items: D.items.length };
  });
  ok('(f) persisted after reload', per.n === 2 && per.color === '#F7525F' && per.width === 4 && per.style === 'dash' && Math.abs(per.opacity - 0.6) < 0.001, JSON.stringify(per));
  ok('0 JS errors', errs.length === 0, JSON.stringify(errs.slice(0, 5)));
  console.log(res.join('\n'));
  console.log('NET_4XX', JSON.stringify(netBad.slice(0, 4)));
  console.log('FAILED', res.filter(x => x.indexOf('FAIL') === 0).length);
  await b.close();
})().catch(e => { console.log('FAIL_EXC', String(e).slice(0, 400)); process.exit(1); });

const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const OUT = 'D:/Project/AI/tvclone/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  /* ---------- MOBILE ---------- */
  const p = await b.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,160)); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + String(e).slice(0,160)));
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load', timeout: 30000 });
  await sleep(2600);
  const cdp = await p.createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: pts || [] });
  const st = () => p.evaluate(() => ({ pan: !!window.__M.V.pan, off: +window.__M.V.rightOffset.toFixed(2), cross: window.__M.V.cross, lp: !!window.__M.V.longPress, spacing: +window.__M.V.spacing.toFixed(2) }));
  const base = await st();
  // 1) pan: drag left
  await touch('touchStart', [{ x: 300, y: 430 }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: 300 - i * 20, y: 430 }]); await sleep(16); }
  const panning = await st();
  await touch('touchEnd', []);
  await sleep(80);
  const afterPan = await st();
  console.log('PAN', JSON.stringify({ baseOff: base.off, during: panning.off, cross: panning.cross, after: afterPan.off, lp: afterPan.lp }));
  // 2) long press
  await touch('touchStart', [{ x: 196, y: 430 }]);
  await sleep(650);
  const lp1 = await st();
  await p.screenshot({ path: OUT + 'm62-loupe.png' });
  // 2b) drag while holding -> crosshair follows, no pan
  await touch('touchMove', [{ x: 240, y: 400 }]);
  await sleep(80);
  const lp2 = await p.evaluate(() => ({ lp: !!window.__M.V.longPress, cx: window.__M.V.cross ? Math.round(window.__M.V.cross.x) : null, off: +window.__M.V.rightOffset.toFixed(2) }));
  await touch('touchEnd', []);
  await sleep(80);
  const lp3 = await st();
  console.log('LONGPRESS', JSON.stringify({ held: lp1, dragged: lp2, released: { lp: lp3.lp, cross: !!lp3.cross } }));
  // 3) tap -> crosshair
  await touch('touchStart', [{ x: 150, y: 520 }]);
  await sleep(60);
  await touch('touchEnd', []);
  await sleep(120);
  console.log('TAP', JSON.stringify(await p.evaluate(() => ({ cross: !!window.__M.V.cross }))));
  console.log('MERRORS', JSON.stringify(errs.slice(0, 6)));
  await p.close();
  /* ---------- DESKTOP DEMO ---------- */
  const d = await b.newPage();
  const derrs = [];
  d.on('pageerror', e => derrs.push(String(e).slice(0,160)));
  await d.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await d.goto('file:///D:/Project/AI/tvclone/demo/xauview-demo.html', { waitUntil: 'load', timeout: 30000 });
  await sleep(1200);
  const dinfo = await d.evaluate(() => ({ cls: document.body.className, bg: getComputedStyle(document.body).backgroundColor, theme: window.__APP ? window.__APP.S.theme : null }));
  console.log('DESKTOP', JSON.stringify(dinfo), 'ERRS', JSON.stringify(derrs.slice(0,4)));
  await d.screenshot({ path: OUT + 'e23-black.png' });
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0, 400)); process.exit(1); });
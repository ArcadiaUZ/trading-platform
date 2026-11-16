const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const OUT = 'D:/Project/AI/tvclone/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await sleep(2800);
  const cdp = await p.createCDPSession();
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: pts || [] });
  async function drag(x0, y0, x1, y1) {
    await T('touchStart', [{ x: x0, y: y0 }]);
    for (let i = 1; i <= 6; i++) { await T('touchMove', [{ x: x0 + (x1 - x0) * i / 6, y: y0 + (y1 - y0) * i / 6 }]); await sleep(22); }
    await T('touchEnd', []); await sleep(160);
  }
  // GBPUSD H1 + fib + trendline
  await p.evaluate(() => { window.__M.setSym('GBPUSD'); window.__M.setTF('H1'); });
  await sleep(1800);
  await p.evaluate(() => window.__M.setTool('fib'));
  await drag(90, 250, 320, 470);
  await p.evaluate(() => window.__M.setTool('trendline'));
  await drag(60, 520, 300, 330);
  await p.evaluate(() => { window.__M.setTool('crosshair'); window.__M.V.dirty = true; });
  await sleep(400);
  await p.screenshot({ path: OUT + 'm71-hero-gbp-h1.png' });
  // landscape
  await p.evaluate(() => { window.__M.D.items = []; });
  await p.evaluate(() => { window.__M.setSym('XAUUSD'); window.__M.setTF('M15'); });
  await p.setViewport({ width: 873, height: 393, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await sleep(2200);
  await p.evaluate(() => window.__M.fit());
  await sleep(500);
  await p.screenshot({ path: OUT + 'm72-landscape-m15.png' });
  console.log('DONE');
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0, 300)); process.exit(1); });
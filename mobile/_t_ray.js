const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const OUT = 'D:/Project/AI/tvclone/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error' && m.text().indexOf('vibrate') < 0) errs.push(m.text().slice(0, 160)); });
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await sleep(2800);
  const cdp = await p.createCDPSession();
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: pts || [] });
  async function drag(x0, y0, x1, y1) {
    await T('touchStart', [{ x: x0, y: y0 }]);
    for (let i = 1; i <= 5; i++) { await T('touchMove', [{ x: x0 + (x1 - x0) * i / 5, y: y0 + (y1 - y0) * i / 5 }]); await sleep(22); }
    await T('touchEnd', []); await sleep(180);
  }
  await p.evaluate(() => window.__M.setTool('ray'));
  await drag(120, 560, 220, 480);
  await p.evaluate(() => window.__M.setTool('arrow'));
  await drag(250, 300, 340, 420);
  const items = await p.evaluate(() => window.__M.D.items.map(i => i.type));
  console.log('ITEMS', JSON.stringify(items));
  await p.evaluate(() => { window.__M.setTool('crosshair'); window.__M.V.dirty = true; });
  await sleep(350);
  await p.screenshot({ path: OUT + 'm79-ray-arrow.png' });
  // zone sheet with on_cross
  await p.evaluate(() => { window.__M.D.items = []; document.getElementById('alertBtn').click(); });
  await sleep(800);
  await p.evaluate(() => document.querySelector('#alType .chip[data-type=zone]').click());
  await sleep(350);
  const zone = await p.evaluate(() => ({ cross: !!document.getElementById('alCross'), repeat: !!document.getElementById('alRepeat'), chips: Array.from(document.querySelectorAll('#alTf .chip')).map(c => c.textContent) }));
  console.log('ZONE_SHEET', JSON.stringify(zone));
  await p.screenshot({ path: OUT + 'm80-zone-oncross.png' });
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0, 300)); process.exit(1); });
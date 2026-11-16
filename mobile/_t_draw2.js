const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const OUT = 'D:/Project/AI/tvclone/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0,200)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,200)); });
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await sleep(2500);
  const cdp = await p.createCDPSession();
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: pts || [] });
  async function drag(x0, y0, x1, y1) {
    await T('touchStart', [{ x: x0, y: y0 }]);
    for (let i = 1; i <= 5; i++) { await T('touchMove', [{ x: x0 + (x1 - x0) * i / 5, y: y0 + (y1 - y0) * i / 5 }]); await sleep(25); }
    await T('touchEnd', []);
    await sleep(220);
  }
  await p.evaluate(() => window.__M.setTool('fib'));
  await drag(120, 260, 300, 420);
  const afterFib = await p.evaluate(() => { const D = window.__M.D; return { n: D.items.length, types: D.items.map(i => i.type), tool: D.tool }; });
  console.log('FIB', JSON.stringify(afterFib));
  await p.screenshot({ path: OUT + 'm65-fib.png' });
  await p.evaluate(() => window.__M.setTool('measure'));
  await drag(140, 560, 330, 640);
  const afterM = await p.evaluate(() => { const D = window.__M.D; return { n: D.items.length, types: D.items.map(i => i.type) }; });
  console.log('MEASURE', JSON.stringify(afterM));
  await p.screenshot({ path: OUT + 'm66-measure.png' });
  // cleanup drawings
  await p.evaluate(() => { window.__M.D.items = []; try { localStorage.removeItem('xauview.m.drawings.' + window.__M.S.sym); } catch(e){} window.__M.V.dirty = true; });
  console.log('ERRORS', JSON.stringify(errs.slice(0,6)));
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0,300)); process.exit(1); });
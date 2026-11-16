const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const OUT = 'D:/Project/AI/tvclone/shots/';
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu','--force-device-scale-factor=3'] });
  const p = await b.newPage();
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,200)); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + String(e).slice(0,200)));
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  const info = await p.evaluate(() => {
    const q = s => document.querySelector(s);
    const tbtn = document.querySelectorAll('#bottom .tbtn');
    return {
      bottomIcons: q('#bottom') ? q('#bottom').querySelectorAll('svg.apkic').length : -1,
      bottomBtns: tbtn.length,
      topIcons: document.querySelectorAll('#top svg.apkic').length,
      bg: getComputedStyle(document.body).backgroundColor,
      panel: getComputedStyle(document.body).getPropertyValue('--panel').trim(),
      live: q('#live') ? q('#live').textContent : null,
      bars: (window.__M && window.__M.S) ? window.__M.S.tf : null,
      fillSample: tbtn.length ? getComputedStyle(tbtn[1].querySelector('svg')).fill : null,
      logo: !!window.APKICONS && Object.keys(window.APKICONS).length
    };
  });
  console.log('INFO', JSON.stringify(info));
  await p.screenshot({ path: OUT + 'm60-icons.png' });
  // long press via CDP touch
  const cdp = await p.createCDPSession();
  const X = 196, Y = 430;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: X, y: Y }] });
  await new Promise(r => setTimeout(r, 700));
  const lp = await p.evaluate(() => { const V = window.__M.V; return { lp: !!V.longPress, cross: V.cross ? { x: Math.round(V.cross.x), y: Math.round(V.cross.y) } : null }; });
  console.log('LONGPRESS', JSON.stringify(lp));
  await p.screenshot({ path: OUT + 'm61-loupe.png' });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await new Promise(r => setTimeout(r, 200));
  const after = await p.evaluate(() => ({ lp: !!window.__M.V.longPress, cross: !!window.__M.V.cross }));
  console.log('AFTER', JSON.stringify(after));
  console.log('ERRORS', JSON.stringify(errs.slice(0, 8)));
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0, 400)); process.exit(1); });
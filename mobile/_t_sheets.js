const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const OUT = 'D:/Project/AI/tvclone/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0,160)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,160)); });
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await sleep(2200);
  // open tools sheet via 'more' bottom button
  await p.evaluate(() => { document.querySelector('#bottom .tbtn[data-tool=more]').click(); });
  await sleep(450);
  await p.screenshot({ path: OUT + 'm63-tools-sheet.png' });
  const sh = await p.evaluate(() => { const s = document.getElementById('sheet'); return { on: s.classList.contains('on'), icons: s.querySelectorAll('svg.apkic').length, computed: getComputedStyle(s.querySelector('svg.apkic')).fill }; });
  console.log('TOOLS_SHEET', JSON.stringify(sh));
  await p.evaluate(() => document.getElementById('shClose').click());
  await sleep(250);
  // menu sheet (notify btn)
  await p.evaluate(() => document.getElementById('menuBtn').click());
  await sleep(400);
  await p.screenshot({ path: OUT + 'm64-menu-sheet.png' });
  const pwa = await p.evaluate(() => ({ pwa: typeof window.__PWA, secure: window.isSecureContext, sw: 'serviceWorker' in navigator }));
  console.log('PWA_STATE', JSON.stringify(pwa));
  console.log('ERRORS', JSON.stringify(errs.slice(0,6)));
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0,300)); process.exit(1); });
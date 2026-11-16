
const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 160)));
  await p.goto('file:///D:/Project/AI/tvclone/mobile/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 13000));
  const st = await p.evaluate(() => {
    const txt = (s) => { const e = document.querySelector(s); return e ? e.textContent.trim().slice(0, 40) : null; };
    const bars = window.V && window.V.bars ? window.V.bars : [];
    return {
      proto: location.protocol,
      defaultFeed: typeof DEFAULT_FEED === 'undefined' ? null : DEFAULT_FEED,
      feedBase: typeof feedBase === 'function' ? feedBase() : null,
      bars: bars.length,
      last: bars.length ? bars[bars.length - 1] : null,
      prov: txt('#provChip'), live: txt('#live'),
      header: (document.querySelector('.sym, #sym, header') || {}).textContent,
      errs: window.__err ? window.__err : null
    };
  });
  await p.screenshot({ path: 'D:/Project/AI/tvclone/shots/r21-apk-default.png' });
  console.log(JSON.stringify({ st, errs: errs.slice(0, 5) }, null, 1));
  await b.close();
})().catch(e => { console.log('FAIL ' + String(e).slice(0, 300)); process.exit(1); });

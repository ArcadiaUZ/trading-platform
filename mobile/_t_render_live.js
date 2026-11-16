
const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const p = await b.newPage();
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,160)); });
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0,160)));
  await p.goto('https://xauview.onrender.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await new Promise(r => setTimeout(r, 12000));
  const st = await p.evaluate(() => {
    const txt = (sel) => { const e = document.querySelector(sel); return e ? e.textContent.trim().slice(0,60) : null; };
    const ids = Array.from(document.querySelectorAll('[id]')).map(e => e.id).filter(x => /live|price|srv|prov|badge|status/i.test(x));
    return {
      title: document.title,
      canvases: document.querySelectorAll('canvas').length,
      ids,
      liveTag: txt('#liveTag'), provChip: txt('#provChip'),
      bars: window.V && window.V.bars ? window.V.bars.length : (typeof nB === 'function' ? nB() : null),
      lastBar: window.V && window.V.bars && window.V.bars.length ? window.V.bars[window.V.bars.length-1] : null,
      bodyText: (document.body.innerText || '').replace(/\s+/g,' ').slice(0, 300)
    };
  });
  await p.screenshot({ path: 'D:/Project/AI/tvclone/shots/r20-render-live.png' });
  console.log(JSON.stringify({ st, errs: errs.slice(0,6) }, null, 1));
  await b.close();
})().catch(e => { console.log('FAIL ' + String(e).slice(0, 300)); process.exit(1); });

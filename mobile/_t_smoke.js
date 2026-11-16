const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  for (const url of ['http://127.0.0.1:8765/', 'https://picture-shoulder-notifications-atlas.trycloudflare.com/']) {
    const p = await b.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e).slice(0, 150)));
    p.on('console', m => { if (m.type() === 'error' && m.text().indexOf('navigator.vibrate') < 0) errs.push(m.text().slice(0, 150)); });
    await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    try {
      await p.goto(url, { waitUntil: 'load', timeout: 45000 });
    } catch (e) { console.log('LOAD_FAIL', url, String(e).slice(0, 100)); await p.close(); continue; }
    await sleep(3200);
    const info = await p.evaluate(() => ({
      secure: window.isSecureContext,
      live: document.getElementById('live').textContent,
      icons: document.querySelectorAll('svg.apkic').length,
      hasM7: typeof window.renderAlerts === 'function' && typeof window.onAlert === 'function',
      pwa: typeof window.__PWA,
      sw: navigator.serviceWorker ? navigator.serviceWorker.getRegistrations ? 'api' : 'no' : 'no',
      tfs: window.__M.S.tf, sym: window.__M.S.sym
    }));
    const regs = await p.evaluate(async () => { try { const r = await navigator.serviceWorker.getRegistrations(); return r.length; } catch (e) { return -1; } });
    console.log('PAGE', url.slice(0, 46), JSON.stringify(info), 'swRegs=' + regs, 'errs=' + JSON.stringify(errs.slice(0, 3)));
    await p.close();
  }
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0, 300)); process.exit(1); });
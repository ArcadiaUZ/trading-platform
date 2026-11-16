const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  p.on('console', m => { if (m.type() === 'error') console.log('JSERR', m.text().slice(0, 150)); });
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await sleep(2500);
  await p.evaluate(() => { window.__M.setSym('GBPUSD'); window.__M.setTF('H1'); });
  for (let i = 0; i < 10; i++) {
    await sleep(300);
    const s = await p.evaluate(() => ({ live: document.getElementById('live').textContent, rs: window.__M.FEED.ws ? window.__M.FEED.ws.readyState : -1, gen: window.__M.FEED.gen, retry: window.__M.FEED.retry, n: window.__M.ASSETS.GBPUSD.tfs.H1.length, cross: !!window.__M.V.cross }));
    console.log((i * 300 + 300) + 'ms', JSON.stringify(s));
  }
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0, 300)); process.exit(1); });
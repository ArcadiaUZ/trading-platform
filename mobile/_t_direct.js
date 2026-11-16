const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0,160)));
  p.on('console', m => { if (m.type() === 'error' && !/vibrate|AudioContext|favicon|net::ERR_CONNECTION/.test(m.text())) errs.push(m.text().slice(0,160)); });
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8899/index.html', { waitUntil: 'load' });
  await p.evaluate(() => localStorage.setItem('xauview.direct', '1'));
  await p.reload({ waitUntil: 'load' });
  await sleep(7000);
  const st = await p.evaluate(() => ({
    direct: DIRECT.on, ratio: +DIRECT.ratio.toFixed(5), src: DIRECT.src,
    bars: nB(), last: cur().length ? cur()[cur().length-1].slice(0,5) : null,
    live: (document.getElementById('live')||{}).textContent,
    chip: (document.getElementById('provChip')||{}).textContent,
    wsClosed: FEED.closed
  }));
  console.log('STATE', JSON.stringify(st));
  await p.screenshot({ path: 'D:/Project/AI/tvclone/shots/m83-direct-xau.png' });
  // TF switch -> auto reload
  await p.evaluate(() => setTF('M15'));
  await sleep(5000);
  const st2 = await p.evaluate(() => ({ tf: S.tf, bars: nB(), last: cur()[cur().length-1].slice(0,5), live: (document.getElementById('live')||{}).textContent }));
  console.log('M15', JSON.stringify(st2));
  // GBP direct without key
  await p.evaluate(() => setSym('GBPUSD'));
  await sleep(4000);
  const st3 = await p.evaluate(() => ({ sym: S.sym, bars: nB(), live: (document.getElementById('live')||{}).textContent }));
  console.log('GBP', JSON.stringify(st3));
  await p.evaluate(() => setSym('XAUUSD'));
  await sleep(4000);
  console.log('ERRORS', JSON.stringify(errs.slice(0,5)));
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0,400)); process.exit(1); });

const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await sleep(3200);
  const cdp = await p.target().createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts }).catch(()=>{});
  // instrument
  await p.evaluate(() => {
    window.__log = [];
    V.autoPrice = false;
    var origFit = window.fit; window.fit = function(){ window.__log.push('fit'); return origFit.apply(null, arguments); };
    var origSS = window.setSpacing; window.setSpacing = function(){ window.__log.push('setSpacing'); return origSS.apply(null, arguments); };
    window.__rng = () => [ +V.priceMin.toFixed(2), +V.priceMax.toFixed(2), V.autoPrice ];
    window.__snap = () => window.__log.push('SNAP-RANGE ' + V.priceMin.toFixed(2) + '/' + V.priceMax.toFixed(2) + ' auto=' + V.autoPrice);
  });
  console.log('before', JSON.stringify(await p.evaluate(() => __rng())));
  await touch('touchStart', [{ x: 200, y: 380, id: 1 }, { x: 260, y: 380, id: 2 }]);
  for (let i = 1; i <= 4; i++) {
    await touch('touchMove', [{ x: 200 - i * 8, y: 380, id: 1 }, { x: 260 + i * 8, y: 380, id: 2 }]);
    await p.evaluate(() => __snap());
    await sleep(20);
  }
  await touch('touchEnd', []);
  await sleep(300);
  console.log('after', JSON.stringify(await p.evaluate(() => __rng())));
  console.log('log', JSON.stringify(await p.evaluate(() => window.__log)));
  // fling diagnostic
  await p.evaluate(() => { V.autoPrice = true; V.rightOffset = -60; clampOffset(); mark(); });
  console.log('off0', await p.evaluate(() => [V.rightOffset, V.spacing, nB()]));
  await touch('touchStart', [{ x: 300, y: 500, id: 1 }]);
  for (let i = 1; i <= 4; i++) { await touch('touchMove', [{ x: 300 - i * 45, y: 500, id: 1 }]); await sleep(16); }
  await touch('touchEnd', []);
  const seq = [];
  for (let i = 0; i < 6; i++) { seq.push(await p.evaluate(() => +V.rightOffset.toFixed(2))); await sleep(90); }
  console.log('offseq', JSON.stringify(seq), 'stats', JSON.stringify(await p.evaluate(() => GEST.stats)));
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0,300)); process.exit(1); });

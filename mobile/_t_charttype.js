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
  const types = ['candles','hollow','bars','line','area'];
  for (const t of types) {
    await p.evaluate(x => window.setChartType(x), t);
    await sleep(450);
    await p.screenshot({ path: OUT + 'm7' + (types.indexOf(t)) + '-type-' + t + '.png' });
    const st = await p.evaluate(() => ({ ct: window.__M.S.chartType, ls: localStorage.getItem('xauview.m.chart') }));
    console.log('TYPE', t, JSON.stringify(st));
  }
  // menu row + chart sheet
  await p.evaluate(() => window.setChartType('candles'));
  await p.evaluate(() => document.getElementById('menuBtn').click());
  await sleep(450);
  const menu = await p.evaluate(() => ({ row: !!document.getElementById('mChartType'), val: (document.getElementById('mChartVal')||{}).textContent, drawRow: !!document.getElementById('mDrawList') }));
  console.log('MENU', JSON.stringify(menu));
  await p.evaluate(() => document.getElementById('mChartType').click());
  await sleep(550);
  const sheet = await p.evaluate(() => ({ title: document.getElementById('shTitle').textContent, opts: Array.from(document.querySelectorAll('#shBody [data-ct]')).map(o => o.textContent.trim()), icons: document.querySelectorAll('#shBody svg.apkic').length }));
  console.log('SHEET', JSON.stringify(sheet));
  await p.screenshot({ path: OUT + 'm78-chart-sheet.png' });
  // persistence across reload
  await p.evaluate(() => { document.getElementById('shClose').click(); });
  await sleep(200);
  await p.evaluate(() => window.setChartType('area'));
  await sleep(300);
  await p.reload({ waitUntil: 'load' });
  await sleep(2200);
  const persist = await p.evaluate(() => ({ ct: window.__M.S.chartType }));
  console.log('PERSIST', JSON.stringify(persist));
  await p.evaluate(() => window.setChartType('candles'));
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0, 300)); process.exit(1); });
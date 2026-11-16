
const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 160)));
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(6000);
  await p.evaluate(() => { var x = document.getElementById('menuBtn'); if (x) x.click(); });
  await sleep(600);
  const row = await p.evaluate(() => { var r = document.getElementById('mTrade'); return r ? r.textContent.replace(/\s+/g, ' ').trim() : null; });
  await p.evaluate(() => { var r = document.getElementById('mTrade'); if (r) r.click(); });
  await sleep(3500);
  const sheet = await p.evaluate(() => ({
    badge: (document.getElementById('trBadge') || {}).textContent,
    acct: (document.getElementById('trAcct') || {}).textContent,
    bal: (document.getElementById('trBal') || {}).textContent,
    eq: (document.getElementById('trEq') || {}).textContent,
    buy: (document.getElementById('trBuy') || {}).textContent,
    sell: (document.getElementById('trSell') || {}).textContent,
    margin: (document.getElementById('trMargin') || {}).textContent
  }));
  console.log('MENU', row);
  console.log('SHEET', JSON.stringify(sheet));
  await p.screenshot({ path: 'D:/Project/AI/tvclone/shots/r35-trade-live-mt5.png' });
  // dry-run check only (NO real order!)
  await p.evaluate(() => { document.getElementById('trBuy').click(); });
  await sleep(900);
  await p.evaluate(() => { var c = document.getElementById('trCheck'); if (c) c.click(); });
  await sleep(2500);
  const res = await p.evaluate(() => ({
    res: (document.getElementById('trRes') || {}).textContent,
    quote: (document.getElementById('trQuote') || {}).textContent
  }));
  console.log('DRYRUN UI', JSON.stringify(res));
  await p.screenshot({ path: 'D:/Project/AI/tvclone/shots/r36-trade-dryrun.png' });
  console.log('ERRS', JSON.stringify(errs.slice(0, 4)));
  await b.close();
})().catch(e => { console.log('FAIL ' + String(e).slice(0, 300)); process.exit(1); });

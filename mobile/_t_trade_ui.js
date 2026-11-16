
const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const S = (x) => String(x == null ? '' : x);
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 200)));
  await p.goto('file:///D:/Project/AI/tvclone/mobile/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  const menuInfo = await p.evaluate(() => {
    var b = document.getElementById('menuBtn'); if (b) b.click();
    return true;
  });
  await new Promise(r => setTimeout(r, 600));
  const m2 = await p.evaluate(() => {
    var row = document.getElementById('mTrade');
    return { hasRow: !!row, text: row ? row.textContent.replace(/\s+/g, ' ').trim() : null };
  });
  await p.evaluate(() => { var row = document.getElementById('mTrade'); if (row) row.click(); });
  await new Promise(r => setTimeout(r, 2600));
  const sheetInfo = await p.evaluate(() => ({
    title: (document.getElementById('shTitle') || {}).textContent,
    badge: (document.getElementById('trBadge') || {}).textContent,
    hasSell: !!document.getElementById('trSell'),
    hasBuy: !!document.getElementById('trBuy'),
    acct: (document.getElementById('trAcct') || {}).textContent,
    bal: (document.getElementById('trBal') || {}).textContent,
    list: (document.getElementById('trList') || {}).textContent
  }));
  await p.screenshot({ path: 'D:/Project/AI/tvclone/shots/r30-trade-ui.png' });
  await p.evaluate(() => { var b = document.getElementById('trBuy'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 900));
  const ticketInfo = await p.evaluate(() => ({
    title: (document.getElementById('shTitle') || {}).textContent,
    vol: (document.getElementById('trVol') || {}).value,
    hasPrice: !!document.getElementById('trPrice'),
    hasSl: !!document.getElementById('trSl'),
    hasTp: !!document.getElementById('trTp'),
    send: !!document.getElementById('trSend'),
    quote: (document.getElementById('trQuote') || {}).textContent
  }));
  await p.screenshot({ path: 'D:/Project/AI/tvclone/shots/r31-trade-ticket.png' });
  console.log(JSON.stringify({ menu: m2, sheetInfo: { ...sheetInfo, list: String(sheetInfo.list).slice(0, 100) }, ticketInfo: { ...ticketInfo, title: String(ticketInfo.title), quote: String(ticketInfo.quote) }, errs: errs.slice(0, 6) }, null, 1));
  await b.close();
})().catch(e => { console.log('FAIL ' + String(e).slice(0, 400)); process.exit(1); });


const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const { spawn } = require('child_process');
const PORT = 8767, BASE = 'http://127.0.0.1:' + PORT;
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitHealth(n) {
  for (let i = 0; i < n; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return true; } catch (e) {}
    await sleep(1000);
  }
  return false;
}
(async () => {
  const env = Object.assign({}, process.env, { XAUVIEW_TRADE_MOCK: '1', XAUVIEW_DATA: 'open', PORT: String(PORT) });
  const srv = spawn('D:\\Project\\AI\\Trading-with-ai\\.venv\\Scripts\\python.exe', ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', String(PORT)], { cwd: 'D:\\Project\\AI\\tvclone\\server', env, stdio: ['ignore', 'pipe', 'pipe'] });
  let srvLog = '';
  srv.stdout.on('data', d => srvLog += d.toString());
  srv.stderr.on('data', d => srvLog += d.toString());
  try {
    if (!(await waitHealth(40))) { log('SERVER FAIL', srvLog.slice(-1500)); return; }
    const st = await (await fetch(BASE + '/api/trade/state')).json();
    log('STATE mode=', st.mode, 'balance=', st.account && st.account.balance, 'symbols=', Object.keys(st.symbols || {}).join(','));
    const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
    const p = await b.newPage();
    await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errs = [];
    p.on('pageerror', e => errs.push('PAGEERR ' + String(e).slice(0, 160)));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    await p.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(5000);
    // open menu -> trade
    await p.evaluate(() => { var x = document.getElementById('menuBtn'); if (x) x.click(); });
    await sleep(500);
    const row = await p.evaluate(() => { var r = document.getElementById('mTrade'); return r ? r.textContent.replace(/\s+/g, ' ').trim() : null; });
    log('MENU row:', row);
    await p.evaluate(() => { var r = document.getElementById('mTrade'); if (r) r.click(); });
    await sleep(3500);
    const sheet = await p.evaluate(() => ({
      badge: (document.getElementById('trBadge') || {}).textContent,
      acct: (document.getElementById('trAcct') || {}).textContent,
      bal: (document.getElementById('trBal') || {}).textContent,
      eq: (document.getElementById('trEq') || {}).textContent,
      buy: (document.getElementById('trBuy') || {}).textContent,
      list: (document.getElementById('trList') || {}).textContent
    }));
    log('SHEET', JSON.stringify(sheet));
    await p.screenshot({ path: 'D:/Project/AI/tvclone/shots/r32-trade-live.png' });
    // place market buy 0.10
    await p.evaluate(() => { document.getElementById('trBuy').click(); });
    await sleep(900);
    await p.evaluate(() => {
      var v = document.getElementById('trVol'); if (v) { v.value = '0.10'; v.dispatchEvent(new Event('input')); }
      var s = document.getElementById('trSend'); if (s) s.click();
    });
    await sleep(3000);
    const afterOrder = await (await fetch(BASE + '/api/trade/state')).json();
    log('AFTER ORDER positions=', (afterOrder.positions || []).length, JSON.stringify((afterOrder.positions || [])[0] || {}).slice(0, 200));
    const ui = await p.evaluate(() => ({
      title: (document.getElementById('shTitle') || {}).textContent,
      list: (document.getElementById('trList') || {}).textContent
    }));
    log('UI', JSON.stringify(ui).slice(0, 400));
    await p.screenshot({ path: 'D:/Project/AI/tvclone/shots/r33-trade-position.png' });
    // close it through API-backed UI: open close sheet
    const ticket = ((afterOrder.positions || [])[0] || {}).ticket;
    if (ticket) {
      await p.evaluate((t) => { var b = document.querySelector('[data-trclose="' + t + '"]'); if (b) b.click(); }, String(ticket));
      await sleep(1200);
      const closeTitle = await p.evaluate(() => (document.getElementById('shTitle') || {}).textContent);
      log('CLOSE SHEET', closeTitle);
      await p.evaluate(() => { var b = document.getElementById('trCFull'); if (b) b.click(); });
      await sleep(2500);
      const flat = await (await fetch(BASE + '/api/trade/state')).json();
      log('AFTER CLOSE positions=', (flat.positions || []).length);
      await p.screenshot({ path: 'D:/Project/AI/tvclone/shots/r34-trade-closed.png' });
    }
    log('ERRS', JSON.stringify(errs.slice(0, 6)));
    await b.close();
  } finally {
    try { srv.kill(); } catch (e) {}
    await sleep(500);
    log('server tail:', srvLog.slice(-400).replace(/\n/g, ' | '));
  }
})().catch(e => { console.log('FAIL', String(e).slice(0, 400)); process.exit(1); });

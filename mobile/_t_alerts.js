const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const OUT = 'D:/Project/AI/tvclone/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  const errs = [];
  const posts = [];
  p.on('pageerror', e => errs.push(String(e).slice(0,180)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0,180)); });
  p.on('response', async r => { if (r.url().indexOf('/api/alerts') >= 0 && r.request().method() === 'POST') posts.push(r.status()); });
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await sleep(2600);
  await p.evaluate(() => document.getElementById('alertBtn').click());
  await sleep(700);
  const t0 = await p.evaluate(() => ({ title: document.getElementById('shTitle').textContent, chips: Array.from(document.querySelectorAll('#alType .chip')).map(c => c.textContent), rows: document.querySelectorAll('.alertrow').length }));
  console.log('ALERT_SHEET', JSON.stringify(t0));
  await p.screenshot({ path: OUT + 'm67-alert-price.png' });
  // zone tab
  await p.evaluate(() => document.querySelector('#alType .chip[data-type=zone]').click());
  await sleep(300);
  const t1 = await p.evaluate(() => ({ hasLo: !!document.querySelector('#alLo'), hasTf: !!document.querySelector('#alTf'), hasRepeat: !!document.querySelector('#alRepeat') }));
  console.log('ZONE_TAB', JSON.stringify(t1));
  await p.screenshot({ path: OUT + 'm68-alert-zone.png' });
  // add zone alert
  await p.evaluate(() => document.getElementById('alAdd').click());
  await sleep(900);
  const t2 = await p.evaluate(() => ({ rows: document.querySelectorAll('.alertrow').length, rowsText: Array.from(document.querySelectorAll('.alertrow')).map(r => r.textContent.replace(/\s+/g,' ').slice(0,90)) }));
  console.log('AFTER_ZONE_ADD', JSON.stringify(t2), 'posts', JSON.stringify(posts));
  // sweep tab + add
  await p.evaluate(() => document.querySelector('#alType .chip[data-type=sweep]').click());
  await sleep(250);
  await p.screenshot({ path: OUT + 'm69-alert-sweep.png' });
  await p.evaluate(() => document.getElementById('alAdd').click());
  await sleep(900);
  // session tab + add
  await p.evaluate(() => document.querySelector('#alType .chip[data-type=session]').click());
  await sleep(250);
  await p.evaluate(() => document.getElementById('alAdd').click());
  await sleep(900);
  const t3 = await p.evaluate(() => ({ rows: Array.from(document.querySelectorAll('.alertrow')).map(r => r.textContent.replace(/\s+/g,' ').slice(0,100)) }));
  console.log('ALL_ROWS', JSON.stringify(t3), 'posts', JSON.stringify(posts));
  await p.screenshot({ path: OUT + 'm70-alert-list.png' });
  // cleanup: delete all created via API
  const ids = await p.evaluate(async () => { const r = await fetch('/api/alerts'); const j = await r.json(); return (j.alerts || []).map(a => a.id); });
  for (const id of ids) { await p.evaluate(i => fetch('/api/alerts/' + i, { method: 'DELETE' }), id); }
  console.log('CLEANED', JSON.stringify(ids));
  console.log('ERRORS', JSON.stringify(errs.slice(0, 6)));
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0, 400)); process.exit(1); });
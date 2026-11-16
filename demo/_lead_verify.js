const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await p.goto('file:///D:/Project/AI/tvclone/demo/xauview-demo.html', { waitUntil: 'load' });
  await sleep(1500);
  const st = await p.evaluate(() => ({
    theme: window.__APP.S.theme,
    cls: document.body.className,
    bg: getComputedStyle(document.body).backgroundColor,
    tf: window.__APP.S.tf,
    sym: window.__APP.S.sym,
    icons: document.querySelectorAll('.rail svg, #rail svg, svg.apkic').length,
    tools: Array.from(document.querySelectorAll('[data-tool]')).map(x => x.dataset.tool).slice(0, 30)
  }));
  console.log('DESKTOP', JSON.stringify(st));
  // draw fib via API-level: set tool then simulate two clicks
  await p.evaluate(() => window.__APP.setTool('fib'));
  const box = await p.evaluate(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.mouse.move(box.x + 300, box.y + 250); await p.mouse.down(); await p.mouse.move(box.x + 450, box.y + 450, { steps: 6 }); await p.mouse.up();
  await sleep(400);
  const items = await p.evaluate(() => (window.__APP.D.items || []).map(i => i.type));
  console.log('ITEMS', JSON.stringify(items));
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0, 300)); process.exit(1); });
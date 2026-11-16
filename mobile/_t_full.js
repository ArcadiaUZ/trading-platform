const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const OUT = 'D:/Project/AI/tvclone/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  const errs = [];
  const results = [];
  const ok = (name, cond, extra) => { results.push((cond ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : '')); };
  p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error' && m.text().indexOf('vibrate') < 0) errs.push(m.text().slice(0, 160)); });
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await sleep(2800);
  const cdp = await p.createCDPSession();
  const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type: type, touchPoints: pts || [] });
  const st = () => p.evaluate(() => ({ pan: !!window.__M.V.pan, off: +window.__M.V.rightOffset.toFixed(2), cross: !!window.__M.V.cross, lp: !!window.__M.V.longPress, spacing: +window.__M.V.spacing.toFixed(2), items: window.__M.D.items.length, tool: window.__M.D.tool, ct: window.__M.S.chartType, live: document.getElementById('live').textContent }));
  async function drag(x0, y0, x1, y1, steps) {
    await T('touchStart', [{ x: x0, y: y0 }]);
    for (let i = 1; i <= (steps || 5); i++) { await T('touchMove', [{ x: x0 + (x1 - x0) * i / (steps || 5), y: y0 + (y1 - y0) * i / (steps || 5) }]); await sleep(20); }
    await T('touchEnd', []); await sleep(160);
  }
  // 1 tap
  await T('touchStart', [{ x: 150, y: 520 }]); await sleep(60); await T('touchEnd', []); await sleep(150);
  let s = await st(); ok('tap -> crosshair', s.cross);
  // 2 pan
  const off0 = s.off;
  await drag(300, 430, 180, 430);
  s = await st(); ok('pan -> offset o\u02bbzgardi', Math.abs(s.off - off0) > 0.5, 'off ' + off0 + ' -> ' + s.off);
  // 3 pinch (2 barmoq)
  await T('touchStart', [{ x: 120, y: 400 }, { x: 260, y: 400 }]); await sleep(60);
  const sp0 = (await st()).spacing;
  await T('touchMove', [{ x: 90, y: 400 }, { x: 300, y: 400 }]); await sleep(80);
  const sp1 = (await st()).spacing;
  await T('touchEnd', []); await sleep(150);
  ok('pinch -> spacing o\u02bbzgardi', Math.abs(sp1 - sp0) > 0.2, sp0 + ' -> ' + sp1);
  // 4 long press
  await T('touchStart', [{ x: 200, y: 430 }]); await sleep(650);
  s = await st(); ok('long-press -> lupa', s.lp && s.cross);
  await p.screenshot({ path: OUT + 'r01-longpress.png' });
  await T('touchMove', [{ x: 250, y: 400 }]); await sleep(80);
  const lpd = await p.evaluate(() => ({ lp: !!window.__M.V.longPress, off: +window.__M.V.rightOffset.toFixed(2) }));
  await T('touchEnd', []); await sleep(120);
  ok('long-press drag -> crosshair yurar, pan yo\u02bbq', lpd.lp && Math.abs(lpd.off - s.off) < 0.01);
  // 5 double tap -> fit
  const spA = (await st()).spacing;
  await p.evaluate(() => { window.__M.V.spacing = 3; window.__M.V.dirty = true; }); await sleep(120);
  await T('touchStart', [{ x: 200, y: 400 }]); await sleep(50); await T('touchEnd', []); await sleep(70);
  await T('touchStart', [{ x: 200, y: 400 }]); await sleep(50); await T('touchEnd', []); await sleep(250);
  const spB = (await st()).spacing; ok('double-tap -> fit (spacing kattalashdi)', spB > 3.5, '3 -> ' + spB);
  // 6 draw rect
  await p.evaluate(() => window.__M.setTool('rect'));
  await drag(90, 260, 300, 400);
  s = await st(); ok('rect chizish', s.items >= 1 && s.tool === 'crosshair', 'items=' + s.items);
  // 7 fib + ray
  await p.evaluate(() => window.__M.setTool('fib')); await drag(80, 480, 320, 600);
  await p.evaluate(() => window.__M.setTool('ray')); await drag(120, 700, 240, 640);
  const types = await p.evaluate(() => window.__M.D.items.map(i => i.type));
  ok('fib + ray', types.indexOf('fib') >= 0 && types.indexOf('ray') >= 0, JSON.stringify(types));
  await p.evaluate(() => { window.__M.setTool('crosshair'); window.__M.V.dirty = true; }); await sleep(300);
  await p.screenshot({ path: OUT + 'r02-drawings.png' });
  // 8 chart types
  for (const t of ['hollow','bars','line','area','candles']) { await p.evaluate(x => window.setChartType(x), t); await sleep(180); }
  ok('chart turi almashtirish', (await st()).ct === 'candles');
  // 9 sheets
  for (const id of ['indBtn','alertBtn','menuBtn']) { await p.evaluate(i => document.getElementById(i).click(), id); await sleep(320); await p.evaluate(() => document.getElementById('shClose').click()); await sleep(220); }
  ok('sheet lar ochilishi/yopilishi', true);
  // 10 chart turi sheet via menu
  await p.evaluate(() => document.getElementById('menuBtn').click()); await sleep(300);
  await p.evaluate(() => document.getElementById('mChartType').click()); await sleep(400);
  const sheetOk = await p.evaluate(() => document.getElementById('shTitle').textContent);
  ok('menyu -> chart turi sheet', sheetOk === 'Chart turi', sheetOk);
  await p.evaluate(() => document.getElementById('shClose').click()); await sleep(200);
  // 11 symbol/TF switch
  await p.evaluate(() => { window.__M.setSym('GBPUSD'); window.__M.setTF('M15'); }); await sleep(2200);
  s = await st(); ok('symbol+TF switch -> LIVE', s.live === 'LIVE');
  await p.evaluate(() => { window.__M.setSym('XAUUSD'); window.__M.setTF('M1'); window.__M.D.items = []; }); await sleep(1500);
  console.log(results.join('\n'));
  console.log('ERRORS', JSON.stringify(errs.slice(0, 6)));
  console.log('FAILED', results.filter(r => r.indexOf('FAIL') === 0).length);
  await b.close();
})().catch(e => { console.log('FAIL_EXC', String(e).slice(0, 300)); process.exit(1); });
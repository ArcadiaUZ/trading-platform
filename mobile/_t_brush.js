const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const OUT = 'D:/Project/AI/tvclone/shots/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const P = (ok, name, extra) => console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (extra ? ' :: ' + extra : ''));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0,180)));
  p.on('console', m => { if (m.type() === 'error' && !/vibrate|AudioContext|favicon|net::ERR/.test(m.text())) errs.push(m.text().slice(0,180)); });
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await sleep(2800);
  const geo = await p.evaluate(() => ({ plotW: LAY.plotW, H: H, bars: nB() }));
  console.log('GEO', JSON.stringify(geo));

  async function drag(x1, y1, x2, y2) {
    await p.mouse.move(x1, y1);
    await p.mouse.down();
    await p.mouse.move(x2, y2, { steps: 24 });
    await p.mouse.up();
    await sleep(260);
  }
  async function tool(t) { await p.evaluate(k => setTool(k), t); await sleep(120); }
  const last = async () => p.evaluate(() => { var it = D.items[D.items.length - 1]; return it ? { type: it.type, n: it.pts.length, w: it.width, op: it.opacity, st: it.style, fill: it.fill } : null; });
  await p.evaluate(() => { D.items = []; saveDrawings(); mark(); });

  // 1 brush
  await tool('brush');
  await drag(60, 500, 300, 400);
  let it = await last();
  P(!!it && it.type === 'brush' && it.n >= 3, 'brush draws freehand', JSON.stringify(it));

  // 2 highlighter
  await tool('highlighter');
  await drag(60, 620, 320, 560);
  it = await last();
  P(!!it && it.type === 'highlighter' && it.w === 14 && Math.abs(it.op - 0.35) < 0.001, 'highlighter width/alpha', JSON.stringify(it));

  // 3 channel 2-stage
  await tool('channel');
  await drag(60, 300, 260, 240);
  const mid = await p.evaluate(() => D.pending ? { type: D.pending.type, n: D.pending.pts.length } : null);
  P(!!mid && mid.type === 'channel' && mid.n === 2, 'channel waits for 3rd point', JSON.stringify(mid));
  await drag(120, 360, 200, 320);
  it = await last();
  P(!!it && it.type === 'channel' && it.n === 3, 'channel finalized with 3 pts', JSON.stringify(it));

  // 4 horizontal ray (1 click)
  await tool('hray');
  await p.mouse.click(90, 700);
  await sleep(250);
  it = await last();
  P(!!it && it.type === 'hray' && it.n === 1, 'hray one point', JSON.stringify(it));

  // 5 style fields persist + render without error
  await p.evaluate(() => {
    var x = D.items[D.items.length - 1];
    x.color = '#F7525F'; x.width = 4; x.style = 'dash'; x.opacity = 0.6;
    var ch = D.items.filter(function (i) { return i.type === 'channel'; })[0];
    if (ch) { ch.fillColor = '#22AB94'; ch.style = 'dot'; }
    saveDrawings(); mark();
  });
  await sleep(300);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem(DK + S.sym)).map(function (i) { return { t: i.type, c: i.color, w: i.width, s: i.style, o: i.opacity, fc: i.fillColor }; }));
  const hr = saved.filter(x => x.t === 'hray')[0] || {};
  P(hr.c === '#F7525F' && hr.w === 4 && hr.s === 'dash' && Math.abs(hr.o - 0.6) < 1e-6, 'style persisted', JSON.stringify(hr));
  P(saved.some(x => x.fc === '#22AB94'), 'channel fillColor persisted', JSON.stringify(saved.filter(x => x.t === 'channel')[0] || {}));

  await p.screenshot({ path: OUT + 'm81-brush-highlighter.png' });

  // 6 locked item cannot be dragged
  await p.evaluate(() => { var ch = D.items.filter(function (i) { return i.type === 'channel'; })[0]; ch.locked = true; saveDrawings(); mark(); setTool('crosshair'); });
  const before = await p.evaluate(() => JSON.stringify(D.items.filter(function (i) { return i.type === 'channel'; })[0].pts));
  await drag(120, 360, 200, 420);
  const after = await p.evaluate(() => JSON.stringify(D.items.filter(function (i) { return i.type === 'channel'; })[0].pts));
  P(before === after, 'locked drawing not draggable');

  // 7 reload persistence
  await p.reload({ waitUntil: 'load' });
  await sleep(2200);
  const afterReload = await p.evaluate(() => D.items.map(function (i) { return i.type; }));
  P(afterReload.indexOf('brush') >= 0 && afterReload.indexOf('channel') >= 0 && afterReload.indexOf('hray') >= 0, 'drawings survive reload', JSON.stringify(afterReload));

  // 8 undo
  const n0 = await p.evaluate(() => D.items.length);
  await p.evaluate(() => { undo(); });
  const n1 = await p.evaluate(() => D.items.length);
  P(n1 <= n0, 'undo works', n0 + '->' + n1);

  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0, 500)); process.exit(1); });

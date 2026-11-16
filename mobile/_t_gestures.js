const puppeteer = require('D:/Project/AI/tradelab/node_modules/puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const P = (ok, name, extra) => console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' :: ' + extra : ''));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox','--disable-gpu'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0,150)));
  p.on('console', m => { if (m.type() === 'error' && !/vibrate|AudioContext|favicon|net::ERR_CONNECTION/.test(m.text())) errs.push(m.text().slice(0,150)); });
  await p.setViewport({ width: 393, height: 873, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await p.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
  await sleep(3400);
  const cdp = await p.target().createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts }).catch(()=>{});
  const geo = await p.evaluate(() => ({ plotW: LAY.plotW, H: H, timeH: LAY.timeH }));
  const st = () => p.evaluate(() => ({ sp: +V.spacing.toFixed(3), rng: +(V.priceMax - V.priceMin).toFixed(3), off: +V.rightOffset.toFixed(3), auto: V.autoPrice }));
  const freeze = () => p.evaluate(() => { V.autoPrice = false; mark(); });
  console.log('GEO', JSON.stringify(geo));

  // 1 horizontal pinch over chart -> time zoom only, price untouched
  await freeze();
  await sleep(250);
  let a = await st(); console.log('  a', JSON.stringify(a));
  await touch('touchStart', [{ x: 190, y: 380, id: 1 }, { x: 250, y: 380, id: 2 }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: 190 - i * 7, y: 380, id: 1 }, { x: 250 + i * 7, y: 380, id: 2 }]); await sleep(18); }
  await touch('touchEnd', []);
  await sleep(380);
  let c = await st(); console.log('  c', JSON.stringify(c));
  P(c.sp > a.sp * 1.2, 'horizontal pinch -> time zoom', a.sp + ' -> ' + c.sp);
  P(Math.abs(c.rng - a.rng) / a.rng < 0.02, 'chart pinch -> price scale untouched (TV parity)', a.rng + ' -> ' + c.rng);

  // 2 vertical pinch over chart -> nothing changes
  await freeze();
  a = await st();
  await touch('touchStart', [{ x: 170, y: 300, id: 1 }, { x: 170, y: 340, id: 2 }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: 170, y: 300 - i * 7, id: 1 }, { x: 170, y: 340 + i * 7, id: 2 }]); await sleep(18); }
  await touch('touchEnd', []);
  await sleep(350);
  c = await st();
  P(Math.abs(c.sp - a.sp) / a.sp < 0.03 && Math.abs(c.rng - a.rng) / a.rng < 0.03, 'vertical pinch on chart -> ignored (TV parity)', JSON.stringify({ sp: c.sp, rng: c.rng }));

  // 3 pinch over price axis -> price scale only
  await freeze();
  a = await st();
  const px = geo.plotW + 16;
  await touch('touchStart', [{ x: px, y: 250, id: 1 }, { x: px, y: 330, id: 2 }]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: px, y: 250 - i * 6, id: 1 }, { x: px, y: 330 + i * 6, id: 2 }]); await sleep(18); }
  await touch('touchEnd', []);
  await sleep(350);
  c = await st();
  P(Math.abs(c.rng - a.rng) / a.rng > 0.05, 'price-axis pinch -> price scale changes', a.rng + ' -> ' + c.rng);
  P(Math.abs(c.sp - a.sp) / a.sp < 0.03, 'price-axis pinch -> time untouched', a.sp + ' -> ' + c.sp);

  // 4 fling: swipe RIGHT (into history, offset grows)
  await p.evaluate(() => { V.rightOffset = 20; V.spacing = 9; V.autoPrice = true; mark(); });
  await sleep(250);
  const f0 = (await st()).off;
  await touch('touchStart', [{ x: 90, y: 500, id: 1 }]);
  for (let i = 1; i <= 4; i++) { await touch('touchMove', [{ x: 90 + i * 50, y: 500, id: 1 }]); await sleep(16); }
  await touch('touchEnd', []);
  const s1 = (await st()).off; await sleep(130);
  const s2 = (await st()).off; await sleep(260);
  const s3 = (await st()).off; await sleep(400);
  const s4 = (await st()).off;
  P(s3 > s2 + 0.2 && s4 >= s3 - 0.01 && s4 - s3 < (s3 - s2) * 1.5, 'fling -> momentum + deceleration', [f0, s1, s2, s3, s4].join(' -> '));

  // 5 hold >50ms then drag -> no fling (TV gate)
  await p.evaluate(() => { V.rightOffset = 20; mark(); });
  await sleep(700);
  await touch('touchStart', [{ x: 90, y: 500, id: 1 }]);
  await sleep(300);
  for (let i = 1; i <= 4; i++) { await touch('touchMove', [{ x: 90 + i * 50, y: 500, id: 1 }]); await sleep(16); }
  await touch('touchEnd', []);
  const h1 = (await st()).off; await sleep(250);
  const h2 = (await st()).off;
  P(Math.abs(h2 - h1) < 0.05, 'long-press drag -> no fling (TV 50ms gate)', h1 + ' -> ' + h2);

  // 6 double tap on price axis -> autoPrice
  await p.evaluate(() => { V.autoPrice = false; mark(); });
  await p.touchscreen.tap(px, 420); await sleep(70); await p.touchscreen.tap(px, 420);
  await sleep(300);
  P((await st()).auto === true, 'double tap price axis -> autoPrice ON');

  await p.screenshot({ path: 'D:/Project/AI/tvclone/shots/m84-gestures.png' });
  console.log('STATS', JSON.stringify(await p.evaluate(() => GEST.stats)));
  console.log('ERRORS', JSON.stringify(errs.slice(0, 5)));
  await b.close();
})().catch(e => { console.log('FAIL', String(e).slice(0,400)); process.exit(1); });

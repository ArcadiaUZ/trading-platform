
const puppeteer=require('D:\\Project\\AI\\tradelab\\node_modules\\puppeteer-core');
const fs=require('fs');
const outDir='D:\\Project\\AI\\tvclone\\shots';
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new', args:['--allow-file-access-from-files','--no-sandbox','--force-device-scale-factor=1']});
  const page=await browser.newPage();
  await page.setViewport({width:1600,height:900,deviceScaleFactor:1});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('file:///D:/Project/AI/tvclone/demo/xauview-demo.html',{waitUntil:'load'});
  await new Promise(r=>setTimeout(r,1200));
  await page.screenshot({path:outDir+'\\demo-04-m1.png'});

  // canvas offset
  const off=await page.evaluate(()=>{ var r=document.getElementById('chart').getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; });
  console.log('canvas', JSON.stringify(off));

  // H4 + indikatorlar
  await page.evaluate(()=>window.__APP.setTF('H4'));
  await new Promise(r=>setTimeout(r,400));
  await page.screenshot({path:outDir+'\\demo-05-h4.png'});

  // rectangle chizish (2 bosish)
  await page.evaluate(()=>window.__APP.setTool('rect'));
  const p1={x:off.x+300,y:off.y+220}, p2={x:off.x+620,y:off.y+420};
  await page.mouse.move(p1.x,p1.y); await page.mouse.down(); await page.mouse.up();
  await page.mouse.move(p2.x,p2.y,{steps:8}); await page.mouse.down(); await page.mouse.up();
  await new Promise(r=>setTimeout(r,200));
  // trendline
  await page.evaluate(()=>window.__APP.setTool('trendline'));
  const a1={x:off.x+700,y:off.y+180}, a2={x:off.x+1050,y:off.y+330};
  await page.mouse.move(a1.x,a1.y); await page.mouse.down(); await page.mouse.up();
  await page.mouse.move(a2.x,a2.y,{steps:8}); await page.mouse.down(); await page.mouse.up();
  await new Promise(r=>setTimeout(r,200));
  const n1=await page.evaluate(()=>window.__APP.D.items.length);
  // horizontal line
  await page.evaluate(()=>window.__APP.setTool('hline'));
  await page.mouse.move(off.x+500,off.y+300); await page.mouse.down(); await page.mouse.up();
  const n2=await page.evaluate(()=>window.__APP.D.items.length);
  // measure
  await page.evaluate(()=>window.__APP.setTool('measure'));
  await page.mouse.move(off.x+900,off.y+520); await page.mouse.down(); await page.mouse.up();
  await page.mouse.move(off.x+1200,off.y+380,{steps:10});
  await new Promise(r=>setTimeout(r,250));
  await page.screenshot({path:outDir+'\\demo-06-drawings.png'});
  // undo/redo
  await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control');
  await new Promise(r=>setTimeout(r,150));
  const afterUndo=await page.evaluate(()=>window.__APP.D.items.length);
  await page.keyboard.down('Control'); await page.keyboard.press('y'); await page.keyboard.up('Control');
  const afterRedo=await page.evaluate(()=>window.__APP.D.items.length);
  // symbol switch to GBPUSD + M15
  await page.evaluate(()=>{ window.__APP.setSym('GBPUSD'); window.__APP.setTF('M15'); });
  await new Promise(r=>setTimeout(r,500));
  await page.screenshot({path:outDir+'\\demo-07-gbp-m15.png'});
  // light theme
  await page.click('#themeBtn'); await new Promise(r=>setTimeout(r,400));
  await page.screenshot({path:outDir+'\\demo-08-light.png'});
  console.log('ITEMS', n1, n2, 'undo', afterUndo, 'redo', afterRedo);
  console.log('ERRORS', JSON.stringify(errs));
  await browser.close();
})();
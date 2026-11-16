
const puppeteer=require('D:\\Project\\AI\\tradelab\\node_modules\\puppeteer-core');
const out='D:\\Project\\AI\\tvclone\\shots';
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new',args:['--allow-file-access-from-files','--no-sandbox','--force-device-scale-factor=1']});
  const page=await browser.newPage();
  await page.setViewport({width:1600,height:900,deviceScaleFactor:1});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('file:///D:/Project/AI/tvclone/demo/xauview-demo.html',{waitUntil:'load'});
  await new Promise(r=>setTimeout(r,1200));
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'load'}); await new Promise(r=>setTimeout(r,1200));
  await page.screenshot({path:out+'\\d10-m1.png'});
  const off=await page.evaluate(()=>{var r=document.getElementById('chart').getBoundingClientRect();return{x:r.left,y:r.top};});

  await page.evaluate(()=>window.__APP.setTF('H4'));
  await new Promise(r=>setTimeout(r,400));
  await page.screenshot({path:out+'\\d11-h4.png'});

  // rect + trendline + measure
  await page.evaluate(()=>window.__APP.setTool('rect'));
  await page.mouse.move(off.x+320,off.y+250); await page.mouse.down(); await page.mouse.up();
  await page.mouse.move(off.x+640,off.y+430,{steps:6}); await page.mouse.down(); await page.mouse.up();
  await page.evaluate(()=>window.__APP.setTool('trendline'));
  await page.mouse.move(off.x+760,off.y+200); await page.mouse.down(); await page.mouse.up();
  await page.mouse.move(off.x+1080,off.y+340,{steps:6}); await page.mouse.down(); await page.mouse.up();
  await page.evaluate(()=>window.__APP.setTool('measure'));
  await page.mouse.move(off.x+900,off.y+560); await page.mouse.down(); await page.mouse.up();
  await page.mouse.move(off.x+1180,off.y+400,{steps:10});
  await new Promise(r=>setTimeout(r,200));
  await page.mouse.down(); await page.mouse.up();
  await new Promise(r=>setTimeout(r,250));
  const meas=await page.evaluate(()=>{var m=window.__APP.D.measure;return m?{p1:m.p1.p,p2:m.p2.p}:null;});
  await page.screenshot({path:out+'\\d12-draw.png'});

  await page.evaluate(()=>{window.__APP.setSym('GBPUSD'); window.__APP.setTF('M15');});
  await new Promise(r=>setTimeout(r,600));
  await page.screenshot({path:out+'\\d13-gbp-m15.png'});
  await page.evaluate(()=>{window.__APP.setTF('D1');});
  await new Promise(r=>setTimeout(r,500));
  await page.screenshot({path:out+'\\d14-gbp-d1.png'});
  await page.click('#themeBtn'); await new Promise(r=>setTimeout(r,500));
  await page.screenshot({path:out+'\\d15-light.png'});
  console.log('MEASURE', JSON.stringify(meas));
  console.log('ERRORS', JSON.stringify(errs));
  await browser.close();
})();


const puppeteer=require('D:\\Project\\AI\\tradelab\\node_modules\\puppeteer-core');
const out='D:\\Project\\AI\\tvclone\\shots';
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new',args:['--no-sandbox','--force-device-scale-factor=1']});
  const page=await browser.newPage();
  await page.setViewport({width:393,height:873,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'load',timeout:30000});
  await new Promise(r=>setTimeout(r,2800));
  await page.evaluate(()=>window.__M.setTF('H1'));
  await new Promise(r=>setTimeout(r,2200));
  await page.screenshot({path:out+'\\m53-h1.png'});
  await page.evaluate(()=>window.__M.setTF('H4'));
  await new Promise(r=>setTimeout(r,2200));
  await page.screenshot({path:out+'\\m54-h4.png'});
  await page.evaluate(()=>{window.__M.setSym('GBPUSD');window.__M.setTF('M15');});
  await new Promise(r=>setTimeout(r,2600));
  await page.screenshot({path:out+'\\m55-gbp.png'});
  // landscape
  await page.setViewport({width:873,height:393,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await new Promise(r=>setTimeout(r,900));
  await page.screenshot({path:out+'\\m56-landscape.png'});
  console.log('ERRORS', JSON.stringify(errs));
  await browser.close();
})();

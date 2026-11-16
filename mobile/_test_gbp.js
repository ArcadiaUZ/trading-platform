
const puppeteer=require('D:\\Project\\AI\\tradelab\\node_modules\\puppeteer-core');
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new',args:['--no-sandbox','--force-device-scale-factor=1']});
  const page=await browser.newPage();
  page.on('error',e=>console.log('CRASH', e.message));
  await page.setViewport({width:393,height:873,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'load',timeout:30000});
  await new Promise(r=>setTimeout(r,2500));
  console.log('LOADED', await page.evaluate(()=>({app:!!window.__M, live:document.getElementById('live').textContent})));
  await page.evaluate(()=>{window.__M.setSym('GBPUSD');window.__M.setTF('M15');});
  await new Promise(r=>setTimeout(r,2500));
  const st=await page.evaluate(()=>{var M=window.__M,b=M.ASSETS[M.S.sym].tfs[M.S.tf];return {sym:M.S.sym,tf:M.S.tf,n:b.length,last:b[b.length-1],min:M.V.priceMin,max:M.V.priceMax};});
  console.log('GBP', JSON.stringify(st));
  await page.screenshot({path:'D:\\Project\\AI\\tvclone\\shots\\m57-gbp-live.png'});
  console.log('ERRORS', JSON.stringify(errs));
  await browser.close();
})();

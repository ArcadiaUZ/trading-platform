
const puppeteer=require('D:\\Project\\AI\\tradelab\\node_modules\\puppeteer-core');
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new',args:['--no-sandbox','--force-device-scale-factor=1']});
  const page=await browser.newPage();
  await page.setViewport({width:393,height:873,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'load',timeout:30000});
  await new Promise(r=>setTimeout(r,2500));
  console.log('A', JSON.stringify(await page.evaluate(()=>({live:window.__M.FEED.ok, n:window.__M.ASSETS.XAUUSD.tfs.M1.length}))));
  await page.evaluate(()=>{window.__M.setSym('GBPUSD'); window.__M.setTF('M15');});
  await new Promise(r=>setTimeout(r,4000));
  const st=await page.evaluate(()=>{var M=window.__M,b=M.ASSETS[M.S.sym].tfs[M.S.tf];
    return {sym:M.S.sym,tf:M.S.tf,live:M.FEED.ok,badge:document.getElementById('live').textContent,
            n:b.length,last:b[b.length-1][0],gen:M.FEED.gen};});
  console.log('B', JSON.stringify(st));
  await page.screenshot({path:'D:\\Project\\AI\\tvclone\\shots\\m58-gbp-live2.png'});
  // qaytib XAU ga
  await page.evaluate(()=>{window.__M.setSym('XAUUSD'); window.__M.setTF('M1');});
  await new Promise(r=>setTimeout(r,4000));
  console.log('C', JSON.stringify(await page.evaluate(()=>({live:window.__M.FEED.ok, badge:document.getElementById('live').textContent, n:window.__M.ASSETS.XAUUSD.tfs.M1.length}))));
  console.log('ERRORS', JSON.stringify(errs));
  await browser.close();
})();

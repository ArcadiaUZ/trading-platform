
const puppeteer=require('D:\\Project\\AI\\tradelab\\node_modules\\puppeteer-core');
const out='D:\\Project\\AI\\tvclone\\shots';
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new',args:['--no-sandbox','--force-device-scale-factor=1']});
  const page=await browser.newPage();
  await page.setViewport({width:393,height:873,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  page.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'load',timeout:30000});
  await new Promise(r=>setTimeout(r,3500));
  const s1=await page.evaluate(()=>{
    var M=window.__M, b=M.ASSETS[M.S.sym].tfs[M.S.tf];
    return {live:document.getElementById('live').textContent, ok:M.FEED.ok, n:b.length, last:b[b.length-1],
            spacing:M.V.spacing};
  });
  await page.screenshot({path:out+'\\m50-live.png'});
  await new Promise(r=>setTimeout(r,2500));
  const s2=await page.evaluate(()=>{
    var M=window.__M, b=M.ASSETS[M.S.sym].tfs[M.S.tf];
    return {n:b.length, last:b[b.length-1]};
  });
  console.log('S1', JSON.stringify(s1));
  console.log('S2', JSON.stringify(s2));
  console.log('ERRORS', JSON.stringify(errs));
  await browser.close();
})();

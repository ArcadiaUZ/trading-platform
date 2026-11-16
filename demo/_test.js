
const puppeteer=require('D:\\Project\\AI\\tradelab\\node_modules\\puppeteer-core');
const fs=require('fs');
(async()=>{
  const outDir='D:\\Project\\AI\\tvclone\\shots';
  fs.mkdirSync(outDir,{recursive:true});
  const browser=await puppeteer.launch({
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new', args:['--allow-file-access-from-files','--no-sandbox','--force-device-scale-factor=1']
  });
  const page=await browser.newPage();
  await page.setViewport({width:1600,height:900,deviceScaleFactor:1});
  const errs=[], logs=[];
  page.on('console',m=>{ logs.push(m.type()+': '+m.text()); });
  page.on('pageerror',e=>{ errs.push('PAGEERROR: '+e.message); });
  await page.goto('file:///D:/Project/AI/tvclone/demo/xauview-demo.html',{waitUntil:'load',timeout:60000});
  await new Promise(r=>setTimeout(r,1800));
  const st=await page.evaluate(()=>{
    if(!window.__APP) return {noApp:true};
    const A=window.__APP;
    return {sym:A.S.sym, tf:A.S.tf, bars:A.ASSETS[A.S.sym].tfs[A.S.tf].length,
      items:A.D.items.length, spacing:A.V.spacing,
      canvasW:document.getElementById('chart').width};
  });
  console.log('STATE', JSON.stringify(st));
  console.log('ERRORS', JSON.stringify(errs));
  console.log('LOGS', JSON.stringify(logs.slice(0,25)));
  await page.screenshot({path:outDir+'\\demo-01.png'});
  // TF switch + symbol switch test
  const st2=await page.evaluate(()=>{ window.__APP.setTF('H1'); return window.__APP.S.tf; });
  await new Promise(r=>setTimeout(r,300));
  await page.screenshot({path:outDir+'\\demo-02-h1.png'});
  const st3=await page.evaluate(()=>{ window.__APP.setSym('GBPUSD'); return window.__APP.S.sym; });
  await new Promise(r=>setTimeout(r,600));
  await page.screenshot({path:outDir+'\\demo-03-gbp.png'});
  console.log('SWITCH', st2, st3);
  console.log('ERRORS2', JSON.stringify(errs));
  await browser.close();
})();

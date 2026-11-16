
const puppeteer=require('D:\\Project\\AI\\tradelab\\node_modules\\puppeteer-core');
const out='D:\\Project\\AI\\tvclone\\shots';
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new',args:['--no-sandbox','--force-device-scale-factor=1']});
  const page=await browser.newPage();
  await page.setViewport({width:393,height:873,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'load',timeout:30000});
  await new Promise(r=>setTimeout(r,3000));
  await page.screenshot({path:out+'\\m51-live2.png'});
  // alert qo'shish: narxdan +0.25 yuqorida
  const price=await page.evaluate(()=>{var b=window.__M.ASSETS.XAUUSD.tfs[window.__M.S.tf];return b[b.length-1][4];});
  const add=await page.evaluate(async (p)=>{
    var r=await fetch('/api/alerts',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({symbol:'XAUUSD',dir:'above',price:p,note:'test'})});
    return {status:r.status, body:await r.json()};
  }, Math.round((price+0.25)*1000)/1000);
  console.log('ADD', JSON.stringify(add));
  let got=null;
  for(let i=0;i<40;i++){
    await new Promise(r=>setTimeout(r,700));
    got=await page.evaluate(()=>({
      toastOn:document.getElementById('toast').classList.contains('on'),
      toastTxt:document.querySelector('#toast .t').innerText,
      alerts:window.__M.ALERTS().length
    }));
    if(got.toastOn) break;
  }
  console.log('ALERT_RESULT', JSON.stringify(got));
  await page.screenshot({path:out+'\\m52-alert.png'});
  // tozalash
  const del=await page.evaluate(async ()=>{
    var r=await fetch('/api/alerts'); var j=await r.json();
    for(var i=0;i<j.alerts.length;i++){ await fetch('/api/alerts/'+j.alerts[i].id,{method:'DELETE'}); }
    return j.alerts.length;
  });
  console.log('CLEANED', del, 'ERRORS', JSON.stringify(errs));
  await browser.close();
})();

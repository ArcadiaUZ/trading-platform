
const puppeteer=require('D:\\Project\\AI\\tradelab\\node_modules\\puppeteer-core');
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new',args:['--no-sandbox']});
  const page=await browser.newPage();
  await page.evaluateOnNewDocument(()=>{ window.addEventListener('error',function(e){ window.__err=(e.error&&e.error.stack)||e.message; }); });
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('http://127.0.0.1:8765/',{waitUntil:'load',timeout:30000});
  await new Promise(r=>setTimeout(r,1500));
  console.log('ERRSTACK', await page.evaluate(()=>window.__err||'none'));
  console.log('PAGEERRS', JSON.stringify(errs));
  await browser.close();
})();

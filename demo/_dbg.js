
const puppeteer=require('D:\\Project\\AI\\tradelab\\node_modules\\puppeteer-core');
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new',args:['--allow-file-access-from-files','--no-sandbox']});
  const page=await browser.newPage();
  await page.evaluateOnNewDocument(()=>{ window.addEventListener('error',function(e){ window.__err=(e.error&&e.error.stack)||e.message; }); });
  await page.goto('file:///D:/Project/AI/tvclone/demo/xauview-demo.html',{waitUntil:'load'});
  await new Promise(r=>setTimeout(r,1000));
  console.log(await page.evaluate(()=>window.__err||'no error captured'));
  await browser.close();
})();

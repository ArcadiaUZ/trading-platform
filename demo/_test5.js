
const puppeteer=require('D:\\Project\\AI\\tradelab\\node_modules\\puppeteer-core');
const out='D:\\Project\\AI\\tvclone\\shots';
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new',args:['--allow-file-access-from-files','--no-sandbox','--force-device-scale-factor=1']});
  const page=await browser.newPage();
  await page.setViewport({width:1600,height:900,deviceScaleFactor:1});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('file:///D:/Project/AI/tvclone/demo/xauview-demo.html',{waitUntil:'load'});
  await new Promise(r=>setTimeout(r,900));
  await page.evaluate(()=>localStorage.clear());
  await page.reload({waitUntil:'load'}); await new Promise(r=>setTimeout(r,1100));
  await page.evaluate(()=>window.__APP.setTF('M15'));
  await new Promise(r=>setTimeout(r,400));
  await page.screenshot({path:out+'\\f30-dark-m15.png'});
  await page.click('#themeBtn'); await new Promise(r=>setTimeout(r,400));   // light
  await page.screenshot({path:out+'\\f31-light-m15.png'});
  await page.click('#themeBtn'); await new Promise(r=>setTimeout(r,400));   // app
  await page.screenshot({path:out+'\\f32-app-m15.png'});
  await page.evaluate(()=>window.__APP.setTF('H4'));
  await new Promise(r=>setTimeout(r,400));
  await page.screenshot({path:out+'\\f33-app-h4.png'});
  const th=await page.evaluate(()=>window.__APP.S.theme);
  console.log('THEME',th,'ERRORS',JSON.stringify(errs));
  await browser.close();
})();

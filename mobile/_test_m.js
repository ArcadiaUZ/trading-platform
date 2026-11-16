
const puppeteer=require('D:\\Project\\AI\\tradelab\\node_modules\\puppeteer-core');
const out='D:\\Project\\AI\\tvclone\\shots';
(async()=>{
  const browser=await puppeteer.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:'new',args:['--allow-file-access-from-files','--no-sandbox','--force-device-scale-factor=1']});
  const page=await browser.newPage();
  await page.setViewport({width:393,height:873,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message));
  await page.goto('file:///D:/Project/AI/tvclone/mobile/index.html',{waitUntil:'load'});
  await new Promise(r=>setTimeout(r,1400));
  const st=await page.evaluate(()=>{
    if(!window.__M) return {noApp:true};
    var M=window.__M;
    return {sym:M.S.sym, tf:M.S.tf, bars:M.ASSETS[M.S.sym].tfs[M.S.tf].length,
            spacing:M.V.spacing, pw:document.getElementById('chart').width, live:document.getElementById('live').textContent};
  });
  console.log('STATE',JSON.stringify(st));
  await page.screenshot({path:out+'\\m40-portrait.png'});

  const client=await page.target().createCDPSession();
  async function tt(type,pts){ await client.send('Input.dispatchTouchEvent',{type:type,touchPoints:pts}); }
  async function tap(x,y){
    await tt('touchStart',[{x:x,y:y,id:1}]);
    await new Promise(r=>setTimeout(r,60));
    await tt('touchEnd',[]);
    await new Promise(r=>setTimeout(r,120));
  }
  // 1) tap -> crosshair
  await tap(200,420);
  const tip=await page.evaluate(()=>getComputedStyle(document.getElementById('crossTip')).display);
  await page.screenshot({path:out+'\\m41-tap.png'});
  // 2) pan (drag left)
  const off1=await page.evaluate(()=>window.__M.V.rightOffset);
  await tt('touchStart',[{x:300,y:400,id:1}]);
  for(let i=1;i<=6;i++){ await tt('touchMove',[{x:300-i*18,y:400,id:1}]); await new Promise(r=>setTimeout(r,16)); }
  await tt('touchEnd',[]);
  await new Promise(r=>setTimeout(r,150));
  const off2=await page.evaluate(()=>window.__M.V.rightOffset);
  // 3) pinch out (zoom in)
  const sp0=await page.evaluate(()=>window.__M.V.spacing);
  await tt('touchStart',[{x:170,y:420,id:1},{x:220,y:420,id:2}]);
  for(let i=1;i<=6;i++){ await tt('touchMove',[{x:170-i*8,y:420,id:1},{x:220+i*8,y:420,id:2}]); await new Promise(r=>setTimeout(r,16)); }
  await tt('touchEnd',[]);
  await new Promise(r=>setTimeout(r,150));
  const sp1=await page.evaluate(()=>window.__M.V.spacing);
  await page.screenshot({path:out+'\\m42-pinch.png'});
  // 4) draw rectangle: select tool then drag
  await page.evaluate(()=>window.__M.setTool('rect'));
  await tt('touchStart',[{x:110,y:320,id:1}]);
  for(let i=1;i<=6;i++){ await tt('touchMove',[{x:110+i*22,y:320+i*16,id:1}]); await new Promise(r=>setTimeout(r,16)); }
  await tt('touchEnd',[]);
  await new Promise(r=>setTimeout(r,200));
  const items=await page.evaluate(()=>window.__M.D.items.length);
  await page.screenshot({path:out+'\\m43-rect.png'});
  // 5) sheets
  await page.evaluate(()=>document.getElementById('tfBtn').click());
  await new Promise(r=>setTimeout(r,400));
  await page.screenshot({path:out+'\\m44-tf-sheet.png'});
  await page.evaluate(()=>document.getElementById('shClose').click());
  await new Promise(r=>setTimeout(r,300));
  await page.evaluate(()=>document.getElementById('alertBtn').click());
  await new Promise(r=>setTimeout(r,700));
  await page.screenshot({path:out+'\\m45-alerts-sheet.png'});
  await page.evaluate(()=>document.getElementById('shClose').click());
  await page.evaluate(()=>document.getElementById('indBtn').click());
  await new Promise(r=>setTimeout(r,400));
  await page.screenshot({path:out+'\\m46-ind-sheet.png'});
  console.log('RES', JSON.stringify({tip:tip, off1:off1, off2:off2, sp0:sp0, sp1:sp1, items:items}));
  console.log('ERRORS', JSON.stringify(errs));
  await browser.close();
})();

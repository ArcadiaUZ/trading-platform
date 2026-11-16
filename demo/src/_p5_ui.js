/* ==========================================================================
   UI: top bar, rail, watchlist, object list, legenda, dashboard, panel, init
   ========================================================================== */

var ICON={
  crosshair:'<circle cx="10" cy="10" r="3.2"/><path d="M10 1v5M10 14v5M1 10h5M14 10h5"/>',
  trendline:'<path d="M3 16L17 4"/><circle cx="3.5" cy="15.5" r="2"/><circle cx="16.5" cy="4.5" r="2"/>',
  ray:'<path d="M3 16L18 5"/><path d="M15 3l3 2-1 3"/><circle cx="3.5" cy="15.5" r="2"/>',
  hline:'<path d="M2 10h16"/><circle cx="10" cy="10" r="2"/>',
  vline:'<path d="M10 2v16"/><circle cx="10" cy="10" r="2"/>',
  rect:'<rect x="3" y="5" width="14" height="10" rx="1"/>',
  text:'<path d="M4 5h12M10 5v11"/><path d="M8 16h4"/>',
  measure:'<path d="M3 14l11-11 3 3-11 11z"/><path d="M7 10l2 2M10 7l2 2"/>',
  magnet:'<path d="M5 4v7a5 5 0 0010 0V4"/><path d="M5 8h4M11 8h4"/>',
  undo:'<path d="M7 9H4V6"/><path d="M4 9a7 7 0 1113 4"/>',
  redo:'<path d="M13 9h3V6"/><path d="M16 9A7 7 0 103 13"/>',
  trash:'<path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/>'
};
/* APK'dan olingan to'ldirilgan ikonkalar (assets/apk-icons/svg, fill=currentColor) */
var ICONF={
  fib:['0 0 25 24',
    '<path d="M3.904 19.042h18.115v1.5H3.904v-1.5zm-1.846-16.5h19.961v1.5H2.058v-1.5zm-0.023 5.5h18.161v1.5H2.035v-1.5zm0.023 5.5h19.961v1.5H2.058v-1.5z"/>'+
    '<path d="M2.808 20.583c0.456 0 0.807-0.364 0.807-0.791C3.615 19.364 3.264 19 2.808 19 2.352 19 2 19.364 2 19.792c0 0.427 0.352 0.791 0.808 0.791zm2.307-0.791c0 1.265-1.033 2.291-2.307 2.291-1.275 0-2.308-1.026-2.308-2.291 0-1.266 1.033-2.292 2.308-2.292 1.274 0 2.307 1.026 2.307 2.292zM21.27 9.583c0.455 0 0.807-0.364 0.807-0.791C22.077 8.364 21.725 8 21.269 8c-0.456 0-0.807 0.364-0.807 0.792 0 0.427 0.351 0.791 0.807 0.791zm2.307-0.791c0 1.265-1.033 2.291-2.308 2.291-1.274 0-2.307-1.026-2.307-2.291 0-1.266 1.033-2.292 2.307-2.292 1.275 0 2.308 1.026 2.308 2.292z"/>'],
  ray:['0 0 24 24',
    '<path d="M11.53 13.53l-5 5-1.06-1.06 5-5 1.06 1.06zm11-11l-8 8-1.06-1.06 8-8 1.06 1.06z"/>'+
    '<path d="M12.5 12.5c0.552 0 1-0.448 1-1s-0.448-1-1-1-1 0.448-1 1 0.448 1 1 1zm2.5-1c0 1.38-1.12 2.5-2.5 2.5S10 12.88 10 11.5 11.12 9 12.5 9s2.5 1.12 2.5 2.5zm-10.5 9c0.552 0 1-0.448 1-1s-0.448-1-1-1-1 0.448-1 1 0.448 1 1 1zm2.5-1C7 20.88 5.88 22 4.5 22S2 20.88 2 19.5 3.12 17 4.5 17 7 18.12 7 19.5z"/>'],
  measure:['0 0 28 28',
    '<path d="M3.516 20.77c-0.021-0.02-0.021-0.055 0-0.075l2.049-2.05L6.966 20 8 18.985l-1.374-1.401 1.946-1.945L10.953 18 12 16.959l-2.368-2.381 1.937-1.937 1.362 1.361L14 12.942l-1.37-1.362 1.942-1.942L16.969 12 18 10.974l-2.367-2.397 1.94-1.939L18.958 8 20 6.962l-1.367-1.385 2.061-2.061c0.021-0.021 0.055-0.021 0.076 0l3.714 3.714c0.021 0.021 0.021 0.055 0 0.076L7.306 24.484c-0.021 0.021-0.055 0.021-0.076 0L3.516 20.77zm2.653 4.775c0.607 0.607 1.59 0.607 2.197 0L25.545 8.366c0.607-0.606 0.607-1.59 0-2.197l-3.714-3.714c-0.607-0.607-1.591-0.607-2.197 0L17.259 4.83l-3.107 3.107-3.108 3.108-3.107 3.107-3.107 3.107-2.375 2.375c-0.607 0.607-0.607 1.59 0 2.197l3.714 3.714z" fill-rule="evenodd"/>'],
  daterange:['0 0 24 24',
    '<path d="M22.25 22.25v-18h-1.5v18h1.5zm-19-2.5v-18h-1.5v18h1.5z"/>'+
    '<path d="M2.5 20.5c0.552 0 1 0.448 1 1s-0.448 1-1 1-1-0.448-1-1 0.448-1 1-1zm2.5 1C5 20.12 3.88 19 2.5 19S0 20.12 0 21.5 1.12 24 2.5 24 5 22.88 5 21.5zm16.5-20c0.552 0 1 0.448 1 1s-0.448 1-1 1-1-0.448-1-1 0.448-1 1-1zm2.5 1C24 1.12 22.88 0 21.5 0S19 1.12 19 2.5 20.12 5 21.5 5 24 3.88 24 2.5zM17 10v5l3-2.5-3-2.5z"/>'+
    '<path d="M3.75 13.25H16.5v-1.5H3.75v1.5zm13.5-1.5H16.5v1.5h0.75v-1.5zM9 7h5l-2.5-3L9 7z"/>'+
    '<path d="M12.25 20.25V6.75h-1.5v13.5h1.5zM1.75 1.75h18v1.5h-18v-1.5zm2.5 19h18v1.5h-18v-1.5z"/>']
};
function iconSvg(id){
  var f=ICONF[id];
  if(f) return '<svg viewBox="'+f[0]+'" fill="currentColor">'+f[1]+'</svg>';
  return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" '+
    'stroke-linecap="round" stroke-linejoin="round">'+(ICON[id]||'')+'</svg>';
}
var TOOLS=[
  {id:'crosshair',name:'Kursor (Esc)',key:'Esc'},
  {id:'trendline',name:'Trendline',key:'T'},
  {id:'ray',name:'Ray (nur)',key:'R'},
  {id:'hline',name:'Horizontal line',key:'H'},
  {id:'vline',name:'Vertical line',key:'V'},
  {id:'rect',name:'Rectangle (zona)',key:'B'},
  {id:'fib',name:'Fib retracement',key:'F'},
  {id:'text',name:'Matn',key:'X'},
  {id:'measure',name:'Measure (o\'lchov)',key:'M'},
  {id:'daterange',name:'Date range (narx + vaqt)',key:'D'},
  {sep:true},
  {id:'magnet',name:'Magnet (OHLC ga yopishish)',act:true},
  {id:'undo',name:'Undo',act:true,key:'Ctrl+Z'},
  {id:'redo',name:'Redo',act:true,key:'Ctrl+Y'},
  {id:'clear',name:'Hammasini tozalash',act:true}
];

/* ---------- top bar ---------- */
function buildTfbar(){
  var el=document.getElementById('tfbar'); el.innerHTML='';
  TFS.forEach(function(t){
    var b=document.createElement('button');
    b.textContent=t; b.dataset.tf=t;
    b.addEventListener('click',function(){ setTF(t); });
    el.appendChild(b);
  });
  syncTfbar();
}
function syncTfbar(){
  document.querySelectorAll('#tfbar button').forEach(function(b){
    b.classList.toggle('on', b.dataset.tf===S.tf);
  });
}
function buildRail(){
  var el=document.getElementById('rail'); el.innerHTML='';
  TOOLS.forEach(function(t){
    if(t.sep){ var s=document.createElement('div'); s.className='railsep'; el.appendChild(s); return; }
    var b=document.createElement('button');
    b.className='rbtn'+(t.act&&t.id==='magnet'?' on':'');
    b.dataset.tool=t.id;
    b.title=t.name+(t.key?'  '+t.key:'');
    b.innerHTML=iconSvg(t.id)+
      '<span class="tip">'+t.name+(t.key?'  '+t.key:'')+'</span>';
    b.addEventListener('click',function(){
      if(t.id==='undo'){ undo(); return; }
      if(t.id==='redo'){ redo(); return; }
      if(t.id==='clear'){ clearAll(); return; }
      if(t.id==='magnet'){
        D.magnet=!D.magnet; b.classList.toggle('on',D.magnet); mark(); return;
      }
      setTool(t.id);
    });
    el.appendChild(b);
  });
}
function setSym(sym){
  S.sym=sym;
  document.getElementById('symLbl').textContent=sym;
  document.getElementById('feedLbl').textContent=ASSETS[sym].provider+':';
  var a=ASSETS[sym], tf=a.tfs, m1=tf.M1;
  var last=m1[m1.length-1];
  document.getElementById('sourceLbl').textContent=a.provider+':'+sym+'  ('+a.mt5symbol+')';
  loadDrawings(); refreshObjList();
  V.rightOffset=4; V.autoPrice=true;
  buildWatch();
  fit(); mark(); updateLegend(); updateDash();
}
function setTF(tf){
  S.tf=tf; syncTfbar();
  D.pending=null; D.sel=null; D.measure=null; D._measuring=false;
  V.rightOffset=4; V.autoPrice=true;
  fit(); mark(); updateLegend(); updateDash();
}

/* ---------- right panel ---------- */
function fpxFor(sym,p){ return Number(p).toFixed(ASSETS[sym].digits); }
function buildWatch(){
  var el=document.getElementById('wl'), h='';
  Object.keys(ASSETS).forEach(function(sym){
    var a=ASSETS[sym], d1=a.tfs.D1, m1=a.tfs.M1;
    var last=m1[m1.length-1][4];
    var prev=d1.length>1?d1[d1.length-2][4]:last;
    var chg=prev?(last-prev)/prev*100:0;
    h+='<div class="wlrow'+(sym===S.sym?' on':'')+'" data-sym="'+sym+'">'+
       '<div class="nm">'+a.provider+'<span class="s">:'+sym+'</span></div>'+
       '<div class="px'+(chg>=0?' u':' d')+'">'+fpxFor(sym,last)+'</div>'+
       '<div class="ch '+(chg>=0?'u':'d')+'">'+(chg>=0?'+':'')+chg.toFixed(2)+'%</div></div>';
  });
  el.innerHTML=h;
  el.querySelectorAll('.wlrow').forEach(function(r){
    r.addEventListener('click',function(){ setSym(r.dataset.sym); });
  });
}
function refreshObjList(){
  var el=document.getElementById('objlist');
  document.getElementById('objCount').textContent=D.items.length?('('+D.items.length+')'):'';
  if(!D.items.length){
    el.innerHTML='<div class="empty">Hali chizma yo\'q.<br>Chapdan trendline / rectangle tanlab, grafikda 2 nuqta bos.</div>';
    return;
  }
  var h='';
  D.items.forEach(function(it,i){
    var nm=TYPE_NAME[it.type]||it.type;
    h+='<div class="obj'+(it===D.sel?' on':'')+(it.hidden?' off':'')+'" data-id="'+it.id+'">'+
       '<span class="sw" style="background:'+(it.color||DRAW_COL)+'"></span>'+
       '<span class="nm">'+nm+(it.text?' — '+esc(it.text):'')+'</span>'+
       '<span class="eye" data-act="eye">'+(it.hidden?'&#9679;':'&#9675;')+'</span>'+
       '<span class="del" data-act="del">&#10005;</span></div>';
  });
  el.innerHTML=h;
  el.querySelectorAll('.obj').forEach(function(row){
    var id=row.dataset.id;
    row.addEventListener('click',function(e){
      var it=D.items.filter(function(x){ return x.id===id; })[0]; if(!it) return;
      var act=e.target.dataset?e.target.dataset.act:null;
      if(act==='del'){
        snapshot(); D.items=D.items.filter(function(x){ return x.id!==id; });
        if(D.sel&&D.sel.id===id) D.sel=null;
        saveDrawings(); mark(); return;
      }
      if(act==='eye'){ it.hidden=!it.hidden; saveDrawings(); mark(); return; }
      D.sel=it; refreshObjList(); mark();
    });
  });
}
function esc(s){ return String(s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }

/* ---------- legenda / dashboard ---------- */
function updateLegendForBar(i){
  var b=cur(); if(!b.length) return;
  i=clamp(i,0,b.length-1);
  renderLegend(b[i]);
  var r=b[i];
  var el=document.getElementById("ohlcLbl");
  if(el) el.innerHTML="O "+fpx(r[1])+"  H "+fpx(r[2])+"  L "+fpx(r[3])+"  C "+fpx(r[4])+"  Vol "+r[5];
}
function updateLegend(){
  var b=cur(); if(!b.length) return;
  renderLegend(b[b.length-1]);
}
function renderLegend(r){
  var a=ASSETS[S.sym], prev=r[1], diff=r[4]-prev, pct=prev?diff/prev*100:0;
  var cls=diff>=0?'bull':'bear', sign=diff>=0?'+':'';
  var ind=getInd(S.sym,S.tf);
  var bx=ind.boxes[ind.boxes.length-1];
  var pip=pipOf(), maxP=S.sym==='XAUUSD'?S.maxAsianPipsGold:S.maxAsianPipsFx;
  var asiaTxt='—', asiaCls='l3';
  if(bx){ var pips=Math.round((bx.high-bx.low)/pip);
    asiaTxt='ASIAN '+pips+' pips'+(pips<=maxP?' PRIME':' TOO WIDE');
  }
  var cvd=ind.cvd[ind.cvd.length-1]||0;
  var zc=ind.zones.length;
  Object.keys(ind.upper).forEach(function(k){ zc+=ind.upper[k].length; });
  if(S.tf==="D1") asiaTxt="Asia (D1 da yoq)";
  var el=document.getElementById('legend');
  el.innerHTML=
    '<div class="l1"><span class="feed">'+a.provider+':</span>'+S.sym+
      ' <span class="tfb">· '+S.tf+' ·</span> XAUView</div>'+
    '<div class="l2">O <b>'+fpx(r[1])+'</b> H <b>'+fpx(r[2])+'</b> L <b>'+fpx(r[3])+'</b> C <b>'+fpx(r[4])+'</b>'+
      ' <span class="'+cls+'">'+sign+fpx2(diff)+' ('+sign+pct.toFixed(2)+'%)</span></div>'+
    '<div class="l3"><span>'+asiaTxt+'</span><span>CVD <b>'+(cvd>=0?'+':'')+cvd.toFixed(1)+'%</b></span>'+
      '<span>FU zonas <b>'+zc+'</b></span><span>'+hhmm(r[0])+'</span></div>';
}
function updateDash(){
  var ind=getInd(S.sym,S.tf), bx=(S.tf==="D1"?null:ind.boxes[ind.boxes.length-1]);
  var pip=pipOf(), maxP=S.sym==='XAUUSD'?S.maxAsianPipsGold:S.maxAsianPipsFx;
  var rows='';
  if(bx){
    var pips=Math.round((bx.high-bx.low)/pip), ok=pips<=maxP;
    rows+='<div class="row"><span>Asia range</span><b class="'+(ok?'ok':'warn')+'">'+pips+' pips</b></div>';
    rows+='<div class="row"><span>BSL / SSL</span><b>'+fpx2(bx.high)+' / '+fpx2(bx.low)+'</b></div>';
  }
  var cvd=ind.cvd[ind.cvd.length-1]||0;
  rows+='<div class="row"><span>CVD proxy</span><b class="'+(cvd>=0?'ok':'bad')+'">'+(cvd>=0?'+':'')+cvd.toFixed(1)+'%</b></div>';
  var zc=0; for(var k in ind.upper) zc+=ind.upper[k].length;
  rows+='<div class="row"><span>Zonalar</span><b>'+ind.zones.length+' / '+zc+'</b></div>';
  var b=cur(), n=b.length, b30=b[Math.max(0,n-30)];
  var bias=(b[n-1][4]-b30[4])/b30[4]*100;
  rows+='<div class="row"><span>Bias 30 bar</span><b class="'+(bias>=0?'ok':'bad')+'">'+(bias>=0?'BUY':'SELL')+' '+bias.toFixed(2)+'%</b></div>';
  rows+='<div class="row"><span>Sweeps</span><b>'+ind.sweeps.length+'</b></div>';
  var el=document.getElementById('dash');
  if(!S.ind.dash){ el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.innerHTML='<div class="h"><span>ASIA-FU 3-IN-1</span><span>'+S.tf+'</span></div>'+rows;
}

/* ---------- indikator paneli ---------- */
function buildIndPanel(){
  var el=document.getElementById('indPanel');
  var cks=[['asia','Asian box + BSL/SSL'],['kill','Killzones (London/NY)'],['fu','FU / SFU / AFU zonalari'],
           ['sweep','Sweep belgilari'],['fvg','Sniper FVG'],['cvd','CVD pane'],['dash','Dashboard']];
  var h='<h4><span>Indikatorlar</span><span class="x" id="indClose">&#10005;</span></h4>';
  cks.forEach(function(c){
    h+='<label class="ck"><input type="checkbox" data-ind="'+c[0]+'"'+(S.ind[c[0]]?' checked':'')+'>'+c[1]+'</label>';
  });
  h+='<div class="grp">'+
     rowNum('Asia boshlanish (soat)','asiaStart',S.asiaStart)+
     rowNum('Asia tugash (soat)','asiaEnd',S.asiaEnd)+
     rowNum('Max Asia pips','maxAsianPips',S.sym==='XAUUSD'?S.maxAsianPipsGold:S.maxAsianPipsFx)+
     rowNum('FVG extend (bar)','fvgExtend',S.fvgExtend)+
     '</div><div class="grp"><div class="frow" style="color:var(--text2)">Ustki TF zonalari</div>';
  ['H4','H1','M15','M5'].forEach(function(t){
    h+='<label class="ck"><input type="checkbox" data-ztf="'+t+'"'+(S.zoneTFs.indexOf(t)>=0?' checked':'')+'>'+t+' zonalari</label>';
  });
  h+='</div>';
  el.innerHTML=h;
  document.getElementById('indClose').addEventListener('click',function(){ el.classList.add('hidden'); });
  el.querySelectorAll('input[data-ind]').forEach(function(inp){
    inp.addEventListener('change',function(){
      S.ind[inp.dataset.ind]=inp.checked;
      if(inp.dataset.ind==='cvd'||inp.dataset.ind==='dash') relayout();
      mark(); updateDash();
    });
  });
  el.querySelectorAll('input[data-ztf]').forEach(function(inp){
    inp.addEventListener('change',function(){
      var t=inp.dataset.ztf, i=S.zoneTFs.indexOf(t);
      if(inp.checked&&i<0) S.zoneTFs.push(t);
      if(!inp.checked&&i>=0) S.zoneTFs.splice(i,1);
      invalidate(); mark(); updateLegend(); updateDash();
    });
  });
  el.querySelectorAll('input[data-num]').forEach(function(inp){
    inp.addEventListener('input',function(){
      var v=parseFloat(inp.value); if(isNaN(v)) return;
      var k=inp.dataset.num;
      if(k==='maxAsianPips'){ if(S.sym==='XAUUSD') S.maxAsianPipsGold=v; else S.maxAsianPipsFx=v; }
      else S[k]=v;
      invalidate(); mark(); updateLegend(); updateDash();
    });
  });
}
function rowNum(label,key,val){
  return '<div class="frow"><span>'+label+'</span><input type="number" step="any" data-num="'+key+'" value="'+val+'"></div>';
}

/* ---------- klok / status ---------- */
function tickClock(){
  var d=new Date(Date.now()+TZ_OFF*1000);
  document.getElementById('clock').textContent=
    pad2(d.getUTCHours())+':'+pad2(d.getUTCMinutes())+':'+pad2(d.getUTCSeconds())+' UTC+5';
}
function bindStatus(){
  document.getElementById('zoomIn').addEventListener('click',function(){ setSpacing(V.spacing*1.25,null,null); });
  document.getElementById('zoomOut').addEventListener('click',function(){ setSpacing(V.spacing/1.25,null,null); });
  document.getElementById('fitBtn').addEventListener('click',fit);
  document.getElementById('ohlcLbl').textContent='';
}

/* ---------- top bar binding ---------- */
function bindTop(){
  document.getElementById('symBtn').addEventListener('click',function(e){
    e.stopPropagation();
    var m=document.getElementById('symMenu');
    var h='<div class="mhead">Asset</div>';
    Object.keys(ASSETS).forEach(function(sym){
      h+='<div class="mi'+(sym===S.sym?' on':'')+'" data-sym="'+sym+'">'+ASSETS[sym].provider+':'+sym+
         '<span class="sub">'+fpxFor(sym,ASSETS[sym].tfs.M1[ASSETS[sym].tfs.M1.length-1][4])+'</span></div>';
    });
    m.innerHTML=h; m.classList.toggle('hidden');
    m.querySelectorAll('.mi').forEach(function(r){
      r.addEventListener('click',function(){ m.classList.add('hidden'); setSym(r.dataset.sym); });
    });
  });
  document.getElementById('indBtn').addEventListener('click',function(e){
    e.stopPropagation();
    document.getElementById('indPanel').classList.toggle('hidden');
  });
  document.getElementById('drawBtn').addEventListener('click',function(e){
    e.stopPropagation();
    var m=document.getElementById('drawMenu');
    var h='<div class="mhead">Chizish asboblari</div>';
    TOOLS.forEach(function(t){
      if(t.sep||t.act) return;
      h+='<div class="mi'+(D.tool===t.id?' on':'')+'" data-tool="'+t.id+'" title="'+
         t.name+(t.key?'  '+t.key:'')+'">'+iconSvg(t.id)+'<span>'+t.name+'</span>'+
         '<span class="sub">'+(t.key||'')+'</span></div>';
    });
    h+='<div class="mhead">Amallar</div>'+
       '<div class="mi" data-act="undo">Undo<span class="sub">Ctrl+Z</span></div>'+
       '<div class="mi" data-act="redo">Redo<span class="sub">Ctrl+Y</span></div>'+
       '<div class="mi" data-act="clear">Hammasini tozalash</div>';
    m.innerHTML=h; m.classList.toggle('hidden');
    m.querySelectorAll('.mi').forEach(function(r){
      r.addEventListener('click',function(){
        m.classList.add('hidden');
        if(r.dataset.act==='undo') undo();
        else if(r.dataset.act==='redo') redo();
        else if(r.dataset.act==='clear') clearAll();
        else setTool(r.dataset.tool);
      });
    });
  });
  document.addEventListener('click',function(e){
    if(!e.target.closest||!e.target.closest('#symMenu')) document.getElementById('symMenu').classList.add('hidden');
    if(!e.target.closest||!e.target.closest('#drawMenu')) document.getElementById('drawMenu').classList.add('hidden');
  });
  document.getElementById('shotBtn').addEventListener('click',function(){
    var a=document.createElement('a');
    a.download='xauview-'+S.sym+'-'+S.tf+'.png';
    a.href=cv.toDataURL('image/png'); a.click();
  });
  document.getElementById('themeBtn').addEventListener('click',function(){
    var order=['dark','light','app'];
    var i=order.indexOf(S.theme); if(i<0) i=0;
    applyTheme(order[(i+1)%order.length]);
  });
  document.getElementById('fsBtn').addEventListener('click',function(){
    if(document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen();
  });
}

function applyTheme(t){
  document.body.classList.remove('light','apptheme');
  if(t==='light') document.body.classList.add('light');
  if(t==='app') document.body.classList.add('apptheme');
  S.theme=t; readVars(); mark();
  var b=document.getElementById('themeBtn');
  if(b){ b.title='Tema: '+t+' (bosib almashtir)'; b.textContent = (t==='light')?'\u2600':(t==='app'?'\u25C9':'\u263E'); }
}

/* ---------- init ---------- */
function init(){
  readVars();
  applyTheme(S.theme);
  loadDrawings();
  initCanvas();
  buildTfbar(); buildRail(); buildWatch(); refreshObjList(); buildIndPanel();
  bindTop(); bindStatus(); bindCanvas(); bindKeys();
  setSym('XAUUSD'); setTF('M1'); fit();
  tickClock(); setInterval(tickClock,1000);
  var b0=cur(); if(b0&&b0.length){ var r0=b0[b0.length-1]; document.getElementById("ohlcLbl").innerHTML="O "+fpx(r0[1])+"  H "+fpx(r0[2])+"  L "+fpx(r0[3])+"  C "+fpx(r0[4])+"  Vol "+r0[5]; }
  updateLegend(); updateDash(); mark();
  window.__APP={S:S,V:V,D:D,ASSETS:ASSETS,setTF:setTF,setSym:setSym,getInd:getInd,fit:fit,setTool:setTool};
}
window.addEventListener('load',init);

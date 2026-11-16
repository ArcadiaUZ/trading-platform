/* ==========================================================================
   Chart engine: masshtab, panes, shamlar, o'qlar, crosshair, chizmalar
   ========================================================================== */

var cv, ctx, DPR=1, W=0, H=0;
var LAY = {priceW:64, timeH:24, plotW:0, panes:[]};
var V = {spacing:7, rightOffset:6, autoPrice:true, drag:null, cross:null, panning:false,
         panX:0, panOff:0, priceMin:0, priceMax:0, dirty:true, fitOnce:true};

var CSSV = {};
function readVars(){
  var cs=getComputedStyle(document.body);
  ['--bg','--panel','--panel2','--border','--border2','--text','--text2','--text3','--up','--down',
   '--accent','--cross','--asiaF','--asiaB','--lonF','--nyF','--bsl','--ssl','--fvg','--fvgB']
    .forEach(function(k){ CSSV[k]=cs.getPropertyValue(k).trim(); });
}
function col(k){ return CSSV[k]||'#888'; }

function initCanvas(){
  cv=document.getElementById('chart');
  ctx=cv.getContext('2d');
  resize();
  window.addEventListener('resize',resize);
}
function resize(){
  DPR=Math.max(1,Math.min(2,window.devicePixelRatio||1));
  var r=cv.parentElement.getBoundingClientRect();
  W=Math.max(200,Math.floor(r.width)); H=Math.max(160,Math.floor(r.height));
  cv.width=Math.floor(W*DPR); cv.height=Math.floor(H*DPR);
  cv.style.width=W+'px'; cv.style.height=H+'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
  relayout();
  mark();
}
function relayout(){
  LAY.plotW=W-LAY.priceW;
  var inner=H-LAY.timeH, gap=1;
  var cvdOn=S.ind.cvd, volOn=true;
  var cvdH=cvdOn?Math.round(inner*0.14):0;
  var volH=Math.round(inner*0.12);
  var priceH=inner-volH-cvdH-(cvdOn?2:1)*gap;
  LAY.panes=[{k:'price',y:0,h:priceH}];
  var y=priceH+gap;
  LAY.panes.push({k:'vol',y:y,h:volH}); y+=volH+gap;
  if(cvdOn) LAY.panes.push({k:'cvd',y:y,h:cvdH});
}
function pane(k){ for(var i=0;i<LAY.panes.length;i++) if(LAY.panes[i].k===k) return LAY.panes[i]; return LAY.panes[0]; }
function mark(){ V.dirty=true; schedule(); }
var rafPending=false;
function schedule(){
  if(rafPending) return;
  rafPending=true;
  requestAnimationFrame(function(){ rafPending=false; if(V.dirty){ V.dirty=false; drawAll(); } });
}

/* ---------- koordinatalar ---------- */
function nBars(){ return cur().length; }
function rightIdx(){ return (nBars()-1)+V.rightOffset; }
function xOf(fi){ return LAY.plotW-(rightIdx()-fi+0.5)*V.spacing; }
function iOf(x){ return rightIdx()+0.5-(LAY.plotW-x)/V.spacing; }
function pY(p){ var pa=pane('price'); var r=V.priceMax-V.priceMin||1;
  return pa.y+pa.h-(p-V.priceMin)/r*pa.h; }
function yP(y){ var pa=pane('price'); var r=V.priceMax-V.priceMin||1;
  return V.priceMin+(pa.y+pa.h-y)/pa.h*r; }
function idxAtTs(ts){
  var b=cur(), lo=0, hi=b.length-1;
  if(ts<=b[0][0]) return 0;
  if(ts>=b[hi][0]) return hi+(ts-b[hi][0])/TF_SEC[S.tf];
  while(hi-lo>1){ var m=(lo+hi)>>1; if(b[m][0]<=ts) lo=m; else hi=m; }
  var t0=b[lo][0], t1=b[hi][0];
  return lo+(t1>t0?(ts-t0)/(t1-t0):0);
}
function tsAtIdx(f){
  var b=cur(), i=Math.floor(f);
  if(i<0) return b[0][0]+i*TF_SEC[S.tf];
  if(i>=b.length-1) return b[b.length-1][0]+(f-(b.length-1))*TF_SEC[S.tf];
  var a=b[i][0], z=b[i+1][0];
  return a+(z-a)*(f-i);
}
function tsX(ts){ return xOf(idxAtTs(ts)); }
function xTs(x){ return tsAtIdx(iOf(x)); }

/* ---------- ko'rinish chegaralari ---------- */
function visRange(){
  var b=cur(), i0=Math.max(0,Math.floor(iOf(-1))), i1=Math.min(b.length-1,Math.ceil(iOf(LAY.plotW+1)));
  return {i0:i0,i1:i1};
}
function autoPrice(){
  if(!V.autoPrice) return;
  var b=cur(), v=visRange(), mn=Infinity, mx=-Infinity;
  for(var i=v.i0;i<=v.i1;i++){ if(b[i][2]>mx) mx=b[i][2]; if(b[i][3]<mn) mn=b[i][3]; }
  if(!isFinite(mn)||!isFinite(mx)) return;
  var pad=(mx-mn)*0.12||1e-4;
  V.priceMin=mn-pad; V.priceMax=mx+pad;
}

/* ---------- yordamchi chizish ---------- */
function line(x1,y1,x2,y2,c,w,dash){
  ctx.save(); ctx.strokeStyle=c; ctx.lineWidth=w||1;
  if(dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); ctx.restore();
}
function txt(s,x,y,c,align,font){
  ctx.save(); ctx.fillStyle=c; ctx.font=font||'11px -apple-system,Segoe UI,Roboto,sans-serif';
  ctx.textAlign=align||'left'; ctx.textBaseline='middle'; ctx.fillText(s,x,y); ctx.restore();
}
function rect(x,y,w,h,fill,stroke,lw){
  if(w<0){ x+=w; w=-w; } if(h<0){ y+=h; h=-h; }
  if(fill){ ctx.fillStyle=fill; ctx.fillRect(x,y,w,h); }
  if(stroke){ ctx.save(); ctx.strokeStyle=stroke; ctx.lineWidth=lw||1; ctx.strokeRect(x+.5,y+.5,w-1,h-1); ctx.restore(); }
}
function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

/* ---------- o'qlar ---------- */
function niceStep(range,target){
  var raw=range/Math.max(1,target), mag=Math.pow(10,Math.floor(Math.log(raw)/Math.LN10)), norm=raw/mag;
  var m=norm<1.5?1:norm<3?2:norm<7?5:10;
  return m*mag;
}
function priceTicks(){
  var pa=pane('price'), step=niceStep(V.priceMax-V.priceMin, pa.h/48), out=[];
  var d=digits(), st=Math.ceil(V.priceMin/step)*step;
  for(var p=st;p<=V.priceMax;p+=step){ if(p>0) out.push(p); }
  return out;
}
function timeTicks(){
  var b=cur(), v=visRange(), tfSec=TF_SEC[S.tf];
  var cands=[60,120,300,600,900,1800,3600,7200,10800,14400,21600,43200,86400,172800,604800];
  var step=null;
  for(var c=0;c<cands.length;c++){ if(cands[c]/tfSec*V.spacing>=92){ step=cands[c]; break; } }
  if(!step) step=604800;
  var out=[];
  for(var i=v.i0;i<=Math.min(v.i1,b.length-1);i++){
    var ts=b[i][0], tsl=ts+TZ_OFF;
    if(tsl%step===0) out.push({i:i,ts:ts,step:step});
  }
  return out;
}
function timeLabel(ts,step){
  var d=dts(ts);
  if(step>=86400) return d.getUTCDate()+' '+MON[d.getUTCMonth()];
  var m=d.getUTCMinutes(), h=d.getUTCHours();
  if(step>=3600 && h===0 && m===0) return d.getUTCDate()+' '+MON[d.getUTCMonth()];
  return pad2(h)+':'+pad2(m);
}

/* ---------- asosiy render ---------- */
function drawAll(){
  var b=cur(), v=visRange();
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle=col('--bg'); ctx.fillRect(0,0,W,H);
  autoPrice();

  /* 1. sessiya fonlari */
  if(S.ind.kill) drawSessionBands(b,v);
  /* 2. grid */
  var pt=priceTicks(), tt=timeTicks();
  drawGrid(pt,tt);
  /* 3. zonalar (shamlar ostida) */
  if(S.ind.fu) drawZones(b);
  if(S.ind.fvg) drawFvgs(b);
  if(S.ind.asia) drawAsia(b,v);
  /* 4. shamlar */
  drawCandles(b,v);
  /* 5. volume */
  drawVolume(b,v);
  /* 6. CVD */
  if(S.ind.cvd) drawCvd(b,v);
  /* 7. sweep belgilari */
  if(S.ind.sweep) drawSweeps(b,v);
  /* 8. foydalanuvchi chizmalari */
  drawDrawings();
  /* 9. oxirgi narx */
  drawLastPrice(b);
  /* 10. o'qlar */
  drawAxes(pt,tt);
  /* 11. crosshair */
  drawCrosshair();
}

function drawSessionBands(b,v){
  var pa=pane('price');
  var bw=Math.max(1,V.spacing);
  for(var i=v.i0;i<=v.i1;i++){
    var ts=b[i][0], d=dts(ts), h=d.getUTCHours(), mi=d.getUTCMinutes();
    var x=xOf(i)-bw/2, c=null;
    if(h>=S.asiaStart && h<S.asiaEnd) c=col('--asiaF');
    else if((h>S.lonStart || (h===S.lonStart && mi>=S.lonMin)) && h<S.lonEnd) c=col('--lonF');
    else if((h>S.nyStart || (h===S.nyStart && mi>=S.nyMin)) && h<S.nyEnd) c=col('--nyF');
    if(c){ ctx.fillStyle=c; ctx.fillRect(x,pa.y,Math.ceil(bw),pa.h); }
  }
}
function drawGrid(pt,tt){
  var pa=pane('price');
  ctx.save();
  ctx.strokeStyle=col('--border'); ctx.lineWidth=1; ctx.globalAlpha=.85;
  for(var i=0;i<pt.length;i++){
    var y=Math.round(pY(pt[i]))+.5;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(LAY.plotW,y); ctx.stroke();
  }
  for(var j=0;j<tt.length;j++){
    var x=Math.round(xOf(tt[j].i))+.5;
    if(x<0||x>LAY.plotW) continue;
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H-LAY.timeH); ctx.stroke();
  }
  ctx.restore();
}
function drawCandles(b,v){
  var pa=pane('price'), bw=Math.max(1,Math.round(V.spacing*0.72));
  var thin=V.spacing<2.2;
  for(var i=v.i0;i<=v.i1;i++){
    var r=b[i], o=r[1],h=r[2],l=r[3],c=r[4];
    var up=c>=o, color=up?col('--up'):col('--down');
    var xc=Math.round(xOf(i))+.5;
    var yo=pY(o), yc=pY(c), yh=pY(h), yl=pY(l);
    if(thin){
      ctx.strokeStyle=color; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(xc,Math.round(yh)+.5); ctx.lineTo(xc,Math.round(yl)+.5); ctx.stroke();
      continue;
    }
    ctx.strokeStyle=color; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(xc,Math.round(yh)+.5); ctx.lineTo(xc,Math.round(yl)+.5); ctx.stroke();
    var top=Math.min(yo,yc), hgt=Math.max(1,Math.abs(yc-yo));
    ctx.fillStyle=color;
    ctx.fillRect(Math.round(xc-bw/2), Math.round(top), bw, Math.round(hgt));
  }
}
function drawVolume(b,v){
  var pa=pane('vol'), mx=1;
  for(var i=v.i0;i<=v.i1;i++) if(b[i][5]>mx) mx=b[i][5];
  var bw=Math.max(1,Math.round(V.spacing*0.72));
  for(var i2=v.i0;i2<=v.i2;i2++){} /* noop guard */
  for(var k=v.i0;k<=v.i1;k++){
    var r=b[k], up=r[4]>=r[1];
    var hh=Math.max(1,Math.round(r[5]/mx*(pa.h-2)));
    ctx.fillStyle=up?'rgba(8,153,129,.55)':'rgba(242,54,69,.55)';
    ctx.fillRect(Math.round(xOf(k)-bw/2), pa.y+pa.h-hh, bw, hh);
  }
  txt('Vol', 6, pa.y+8, col('--text2'));
}
function drawCvd(b,v){
  var pa=pane('cvd'), d=getInd(S.sym,S.tf).cvd, mx=100, mn=-100;
  var zero=pa.y+pa.h/2;
  line(0,zero,LAY.plotW,zero,col('--border2'),1,[3,3]);
  ctx.save(); ctx.strokeStyle=col('--accent'); ctx.lineWidth=1.4; ctx.beginPath();
  var started=false;
  for(var i=v.i0;i<=v.i1;i++){
    var x=xOf(i), y=zero-(d[i]||0)/200*pa.h;
    if(!started){ ctx.moveTo(x,y); started=true; } else ctx.lineTo(x,y);
  }
  ctx.stroke(); ctx.restore();
  var last=d[b.length-1]||0;
  txt('CVD '+(last>=0?'+':'')+last.toFixed(1)+'%', 6, pa.y+9, last>=0?col('--up'):col('--down'));
}
function drawAsia(b,v){
  var ind=getInd(S.sym,S.tf), boxes=ind.boxes, pip=pipOf();
  var maxP=S.sym==='XAUUSD'?S.maxAsianPipsGold:S.maxAsianPipsFx;
  for(var k=0;k<boxes.length;k++){
    var bx=boxes[k];
    if(bx.i1<v.i0-40||bx.i0>v.i1+40) continue;
    var x0=xOf(bx.i0), x1=xOf(bx.i1);
    var yh=pY(bx.high), yl=pY(bx.low);
    rect(x0,yh,x1-x0,yl-yh,col('--asiaF'),col('--asiaB'),1);
    /* BSL / SSL — kun oxirigacha cho'ziladi */
    var endIdx=bx.i1;
    for(var j=bx.i1+1;j<b.length;j++){ if(dayKey(b[j][0])!==bx.key) break; endIdx=j; }
    var xe=xOf(endIdx);
    ctx.save(); ctx.setLineDash([5,4]); ctx.lineWidth=1.5;
    ctx.strokeStyle=col('--bsl'); ctx.beginPath(); ctx.moveTo(x0,yh); ctx.lineTo(xe,yh); ctx.stroke();
    ctx.strokeStyle=col('--ssl'); ctx.beginPath(); ctx.moveTo(x0,yl); ctx.lineTo(xe,yl); ctx.stroke();
    ctx.restore();
    var pips=Math.round((bx.high-bx.low)/pip);
    var ok=pips<=maxP;
    var label='ASIAN '+pips+' pips '+(ok?'PRIME':'TOO WIDE');
    var w=ctx.measureText?ctx.measureText(label).width+10:80;
    var lx=x0+2, ly=yh-9;
    rect(lx,ly-7,w,14,col('--panel2'),col('--asiaB'),1);
    txt(label,lx+5,ly,col('--text'),'left','10px -apple-system,Segoe UI,Roboto,sans-serif');
  }
}
function zoneRect(x0,x1,topP,botP,color,label){
  var y0=pY(topP), y1=pY(botP);
  rect(x0,y0,x1-x0,y1-y0,null,color,1);
  ctx.save(); ctx.globalAlpha=.13; ctx.fillStyle=color; ctx.fillRect(x0,y0,x1-x0,y1-y0); ctx.restore();
  if(label && x1-x0>26) txt(label, x0+3, y0+7, color, 'left', '10px -apple-system,Segoe UI,Roboto,sans-serif');
}
function drawZones(b){
  var ind=getInd(S.sym,S.tf), k, z, i0, i1;
  for(k=0;k<ind.zones.length;k++){
    z=ind.zones[k];
    if(z.i1<b.length-ind.zoneLookback) continue;
    zoneRect(xOf(z.i0),xOf(z.i1),z.top,z.bottom,
      z.bull?'rgba(8,153,129,.9)':'rgba(242,54,69,.9)', (z.kind==='AFU'?'':'')+S.tf+' '+z.kind);
  }
  for(var t in ind.upper){
    var arr=ind.upper[t], bars=ASSETS[S.sym].tfs[t];
    for(k=0;k<arr.length;k++){
      z=arr[k];
      var ts0=bars[z.i0][0], ts1=bars[z.i1][0];
      zoneRect(tsX(ts0),tsX(ts1),z.top,z.bottom, ZONE_COL[t]+'cc', t+' '+z.kind);
    }
  }
}
function drawFvgs(b){
  var ind=getInd(S.sym,S.tf);
  for(var k=0;k<ind.fvgs.length;k++){
    var f=ind.fvgs[k];
    if(f.i1<visRange().i0-20) continue;
    var y0=pY(f.top), y1=pY(f.bottom);
    rect(xOf(f.i0),y0,xOf(f.i1)-xOf(f.i0),y1-y0,col('--fvg'),col('--fvgB'),1);
  }
}
function drawSweeps(b,v){
  var ind=getInd(S.sym,S.tf);
  for(var k=0;k<ind.sweeps.length;k++){
    var s=ind.sweeps[k];
    if(s.i<v.i0-10||s.i>v.i1+10) continue;
    var x=xOf(s.i), y=s.dir==='up'?pY(s.level)-10:pY(s.level)+10;
    var c=s.dir==='up'?col('--down'):col('--up');
    ctx.save(); ctx.fillStyle=c; ctx.beginPath();
    if(s.dir==='up'){ ctx.moveTo(x,y-7); ctx.lineTo(x-5,y+2); ctx.lineTo(x+5,y+2); }
    else { ctx.moveTo(x,y+7); ctx.lineTo(x-5,y-2); ctx.lineTo(x+5,y-2); }
    ctx.closePath(); ctx.fill(); ctx.restore();
    txt(s.dir==='up'?'SWEEP':'SWEEP', x+7, y, c, 'left', '9px -apple-system,Segoe UI,Roboto,sans-serif');
  }
}
function drawLastPrice(b){
  if(!b.length) return;
  var last=b[b.length-1][4], up=last>=b[b.length-1][1];
  var y=pY(last);
  if(y<pane('price').y||y>pane('price').y+pane('price').h) return;
  var c=up?col('--up'):col('--down');
  line(0,y,LAY.plotW,y,c,1,[4,3]);
}
function drawAxes(pt,tt){
  var b=cur();
  ctx.save();
  ctx.fillStyle=col('--panel'); ctx.fillRect(LAY.plotW,0,LAY.priceW,H);
  ctx.fillStyle=col('--panel'); ctx.fillRect(0,H-LAY.timeH,LAY.plotW,LAY.timeH);
  ctx.strokeStyle=col('--border'); ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(LAY.plotW+.5,0); ctx.lineTo(LAY.plotW+.5,H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,H-LAY.timeH+.5); ctx.lineTo(W,H-LAY.timeH+.5); ctx.stroke();
  ctx.restore();
  /* narx yorliqlari */
  var pa=pane('price');
  for(var i=0;i<pt.length;i++){
    var y=pY(pt[i]); if(y<8||y>pa.y+pa.h-4) continue;
    txt(fpx2(pt[i]), LAY.plotW+6, y, col('--text2'), 'left', '11px -apple-system,Segoe UI,Roboto,sans-serif');
  }
  /* vaqt yorliqlari */
  for(var j=0;j<tt.length;j++){
    var x=xOf(tt[j].i); if(x<24||x>LAY.plotW-8) continue;
    txt(timeLabel(tt[j].ts,tt[j].step), x, H-LAY.timeH/2, col('--text2'), 'center', '11px -apple-system,Segoe UI,Roboto,sans-serif');
  }
  /* oxirgi narx yorlig'i */
  var last=b[b.length-1], y2=pY(last[4]), up=last[4]>=last[1];
  if(y2>0&&y2<pa.y+pa.h){
    ctx.save(); ctx.fillStyle=up?col('--up'):col('--down');
    roundRect(LAY.plotW+2,y2-8,LAY.priceW-4,16,3); ctx.fill(); ctx.restore();
    txt(fpx(last[4]), LAY.plotW+LAY.priceW/2+1, y2, '#fff', 'center', '11px -apple-system,Segoe UI,Roboto,sans-serif');
  }
}
function drawCrosshair(){
  if(!V.cross) return;
  var x=V.cross.x, y=V.cross.y, b=cur();
  ctx.save(); ctx.setLineDash([4,3]); ctx.strokeStyle=col('--cross'); ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(Math.round(x)+.5,0); ctx.lineTo(Math.round(x)+.5,H-LAY.timeH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0,Math.round(y)+.5); ctx.lineTo(LAY.plotW,Math.round(y)+.5); ctx.stroke();
  ctx.restore();
  /* vaqt yorlig'i */
  var ts=xTs(x), lbl=hhmm(ts)+' '+pad2(dts(ts).getUTCDate())+' '+MON[dts(ts).getUTCMonth()];
  ctx.save(); ctx.fillStyle=col('--panel2');
  roundRect(Math.min(x-42,LAY.plotW-86),H-LAY.timeH+2,86,LAY.timeH-4,3); ctx.fill(); ctx.restore();
  txt(lbl,Math.min(x-42,LAY.plotW-86)+43,H-LAY.timeH/2,col('--text'),'center');
  /* narx yorlig'i */
  if(y<pane('price').y+pane('price').h){
    ctx.save(); ctx.fillStyle=col('--panel2');
    roundRect(LAY.plotW+2,y-8,LAY.priceW-4,16,3); ctx.fill(); ctx.restore();
    txt(fpx2(yP(y)),LAY.plotW+LAY.priceW/2+1,y,col('--text'),'center');
  }
}

/* ===== v2 override: render tuzatishlari ===== */
function drawSessionBands(b,v){
  var pa=pane("price"), bw=Math.max(1,V.spacing);
  for(var i=v.i0;i<=v.i1;i++){
    var ts=b[i][0], d=dts(ts), hh2=d.getUTCHours(), mi=d.getUTCMinutes();
    var x=xOf(i)-bw/2, c=null;
    if(S.ind.asia && hh2>=S.asiaStart && hh2<S.asiaEnd) c=col("--asiaF");
    else if(S.ind.kill && (hh2>S.lonStart || (hh2===S.lonStart && mi>=S.lonMin)) && hh2<S.lonEnd) c=col("--lonF");
    else if(S.ind.kill && (hh2>S.nyStart || (hh2===S.nyStart && mi>=S.nyMin)) && hh2<S.nyEnd) c=col("--nyF");
    if(c){ ctx.fillStyle=c; ctx.fillRect(x,pa.y,Math.ceil(bw),pa.h); }
  }
}
function drawWatermark(){
  var s=ASSETS[S.sym].provider+":"+S.sym+"  \u00B7  "+S.tf;
  ctx.save();
  ctx.fillStyle=col("--text"); ctx.globalAlpha=.045;
  ctx.font="600 30px -apple-system,Segoe UI,Roboto,sans-serif";
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText(s, LAY.plotW/2, pane("price").h/2-10);
  ctx.globalAlpha=.05;
  ctx.font="11px -apple-system,Segoe UI,Roboto,sans-serif";
  ctx.fillText("XAUView demo snapshot", LAY.plotW/2, pane("price").h/2+18);
  ctx.restore();
}
function drawAsia(b,v){
  var ind=getInd(S.sym,S.tf), boxes=ind.boxes, pip=pipOf();
  var maxP=S.sym==="XAUUSD"?S.maxAsianPipsGold:S.maxAsianPipsFx;
  for(var k=0;k<boxes.length;k++){
    var bx=boxes[k];
    if(bx.i1<v.i0-40||bx.i0>v.i1+40) continue;
    var x0=xOf(bx.i0), x1=xOf(bx.i1);
    var yh=pY(bx.high), yl=pY(bx.low);
    rect(x0,yh,x1-x0,yl-yh,col("--asiaF"),col("--asiaB"),1);
    var endIdx=bx.i1;
    for(var j=bx.i1+1;j<b.length;j++){ if(dayKey(b[j][0])!==bx.key) break; endIdx=j; }
    var xe=xOf(endIdx);
    ctx.save(); ctx.setLineDash([5,4]); ctx.lineWidth=1.5;
    ctx.strokeStyle=col("--bsl"); ctx.beginPath(); ctx.moveTo(x0,yh); ctx.lineTo(xe,yh); ctx.stroke();
    ctx.strokeStyle=col("--ssl"); ctx.beginPath(); ctx.moveTo(x0,yl); ctx.lineTo(xe,yl); ctx.stroke();
    ctx.restore();
    var pips=Math.round((bx.high-bx.low)/pip);
    var ok=pips<=maxP;
    var label="ASIAN "+pips+" pips "+(ok?"PRIME":"TOO WIDE");
    var w=label.length*5.6+10;
    var lx=clamp(x0+2,2,Math.max(2,LAY.plotW-w-4)), ly=yh-9;
    if(ly<9) ly=9;
    rect(lx,ly-7,w,14,col("--panel2"),col("--asiaB"),1);
    txt(label,lx+5,ly,col("--text"),"left","10px -apple-system,Segoe UI,Roboto,sans-serif");
  }
}
function drawZones(b){
  var ind=getInd(S.sym,S.tf), k, z;
  var own=ind.zones.slice(-7);
  for(k=0;k<own.length;k++){
    z=own[k];
    if(z.i1<b.length-S.zoneLookback) continue;
    var x0=xOf(z.i0), x1=xOf(z.i1);
    if(x1<-40||x0>LAY.plotW+40) continue;
    var lab=(Math.abs(pY(z.top)-pY(z.bottom))>14 && x1-x0>44)?(S.tf+" "+z.kind):"";
    zoneRect(x0,x1,z.top,z.bottom, z.bull?"rgba(8,153,129,.95)":"rgba(242,54,69,.95)", lab);
  }
  for(var t in ind.upper){
    var arr=ind.upper[t].slice(-6), bars=ASSETS[S.sym].tfs[t];
    for(k=0;k<arr.length;k++){
      z=arr[k];
      var xx0=tsX(bars[z.i0][0]), xx1=tsX(bars[z.i1][0]);
      if(xx1<-40||xx0>LAY.plotW+40) continue;
      var lb=(Math.abs(pY(z.top)-pY(z.bottom))>13 && xx1-xx0>42)?(t+" "+z.kind):"";
      zoneRect(xx0,xx1,z.top,z.bottom, ZONE_COL[t], lb);
    }
  }
}
(function(){
  var _grid=drawGrid;
  drawGrid=function(pt,tt){ drawWatermark(); _grid(pt,tt); };
  var _axes=drawAxes;
  drawAxes=function(pt,tt){
    _axes(pt,tt);
    ctx.save(); ctx.fillStyle=col("--panel");
    ctx.fillRect(LAY.plotW,H-LAY.timeH,LAY.priceW,LAY.timeH);
    ctx.strokeStyle=col("--border"); ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(LAY.plotW+.5,H-LAY.timeH); ctx.lineTo(LAY.plotW+.5,H); ctx.stroke();
    ctx.restore();
  };
})();

/* ===== v3 override ===== */
function drawAsia(b,v){
  var ind=getInd(S.sym,S.tf), boxes=ind.boxes, pip=pipOf();
  var maxP=S.sym==="XAUUSD"?S.maxAsianPipsGold:S.maxAsianPipsFx;
  var start=Math.max(0,boxes.length-12);
  for(var k=start;k<boxes.length;k++){
    var bx=boxes[k];
    if(bx.i1<v.i0-20||bx.i0>v.i1+20) continue;
    var x0=xOf(bx.i0), x1=xOf(bx.i1);
    var yh=pY(bx.high), yl=pY(bx.low);
    rect(x0,yh,x1-x0,yl-yh,null,col("--asiaB"),1);
    var endIdx=bx.i1;
    for(var j=bx.i1+1;j<b.length;j++){ if(dayKey(b[j][0])!==bx.key) break; endIdx=j; }
    var xe=xOf(endIdx);
    ctx.save(); ctx.setLineDash([5,4]); ctx.lineWidth=1.4;
    ctx.strokeStyle=col("--bsl"); ctx.beginPath(); ctx.moveTo(x0,yh); ctx.lineTo(xe,yh); ctx.stroke();
    ctx.strokeStyle=col("--ssl"); ctx.beginPath(); ctx.moveTo(x0,yl); ctx.lineTo(xe,yl); ctx.stroke();
    ctx.restore();
    if(x1-x0<64) continue;
    var pips=Math.round((bx.high-bx.low)/pip);
    var ok=pips<=maxP;
    var label="ASIAN "+pips+" pips "+(ok?"PRIME":"TOO WIDE");
    var w=label.length*5.4+10;
    var lx=clamp(x0+2,2,Math.max(2,LAY.plotW-w-4)), ly=yh-8;
    if(ly<52) ly=yl+9;
    rect(lx,ly-6,w,13,col("--panel2"),col("--asiaB"),1);
    txt(label,lx+4,ly+0.5,col("--text"),"left","9.5px -apple-system,Segoe UI,Roboto,sans-serif");
  }
}
function drawZones(b){
  var ind=getInd(S.sym,S.tf), k, z;
  var own=ind.zones.slice(-6);
  for(k=0;k<own.length;k++){
    z=own[k];
    if(z.i1<b.length-S.zoneLookback) continue;
    var x0=xOf(z.i0), x1=xOf(z.i1);
    if(x1<-40||x0>LAY.plotW+40) continue;
    var lab=(Math.abs(pY(z.top)-pY(z.bottom))>15 && x1-x0>50)?(S.tf+" "+z.kind):"";
    zoneRect(x0,x1,z.top,z.bottom, z.bull?"rgba(8,153,129,.85)":"rgba(242,54,69,.85)", lab);
  }
  for(var t in ind.upper){
    if(t===S.tf) continue;
    var arr=ind.upper[t].slice(-5), bars=ASSETS[S.sym].tfs[t];
    for(k=0;k<arr.length;k++){
      z=arr[k];
      var xx0=tsX(bars[z.i0][0]), xx1=tsX(bars[z.i1][0]);
      if(xx1<-40||xx0>LAY.plotW+40) continue;
      var lb=(Math.abs(pY(z.top)-pY(z.bottom))>14 && xx1-xx0>48)?(t+" "+z.kind):"";
      zoneRect(xx0,xx1,z.top,z.bottom, ZONE_COL[t], lb);
    }
  }
}
function drawCvd(b,v){
  var pa=pane("cvd"), d=getInd(S.sym,S.tf).cvd;
  var mn=0,mx=0;
  for(var i=v.i0;i<=v.i1;i++){ var x=d[i]||0; if(x<mn) mn=x; if(x>mx) mx=x; }
  mn=Math.min(mn,-5); mx=Math.max(mx,5);
  var pad=(mx-mn)*0.15; mn-=pad; mx+=pad;
  function yv(val){ return pa.y+pa.h-(val-mn)/(mx-mn)*pa.h; }
  line(0,yv(0),LAY.plotW,yv(0),col("--border2"),1,[3,3]);
  ctx.save(); ctx.strokeStyle=col("--accent"); ctx.lineWidth=1.3; ctx.beginPath();
  var st=false;
  for(var i2=v.i0;i2<=v.i1;i2++){
    var xx=xOf(i2), yy=yv(d[i2]||0);
    if(!st){ ctx.moveTo(xx,yy); st=true; } else ctx.lineTo(xx,yy);
  }
  ctx.stroke(); ctx.restore();
  var last=d[d.length-1]||0;
  txt("CVD "+(last>=0?"+":"")+last.toFixed(1)+"%", 6, pa.y+9, last>=0?col("--up"):col("--down"));
}

/* ===== v4 override ===== */
function timeTicks(){
  var b=cur(), v=visRange(), tfSec=TF_SEC[S.tf];
  var cands=[60,120,300,600,900,1800,3600,7200,10800,14400,21600,43200,86400,172800,604800,1209600];
  var step=null;
  for(var c=0;c<cands.length;c++){ if(cands[c]/tfSec*V.spacing>=92){ step=cands[c]; break; } }
  if(!step) step=1209600;
  var out=[], prev=null, first=true, lim=Math.min(v.i1,b.length-1);
  for(var i=v.i0;i<=lim;i++){
    var bucket=Math.floor((b[i][0]+TZ_OFF)/step);
    if(bucket!==prev){ prev=bucket; if(!first) out.push({i:i,ts:b[i][0],step:step}); }
    first=false;
  }
  return out;
}
function drawAsia(b,v){
  var ind=getInd(S.sym,S.tf), boxes=ind.boxes, pip=pipOf();
  var maxP=S.sym==="XAUUSD"?S.maxAsianPipsGold:S.maxAsianPipsFx;
  var start=Math.max(0,boxes.length-12);
  for(var k=start;k<boxes.length;k++){
    var bx=boxes[k], isLast=(k===boxes.length-1);
    if(bx.i1<v.i0-20||bx.i0>v.i1+20) continue;
    var x0=xOf(bx.i0), x1=xOf(bx.i1);
    var yh=pY(bx.high), yl=pY(bx.low);
    rect(x0,yh,x1-x0,yl-yh,col("--asiaF"),col("--asiaB"),1);
    var endIdx=bx.i1;
    for(var j=bx.i1+1;j<b.length;j++){ if(dayKey(b[j][0])!==bx.key) break; endIdx=j; }
    var xe=xOf(endIdx);
    ctx.save(); ctx.setLineDash([5,4]); ctx.lineWidth=1.4;
    ctx.strokeStyle=col("--bsl"); ctx.beginPath(); ctx.moveTo(x0,yh); ctx.lineTo(xe,yh); ctx.stroke();
    ctx.strokeStyle=col("--ssl"); ctx.beginPath(); ctx.moveTo(x0,yl); ctx.lineTo(xe,yl); ctx.stroke();
    ctx.restore();
    if(x1-x0<64 && !isLast) continue;
    if(x0<352 && yh<72) continue;
    var pips=Math.round((bx.high-bx.low)/pip);
    var label="ASIAN "+pips+" pips "+(pips<=maxP?"PRIME":"TOO WIDE");
    var w=label.length*5.4+10;
    var lx=clamp(x0+2,2,Math.max(2,LAY.plotW-w-4)), ly=yh-8;
    if(ly<52) ly=yl+9;
    rect(lx,ly-6,w,13,col("--panel2"),col("--asiaB"),1);
    txt(label,lx+4,ly+0.5,col("--text"),"left","9.5px -apple-system,Segoe UI,Roboto,sans-serif");
  }
}

/* ===== v5: yumshoqroq zonalar ===== */
function zoneRect(x0,x1,topP,botP,color,label,fillA){
  var y0=pY(topP), y1=pY(botP), a=(fillA==null?0.10:fillA);
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=color;
  ctx.fillRect(x0,y0,x1-x0,y1-y0);
  ctx.restore();
  ctx.save(); ctx.globalAlpha=.55; ctx.strokeStyle=color; ctx.lineWidth=1;
  ctx.strokeRect(x0+.5,y0+.5,Math.max(0,x1-x0-1),Math.max(0,y1-y0-1));
  ctx.restore();
  if(label && x1-x0>52 && Math.abs(y1-y0)>14){
    var w=label.length*5.2+8;
    var lx=clamp(x0+2,2,Math.max(2,LAY.plotW-w-2));
    rect(lx,y0+2,w,12,"rgba(19,23,34,.75)",null,0);
    txt(label,lx+4,y0+8.5,color,"left","9px -apple-system,Segoe UI,Roboto,sans-serif");
  }
}
function drawZones(b){
  var ind=getInd(S.sym,S.tf), k, z;
  var own=ind.zones.slice(-6);
  for(k=0;k<own.length;k++){
    z=own[k];
    if(z.i1<b.length-S.zoneLookback) continue;
    var x0=xOf(z.i0), x1=xOf(z.i1);
    if(x1<-40||x0>LAY.plotW+40) continue;
    var lab=(Math.abs(pY(z.top)-pY(z.bottom))>15 && x1-x0>52)?(S.tf+" "+z.kind):"";
    zoneRect(x0,x1,z.top,z.bottom, z.bull?"#089981":"#f23645", lab, .09);
  }
  for(var t in ind.upper){
    if(t===S.tf) continue;
    var arr=ind.upper[t].slice(-4), bars=ASSETS[S.sym].tfs[t];
    for(k=0;k<arr.length;k++){
      z=arr[k];
      var xx0=tsX(bars[z.i0][0]), xx1=tsX(bars[z.i1][0]);
      if(xx1<-40||xx0>LAY.plotW+40) continue;
      var lb=(Math.abs(pY(z.top)-pY(z.bottom))>14 && xx1-xx0>52)?(t+" "+z.kind):"";
      zoneRect(xx0,xx1,z.top,z.bottom, ZONE_COL[t], lb, .055);
    }
  }
}

/* ===== v6: D1 himoyasi + yumshoq Asia ===== */
function drawSweeps(b,v){
  if(S.tf==="D1") return;
  var ind=getInd(S.sym,S.tf);
  for(var k=0;k<ind.sweeps.length;k++){
    var s=ind.sweeps[k];
    if(s.i<v.i0-10||s.i>v.i1+10) continue;
    var x=xOf(s.i), y=s.dir==="up"?pY(s.level)-10:pY(s.level)+10;
    var c=s.dir==="up"?col("--down"):col("--up");
    ctx.save(); ctx.fillStyle=c; ctx.beginPath();
    if(s.dir==="up"){ ctx.moveTo(x,y-7); ctx.lineTo(x-5,y+2); ctx.lineTo(x+5,y+2); }
    else { ctx.moveTo(x,y+7); ctx.lineTo(x-5,y-2); ctx.lineTo(x+5,y-2); }
    ctx.closePath(); ctx.fill(); ctx.restore();
    txt("SWEEP", x+7, y, c, "left", "9px -apple-system,Segoe UI,Roboto,sans-serif");
  }
}
function drawFvgs(b){
  if(S.tf==="D1") return;
  var ind=getInd(S.sym,S.tf), vr=visRange();
  for(var k=0;k<ind.fvgs.length;k++){
    var f=ind.fvgs[k];
    if(f.i1<vr.i0-20) continue;
    var y0=pY(f.top), y1=pY(f.bottom);
    rect(xOf(f.i0),y0,xOf(f.i1)-xOf(f.i0),y1-y0,col("--fvg"),col("--fvgB"),1);
  }
}
function drawAsia(b,v){
  if(S.tf==="D1") return;
  var ind=getInd(S.sym,S.tf), boxes=ind.boxes, pip=pipOf();
  var maxP=S.sym==="XAUUSD"?S.maxAsianPipsGold:S.maxAsianPipsFx;
  var start=Math.max(0,boxes.length-10);
  for(var k=start;k<boxes.length;k++){
    var bx=boxes[k], isLast=(k===boxes.length-1);
    if(bx.i1<v.i0-20||bx.i0>v.i1+20) continue;
    var x0=xOf(bx.i0), x1=xOf(bx.i1);
    var yh=pY(bx.high), yl=pY(bx.low);
    rect(x0,yh,x1-x0,yl-yh,null,col("--asiaB"),1);
    var endIdx=bx.i1;
    for(var j=bx.i1+1;j<b.length;j++){ if(dayKey(b[j][0])!==bx.key) break; endIdx=j; }
    var xe=xOf(endIdx);
    ctx.save(); ctx.setLineDash([5,4]); ctx.lineWidth=1.4;
    ctx.strokeStyle=col("--bsl"); ctx.beginPath(); ctx.moveTo(x0,yh); ctx.lineTo(xe,yh); ctx.stroke();
    ctx.strokeStyle=col("--ssl"); ctx.beginPath(); ctx.moveTo(x0,yl); ctx.lineTo(xe,yl); ctx.stroke();
    ctx.restore();
    if(x1-x0<64 && !isLast) continue;
    if(x0<352 && yh<72) continue;
    var pips=Math.round((bx.high-bx.low)/pip);
    var label="ASIAN "+pips+" pips "+(pips<=maxP?"PRIME":"TOO WIDE");
    var w=label.length*5.4+10;
    var lx=clamp(x0+2,2,Math.max(2,LAY.plotW-w-4)), ly=yh-8;
    if(ly<52) ly=yl+9;
    rect(lx,ly-6,w,13,col("--panel2"),col("--asiaB"),1);
    txt(label,lx+4,ly+0.5,col("--text"),"left","9.5px -apple-system,Segoe UI,Roboto,sans-serif");
  }
}
function zoneRect(x0,x1,topP,botP,color,label,fillA){
  var y0=pY(topP), y1=pY(botP), a=(fillA==null?0.10:fillA);
  ctx.save(); ctx.globalAlpha=a; ctx.fillStyle=color;
  ctx.fillRect(x0,y0,x1-x0,y1-y0);
  ctx.restore();
  ctx.save(); ctx.globalAlpha=.55; ctx.strokeStyle=color; ctx.lineWidth=1;
  ctx.strokeRect(x0+.5,y0+.5,Math.max(0,x1-x0-1),Math.max(0,y1-y0-1));
  ctx.restore();
  if(label && x1-x0>52 && Math.abs(y1-y0)>14){
    var w=label.length*5.2+8;
    var lx=clamp(x0+2,2,Math.max(2,LAY.plotW-w-2));
    rect(lx,y0+2,w,12,col("--panel2"),null,0);
    txt(label,lx+4,y0+8.5,color,"left","9px -apple-system,Segoe UI,Roboto,sans-serif");
  }
}

/* ===== v7: D1 da session fonlari yoq ===== */
function drawSessionBands(b,v){
  if(S.tf==="D1") return;
  var pa=pane("price"), bw=Math.max(1,V.spacing);
  for(var i=v.i0;i<=v.i1;i++){
    var ts=b[i][0], d=dts(ts), hh2=d.getUTCHours(), mi=d.getUTCMinutes();
    var x=xOf(i)-bw/2, c=null;
    if(S.ind.asia && hh2>=S.asiaStart && hh2<S.asiaEnd) c=col("--asiaF");
    else if(S.ind.kill && (hh2>S.lonStart || (hh2===S.lonStart && mi>=S.lonMin)) && hh2<S.lonEnd) c=col("--lonF");
    else if(S.ind.kill && (hh2>S.nyStart || (hh2===S.nyStart && mi>=S.nyMin)) && hh2<S.nyEnd) c=col("--nyF");
    if(c){ ctx.fillStyle=c; ctx.fillRect(x,pa.y,Math.ceil(bw),pa.h); }
  }
}

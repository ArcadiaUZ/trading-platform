/* ==========================================================================
   Chizmalar (trendline/ray/hline/vline/rect/text/measure) + interaksiya
   ========================================================================== */

var DK='xauview.drawings.v1.';
var FIB_LV=[0,0.236,0.382,0.5,0.618,0.786,1];
var D={items:[],sel:null,tool:'crosshair',pending:null,drag:null,measure:null,magnet:true,
       undoStack:[],redoStack:[],hoverBar:null,_pressAt:null,_measuring:false};

function loadDrawings(){
  try{ D.items=JSON.parse(localStorage.getItem(DK+S.sym)||'[]')||[]; }catch(e){ D.items=[]; }
  D.sel=null; D.pending=null;
}
function saveDrawings(){
  try{ localStorage.setItem(DK+S.sym, JSON.stringify(D.items)); }catch(e){}
  if(typeof refreshObjList==='function') refreshObjList();
}
function snapshot(){
  D.undoStack.push(JSON.stringify(D.items));
  if(D.undoStack.length>80) D.undoStack.shift();
  D.redoStack.length=0;
}
function undo(){ if(!D.undoStack.length) return; D.redoStack.push(JSON.stringify(D.items));
  D.items=JSON.parse(D.undoStack.pop()); D.sel=null; saveDrawings(); mark(); }
function redo(){ if(!D.redoStack.length) return; D.undoStack.push(JSON.stringify(D.items));
  D.items=JSON.parse(D.redoStack.pop()); D.sel=null; saveDrawings(); mark(); }
function uid(){ return 'd'+Math.random().toString(36).slice(2,9); }
function newItem(type,pts,extra){
  var it={id:uid(),type:type,pts:pts,color:DRAW_COL,width:1.6};
  if(extra) for(var k in extra) it[k]=extra[k];
  return it;
}
var TYPE_NAME={trendline:'Trendline',ray:'Ray',hline:'Horizontal',vline:'Vertical',
               rect:'Rectangle',text:'Text',fib:'Fib retracement',measure:'Measure',
               daterange:'Date range'};

/* ---------- chizish ---------- */
function drawDrawings(){
  var i,it;
  for(i=0;i<D.items.length;i++){
    it=D.items[i]; if(it.hidden) continue;
    drawItem(it, it===D.sel);
  }
  if(D.pending && D.pending.pts.length){
    var p=D.pending, tmp={type:p.type,pts:p.pts.concat(p.cur?[p.cur]:[]),color:p.color||DRAW_COL,width:1.2,text:p.text};
    drawItem(tmp,false,true);
  }
}
function drawItem(it,selected,preview){
  var c=it.color||DRAW_COL, w=it.width||1.6;
  ctx.save();
  ctx.strokeStyle=c; ctx.lineWidth=w; ctx.fillStyle=c;
  if(preview) ctx.setLineDash([4,3]);
  var p0=it.pts[0], p1=it.pts[1];
  if(it.type==='hline'){
    var y=pY(p0.p);
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(LAY.plotW,y); ctx.stroke();
    labelPill(fpx2(p0.p), LAY.plotW+4, y, c);
  } else if(it.type==='vline'){
    var x=tsX(p0.ts);
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H-LAY.timeH); ctx.stroke();
    labelPill(hhmm(p0.ts), Math.min(x,LAY.plotW-40), H-LAY.timeH-11, c, 40);
  } else if(it.type==='trendline'||it.type==='ray'){
    if(!p1){ ctx.restore(); return; }
    var x0=tsX(p0.ts),y0=pY(p0.p),x1=tsX(p1.ts),y1=pY(p1.p);
    var ex=x1, ey=y1;
    if(it.type==='ray'){
      var re=rayEnd(x0,y0,x1,y1); ex=re.x; ey=re.y;
      ctx.save(); ctx.beginPath(); ctx.rect(0,0,LAY.plotW,H-LAY.timeH); ctx.clip();
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.restore();
    } else {
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(ex,ey); ctx.stroke();
    }
  } else if(it.type==='rect'){
    if(!p1){ ctx.restore(); return; }
    var xa=tsX(p0.ts),ya=pY(p0.p),xb=tsX(p1.ts),yb=pY(p1.p);
    var rx=Math.min(xa,xb),ry=Math.min(ya,yb),rw=Math.abs(xb-xa),rh=Math.abs(yb-ya);
    ctx.globalAlpha=.10; ctx.fillRect(rx,ry,rw,rh); ctx.globalAlpha=1;
    ctx.strokeRect(rx+.5,ry+.5,rw,rh);
    var diff=p1.p-p0.p, pct=p0.p?(diff/p0.p*100):0;
    var lbl=(diff>=0?'+':'')+fpx2(diff)+'  ('+(pct>=0?'+':'')+pct.toFixed(2)+'%)';
    if(rw>70&&rh>16) labelText(lbl, rx+5, ry+11, c);
  } else if(it.type==='fib'){
    if(!p1){ ctx.restore(); return; }
    var fa=tsX(p0.ts), fb=tsX(p1.ts);
    var fl=Math.min(fa,fb), fr=Math.max(fa,fb);
    if(fr-fl<30) fr=fl+30;
    var fd=p1.p-p0.p, fy0=pY(p0.p), fy1=pY(p1.p);
    var ftop=Math.min(fy0,fy1), fbot=Math.max(fy0,fy1);
    ctx.save(); ctx.globalAlpha=.07; ctx.fillStyle=c;
    ctx.fillRect(fl,ftop,fr-fl,Math.max(1,fbot-ftop)); ctx.restore();
    ctx.save(); ctx.lineWidth=1;
    for(var fi=0;fi<FIB_LV.length;fi++){
      var flv=FIB_LV[fi], fpp=p0.p+fd*flv, fyy=pY(fpp);
      if(fyy<-26||fyy>H-4) continue;
      ctx.globalAlpha=.9; ctx.strokeStyle=c;
      ctx.beginPath(); ctx.moveTo(fl,fyy+.5); ctx.lineTo(fr,fyy+.5); ctx.stroke();
      ctx.globalAlpha=1;
      var flab=(flv===0?'0':(flv===1?'1':String(flv)));
      labelText(flab, fl+4, fyy-7, c);
      txt(fpx2(fpp), fr-3, fyy-7, c, 'right', '10px -apple-system,Segoe UI,Roboto,sans-serif');
    }
    ctx.globalAlpha=.45; ctx.lineWidth=1; ctx.strokeStyle=c;
    ctx.beginPath(); ctx.moveTo(fl+.5,ftop); ctx.lineTo(fl+.5,fbot); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fr-.5,ftop); ctx.lineTo(fr-.5,fbot); ctx.stroke();
    ctx.restore();
  } else if(it.type==='measure'){
    if(!p1){ ctx.restore(); return; }
    var mx0=tsX(p0.ts), my0=pY(p0.p), mx1=tsX(p1.ts), my1=pY(p1.p);
    ctx.save(); ctx.setLineDash([3,3]); ctx.lineWidth=1; ctx.globalAlpha=.72;
    ctx.strokeStyle=c;
    ctx.beginPath(); ctx.moveTo(mx0,my0); ctx.lineTo(mx1,my0); ctx.lineTo(mx1,my1); ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(mx0,my0); ctx.lineTo(mx1,my1); ctx.stroke();
    var mdp=p1.p-p0.p, mpct=p0.p?(mdp/p0.p*100):0;
    var mnb=Math.abs(Math.round(iOf(mx1)-iOf(mx0)));
    var mlab=(mdp>=0?'+':'')+fpx2(mdp)+'  '+(mpct>=0?'+':'')+mpct.toFixed(2)+'%  '+mnb+' bar';
    badgeBox([mlab],(mx0+mx1)/2,Math.min(my0,my1)-26,c,true);
  } else if(it.type==='daterange'){
    if(!p1){ ctx.restore(); return; }
    var gx0=tsX(p0.ts), gy0=pY(p0.p), gx1=tsX(p1.ts), gy1=pY(p1.p);
    var gl=Math.min(gx0,gx1), gr=Math.max(gx0,gx1);
    var gt=Math.min(gy0,gy1), gb=Math.max(gy0,gy1);
    var gp=pane('price');
    ctx.save(); ctx.globalAlpha=.055; ctx.fillStyle=c;
    ctx.fillRect(gl,gt,Math.max(1,gr-gl),Math.max(1,gb-gt));
    ctx.globalAlpha=.4; ctx.strokeStyle=c; ctx.lineWidth=1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(gl+.5,gp.y); ctx.lineTo(gl+.5,gp.y+gp.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gr+.5,gp.y); ctx.lineTo(gr+.5,gp.y+gp.h); ctx.stroke();
    ctx.globalAlpha=.26;
    ctx.beginPath(); ctx.moveTo(0,gt+.5); ctx.lineTo(LAY.plotW,gt+.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,gb+.5); ctx.lineTo(LAY.plotW,gb+.5); ctx.stroke();
    ctx.restore();
    var gdp=p1.p-p0.p, gpct=p0.p?(gdp/p0.p*100):0;
    var gnb=Math.abs(Math.round(iOf(gx1)-iOf(gx0)));
    var l1=(gdp>=0?'+':'')+fpx2(gdp)+'  ('+(gpct>=0?'+':'')+gpct.toFixed(2)+'%)';
    var l2=gnb+' bar  '+durHM(gnb*TF_SEC[S.tf]);
    badgeBox([l1,l2],gl+6,Math.max(gt,gp.y)+6,c,false);
  } else if(it.type==='text'){
    ctx.font='12px -apple-system,Segoe UI,Roboto,sans-serif';
    ctx.textBaseline='middle';
    ctx.fillText(it.text||'', tsX(p0.ts), pY(p0.p));
  }
  ctx.restore();
  if(selected){ drawHandles(it); }
}
function labelPill(text,x,y,color,w){
  ctx.save(); ctx.font='10px -apple-system,Segoe UI,Roboto,sans-serif';
  var tw=w||(ctx.measureText(text).width+8);
  ctx.fillStyle=color; roundRect(x,y-8,tw,15,3); ctx.fill();
  ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,x+tw/2,y+0.5); ctx.restore();
}
function labelText(text,x,y,color){ txt(text,x,y,color,'left','11px -apple-system,Segoe UI,Roboto,sans-serif'); }
function drawHandles(it){
  ctx.save();
  for(var i=0;i<it.pts.length;i++){
    var pt=it.pts[i];
    var x=pt.ts!=null?tsX(pt.ts):(i===0?0:LAY.plotW);
    var y=pt.p!=null?pY(pt.p):0;
    if(it.type==='hline'){ x=6; }
    if(it.type==='vline'){ y=6; }
    ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2);
    ctx.fillStyle=col('--bg'); ctx.fill();
    ctx.lineWidth=1.6; ctx.strokeStyle=it.color||DRAW_COL; ctx.stroke();
  }
  ctx.restore();
}
/* ray: o'ngga cheksiz davom etadigan uch nuqta */
function rayEnd(x0,y0,x1,y1){
  var dx=x1-x0, dy=y1-y0;
  var top=0, bot=H-LAY.timeH;   /* butun plot maydoni (barcha pane lar) */
  var tx=1e9, ty=1e9;
  if(dx>1e-6) tx=(LAY.plotW-x0)/dx; else if(dx<-1e-6) tx=(0-x0)/dx;
  if(dy>1e-6) ty=(bot-y0)/dy; else if(dy<-1e-6) ty=(top-y0)/dy;
  var t=Math.min(tx,ty);
  if(!isFinite(t)||t===1e9) t=1;
  if(t<1) t=1;
  if(t>1e5) t=1e5;
  return {x:x0+dx*t,y:y0+dy*t};
}
function durHM(s){
  s=Math.abs(s||0);
  if(s<60) return Math.round(s)+'s';
  if(s<3600) return Math.round(s/60)+'m';
  var h=Math.floor(s/3600), m=Math.round((s-h*3600)/60);
  if(m>=60){ h++; m=0; }
  return h+'h '+(m<10?'0':'')+m+'m';
}
/* measure / daterange uchun badge */
function badgeBox(lines,bx,by,c,center){
  ctx.save();
  ctx.font='10px -apple-system,Segoe UI,Roboto,sans-serif';
  var i, w=0, tw;
  for(i=0;i<lines.length;i++){ tw=ctx.measureText(lines[i]).width; if(tw>w) w=tw; }
  var bw=Math.ceil(w)+16, bh=lines.length*13+9;
  var x=center?Math.round(bx-bw/2):Math.round(bx);
  x=clamp(x,3,Math.max(3,LAY.plotW-bw-3));
  var y=clamp(Math.round(by),3,Math.max(3,H-LAY.timeH-bh-3));
  ctx.globalAlpha=.94; ctx.fillStyle=col('--panel2'); roundRect(x,y,bw,bh,3); ctx.fill();
  ctx.globalAlpha=.55; ctx.strokeStyle=c; ctx.lineWidth=1; ctx.strokeRect(x+.5,y+.5,bw-1,bh-1);
  ctx.globalAlpha=1; ctx.fillStyle=col('--text');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for(i=0;i<lines.length;i++) ctx.fillText(lines[i], x+bw/2, y+9+i*13);
  ctx.restore();
}

/* ---------- hit test ---------- */
function distSeg(px,py,x1,y1,x2,y2){
  var dx=x2-x1, dy=y2-y1, L2=dx*dx+dy*dy;
  var t=L2?((px-x1)*dx+(py-y1)*dy)/L2:0; t=clamp(t,0,1);
  var qx=x1+t*dx, qy=y1+t*dy;
  return Math.hypot(px-qx,py-qy);
}
function hitTest(x,y){
  for(var i=D.items.length-1;i>=0;i--){
    var it=D.items[i]; if(it.hidden) continue;
    var p0=it.pts[0], p1=it.pts[1];
    if(it.type==='hline' && Math.abs(y-pY(p0.p))<6) return it;
    if(it.type==='vline' && Math.abs(x-tsX(p0.ts))<6) return it;
    if((it.type==='trendline'||it.type==='ray') && p1){
      var ha=tsX(p0.ts), hb=pY(p0.p), hc=tsX(p1.ts), hd=pY(p1.p);
      if(it.type==='ray'){ var he=rayEnd(ha,hb,hc,hd); hc=he.x; hd=he.y; }
      if(distSeg(x,y,ha,hb,hc,hd)<6) return it;
    }
    if(it.type==='fib' && p1){
      var fhd=p1.p-p0.p;
      var fhl=Math.min(tsX(p0.ts),tsX(p1.ts))-8, fhr=Math.max(tsX(p0.ts),tsX(p1.ts))+8;
      if(x>=fhl&&x<=fhr){
        for(var fk=0;fk<FIB_LV.length;fk++){
          if(Math.abs(y-pY(p0.p+fhd*FIB_LV[fk]))<7) return it;
        }
        if(Math.abs(x-tsX(p0.ts))<6||Math.abs(x-tsX(p1.ts))<6) return it;
        var fta=Math.min(pY(p0.p),pY(p1.p)), fbb=Math.max(pY(p0.p),pY(p1.p));
        if(y>fta&&y<fbb) return it;
      }
    }
    if(it.type==='measure' && p1){
      var mxa=tsX(p0.ts), mya=pY(p0.p), mxb=tsX(p1.ts), myb=pY(p1.p);
      if(distSeg(x,y,mxa,mya,mxb,myb)<8) return it;
      if(x>=Math.min(mxa,mxb)-6&&x<=Math.max(mxa,mxb)+6&&
         y>=Math.min(mya,myb)-4&&y<=Math.max(mya,myb)+4) return it;
    }
    if(it.type==='daterange' && p1){
      var dxa=tsX(p0.ts), dya=pY(p0.p), dxb=tsX(p1.ts), dyb=pY(p1.p);
      if(x>=Math.min(dxa,dxb)-6&&x<=Math.max(dxa,dxb)+6&&
         y>=Math.min(dya,dyb)-6&&y<=Math.max(dya,dyb)+6) return it;
    }
    if(it.type==='rect' && p1){
      var xa=tsX(p0.ts),ya=pY(p0.p),xb=tsX(p1.ts),yb=pY(p1.p);
      var l=Math.min(xa,xb),r=Math.max(xa,xb),t=Math.min(ya,yb),b=Math.max(ya,yb);
      if(x>=l-5&&x<=r+5&&y>=t-5&&y<=b+5){
        if(Math.abs(x-l)<6||Math.abs(x-r)<6||Math.abs(y-t)<6||Math.abs(y-b)<6) return it;
        if(x>l&&x<r&&y>t&&y<b) return it;
      }
    }
    if(it.type==='text'){
      ctx.font='12px -apple-system,Segoe UI,Roboto,sans-serif';
      var tw=ctx.measureText(it.text||'').width;
      var tx=tsX(p0.ts), ty=pY(p0.p);
      if(x>=tx-3&&x<=tx+tw+6&&Math.abs(y-ty)<10) return it;
    }
  }
  return null;
}
function hitHandle(it,x,y){
  for(var i=0;i<it.pts.length;i++){
    var pt=it.pts[i];
    var px=pt.ts!=null?tsX(pt.ts):(i===0?6:LAY.plotW-6);
    var py=pt.p!=null?pY(pt.p):(it.type==='vline'?6:pY(it.pts[0].p));
    if(it.type==='hline') px=x;
    if(it.type==='vline') py=y;
    if(Math.hypot(x-px,y-py)<8) return i;
  }
  return -1;
}

/* ---------- nuqta olish (magnet bilan) ---------- */
function pointAt(x,y){
  var ts=xTs(x), p=yP(y);
  if(D.magnet){
    var b=cur(), i=Math.round(iOf(x)); i=clamp(i,0,b.length-1);
    var cands=[b[i][1],b[i][2],b[i][3],b[i][4]], best=null, bd=1e9;
    for(var k=0;k<cands.length;k++){ var d=Math.abs(pY(cands[k])-y); if(d<bd){bd=d;best=cands[k];} }
    if(bd<9) p=best;
  }
  return {ts:ts,p:p};
}

/* ---------- interaksiya ---------- */
function evPos(e){
  var r=cv.getBoundingClientRect();
  return {x:e.clientX-r.left, y:e.clientY-r.top};
}
function onDown(e){
  if(e.button!==0) return;
  var q=evPos(e), x=q.x, y=q.y;
  if(x>LAY.plotW||y>H-LAY.timeH) return;
  cv.focus&&cv.focus();

  if(D.tool==='crosshair'||D.tool==='select'){
    var hit=hitTest(x,y);
    if(hit){
      D.sel=hit;
      D._undoLen=D.undoStack.length;
      var h=hitHandle(hit,x,y);
      var orig=hit.pts.map(function(pt){ return {sx:pt.ts!=null?tsX(pt.ts):null, sy:pt.p!=null?pY(pt.p):null}; });
      D.drag={item:hit,start:{x:x,y:y},orig:orig,mode:h>=0?('pt'+h):'move',moved:false};
      mark(); return;
    }
    D.sel=null;
    V.panning=true; V.panX=x; V.panOff=V.rightOffset; mark(); return;
  }
  /* chizish asbobi */
  var p=pointAt(x,y);
  if(!D.pending){
    if(D.tool==='hline'){ snapshot(); D.items.push(newItem('hline',[{ts:null,p:p.p}])); saveDrawings(); mark(); return; }
    if(D.tool==='vline'){ snapshot(); D.items.push(newItem('vline',[{ts:p.ts,p:null}])); saveDrawings(); mark(); return; }
    if(D.tool==='text'){
      var t=window.prompt('Matn:', '');
      if(t){ snapshot(); D.items.push(newItem('text',[p],{text:t})); saveDrawings(); }
      return;
    }
    D.pending={type:D.tool, pts:[p], cur:null, color:DRAW_COL};
    D._pressAt={x:x,y:y}; mark(); return;
  }
  var it=newItem(D.pending.type, [D.pending.pts[0], p]);
  snapshot(); D.items.push(it); saveDrawings();
  D.pending=null; D.sel=it; setTool('crosshair'); mark();
}
function onMove(e){
  var q=evPos(e), x=q.x, y=q.y;
  var inPlot=x>=0&&x<=LAY.plotW&&y>=0&&y<=H-LAY.timeH;
  V.cross=inPlot?{x:x,y:y}:null;
  if(D.drag){
    var dr=D.drag, dx=x-dr.start.x, dy=y-dr.start.y;
    if(Math.abs(dx)>1||Math.abs(dy)>1){
      if(!dr.moved){ dr.moved=true; snapshot(); }
    }
    var it=dr.item;
    for(var i=0;i<it.pts.length;i++){
      var o=dr.orig[i], pt=it.pts[i];
      if(pt.ts!=null && o.sx!=null) pt.ts=xTs(o.sx+dx);
      if(pt.p!=null && o.sy!=null) pt.p=yP(o.sy+dy);
    }
    mark();
  } else if(V.panning){
    var bars=(x-V.panX)/V.spacing;
    V.rightOffset=V.panOff+bars;
    clampOffset(); mark();
  } else if(D.pending){
    D.pending.cur=pointAt(x,y); mark();
  }
  if(V.cross) updateLegendForBar(Math.round(iOf(x)));
  else updateLegend();
}
function onUp(e){
  var q=null;
  if(e&&e.clientX!=null){ try{ q=evPos(e); }catch(err){ q=null; } }
  if(D.drag){
    if(!D.drag.moved && D._undoLen!=null) D.undoStack.length=D._undoLen;
    D.drag=null;
  }
  if(V.panning) V.panning=false;
  /* press-drag-release bilan chizish (click-click ham ishlaydi) */
  if(D.pending && D._pressAt && q && e && e.target===cv &&
     q.x>=0 && q.x<=LAY.plotW && q.y>=0 && q.y<=H-LAY.timeH){
    var ddx=q.x-D._pressAt.x, ddy=q.y-D._pressAt.y;
    if(Math.sqrt(ddx*ddx+ddy*ddy)>6){
      var it=newItem(D.pending.type,[D.pending.pts[0],pointAt(q.x,q.y)]);
      snapshot(); D.items.push(it); saveDrawings();
      D.pending=null; D._pressAt=null; D.sel=it; setTool('crosshair'); mark(); return;
    }
  }
  if(D._measuring){ D._measuring=false; }
}
function onLeave(){ V.cross=null; mark(); }
function clampOffset(){ V.rightOffset=clamp(V.rightOffset,-2,nBars()+40); }
function onWheel(e){
  e.preventDefault();
  var q=evPos(e), mx=q.x;
  if(mx>LAY.plotW) return;
  var idx=iOf(mx);
  var f=e.deltaY<0?1.14:1/1.14;
  setSpacing(V.spacing*f, idx, mx);
}
function setSpacing(s, idx, mx){
  s=clamp(s,1.2,44);
  V.spacing=s;
  if(idx!=null&&mx!=null){
    var ri=idx+0.5-(LAY.plotW-mx)/s;
    V.rightOffset=ri-(nBars()-1);
  }
  clampOffset(); mark();
}
function onDbl(){ fit(); }
function fit(){
  V.spacing=clamp(LAY.plotW/170,1.5,30);
  V.rightOffset=3; V.autoPrice=true; mark();
}
function bindCanvas(){
  cv.addEventListener('mousedown',onDown);
  window.addEventListener('mousemove',onMove);
  window.addEventListener('mouseup',onUp);
  cv.addEventListener('mouseleave',onLeave);
  cv.addEventListener('wheel',onWheel,{passive:false});
  cv.addEventListener('dblclick',onDbl);
  cv.addEventListener('contextmenu',function(e){ e.preventDefault(); });
}
function setTool(t){
  D.tool=t; D.pending=null;
  if(t!=='measure') D.measure=null;
  document.querySelectorAll('#rail .rbtn').forEach(function(b){
    b.classList.toggle('on', b.dataset.tool===t);
  });
  cv.style.cursor = (t==='crosshair'||t==='select')?'crosshair':(t==='text'?'text':'crosshair');
  mark();
}
function delSel(){
  if(!D.sel) return;
  snapshot();
  D.items=D.items.filter(function(it){ return it!==D.sel; });
  D.sel=null; saveDrawings(); mark();
}
function clearAll(){
  if(!D.items.length) return;
  if(!window.confirm('Barcha chizmalar o\'chirilsinmi?')) return;
  snapshot(); D.items=[]; D.sel=null; saveDrawings(); mark();
}
function bindKeys(){
  window.addEventListener('keydown',function(e){
    var tg=e.target||{};
    if(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.isContentEditable) return;
    var k=e.key;
    if((e.ctrlKey||e.metaKey)&&(k==='z'||k==='Z')){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); return; }
    if((e.ctrlKey||e.metaKey)&&(k==='y'||k==='Y')){ e.preventDefault(); redo(); return; }
    if(k==='Escape'){ D.pending=null; D.sel=null; D.measure=null; setTool('crosshair'); mark(); return; }
    if(k==='Delete'||k==='Backspace'){ if(D.sel){ e.preventDefault(); delSel(); } return; }
    if(k>='1'&&k<='7'){ setTF(TFS[parseInt(k,10)-1]); return; }
    var map={t:'trendline',r:'ray',h:'hline',v:'vline',b:'rect',x:'text',
             m:'measure',f:'fib',d:'daterange'};
    if(map[k]){ setTool(map[k]); return; }
    if(k==='ArrowLeft'){ V.rightOffset+=4; clampOffset(); mark(); }
    if(k==='ArrowRight'){ V.rightOffset-=4; clampOffset(); mark(); }
  });
}


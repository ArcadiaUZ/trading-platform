'use strict';
/* ==========================================================================
   XAUView demo — 1-fayl: ma'lumot, vaqt zonasi, Asia-FU 3-in-1 indikatori
   ========================================================================== */

var META = DATA.meta;
var ASSETS = DATA.symbols;                 /* {XAUUSD:{provider,digits,tfs:{...}}} */
var TFS = ['D1','H4','H1','M15','M5','M3','M1'];
var TF_SEC = {D1:86400,H4:14400,H1:3600,M15:900,M5:300,M3:180,M1:60};
var TZ_OFF = 5*3600;                       /* Toshkent UTC+5 */

/* ---------- sozlamalar ---------- */
var S = {
  sym:'XAUUSD', tf:'M1',
  theme:'dark',
  chartType:'candles',
  ind:{asia:true,kill:true,fu:true,sweep:true,fvg:true,cvd:true,dash:true},
  asiaStart:5, asiaEnd:11,            /* Toshkent soat */
  lonStart:11, lonMin:30, lonEnd:14,  /* London killzone 11:30-14:00 */
  nyStart:16, nyMin:30, nyEnd:19,     /* NY killzone 16:30-19:00 */
  maxAsianPipsGold:400, maxAsianPipsFx:60,
  fvgExtend:12,
  zoneTFs:['H4','H1'],                /* ustki TF zonalari */
  zoneLookback:180,                   /* nechta bar davomida zona qidiriladi */
  zoneMaxBars:20                      /* zona o'ng chegarasi: birth+20 bar */
};

var ZONE_COL = {D1:'#e879f9',H4:'#f59e0b',H1:'#38bdf8',M15:'#a78bfa',M5:'#34d399',M3:'#fb7185',M1:'#94a3b8'};
var DRAW_COL = '#2962ff';

/* ---------- yordamchi ---------- */
function pad2(n){ return (n<10?'0':'')+n; }
function dts(ts){ return new Date((ts+TZ_OFF)*1000); }         /* Toshkent devori vaqti (UTC getter bilan) */
function hh(ts){ return dts(ts).getUTCHours(); }
function hhmm(ts){ var d=dts(ts); return pad2(d.getUTCHours())+':'+pad2(d.getUTCMinutes()); }
function dayKey(ts){ var d=dts(ts); return d.getUTCFullYear()+'-'+pad2(d.getUTCMonth()+1)+'-'+pad2(d.getUTCDate()); }
function fmtDay(ts){ var d=dts(ts); return d.getUTCDate()+' '+MON[d.getUTCMonth()]; }
function fmtTime(ts,tf){
  if(tf==='D1') return fmtDay(ts)+' '+String(dts(ts).getUTCFullYear()).slice(2);
  if(tf==='H4') return pad2(dts(ts).getUTCDate())+' '+MON[dts(ts).getUTCMonth()]+' '+hhmm(ts);
  return pad2(dts(ts).getUTCDate())+' '+MON[dts(ts).getUTCMonth()]+' '+hhmm(ts);
}
var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function cur(){ return ASSETS[S.sym].tfs[S.tf]; }
function digits(){ return ASSETS[S.sym].digits; }
function pipOf(){ return S.sym==='XAUUSD' ? 0.1 : 0.0001; }
function fpx(p){ return Number(p).toFixed(digits()); }
function fpx2(p){ return Number(p).toFixed(digits()>3?5:digits()); }
function clamp(v,a,b){ return v<a?a:v>b?b:v; }

/* ---------- Asia sessiya qutilari (har kun) ---------- */
function asiaBoxes(bars){
  var out=[], curKey=null, box=null;
  for(var i=0;i<bars.length;i++){
    var b=bars[i], ts=b[0], h=dts(ts).getUTCHours(), mi=dts(ts).getUTCMinutes();
    var inAsia = (h>S.asiaStart)||(h===S.asiaStart) ? (h<S.asiaEnd) : false;
    /* D1/H4 da bar butun sessionni qamrab olmaydi — bar boshlanish soati bo'yicha */
    if(inAsia){
      var k=dayKey(ts);
      if(k!==curKey){
        if(box) out.push(box);
        curKey=k; box={key:k,i0:i,i1:i,high:b[2],low:b[3],ts0:ts};
      } else {
        box.i1=i; box.high=Math.max(box.high,b[2]); box.low=Math.min(box.low,b[3]);
      }
    } else if(box && dayKey(ts)===curKey && !inAsia){
      /* session tugadi — keyingi kungacha yopiq qoldiramiz, lekin quti davom etmaydi */
    }
  }
  if(box) out.push(box);
  return out;
}

/* ---------- FU / SFU / AFU zonalari (modul 2 porti) ---------- */
function computeZones(bars,tf){
  var z=[], n=bars.length;
  for(var i=2;i<n;i++){
    var b=bars[i], p=bars[i-1];
    var o=b[1],cl=b[4],hi=b[2],lo=b[3];
    var po=p[1],pcl=p[4],phi=p[2],plo=p[3];
    var body=Math.abs(cl-o), rng=Math.max(hi-lo,1e-9);
    var upWick=hi-Math.max(o,cl), loWick=Math.min(o,cl)-lo;
    var prevUp=phi-Math.max(po,pcl), prevLoWick=Math.min(po,pcl)-plo;
    var base=false,sfu=false,afu=false,bull=false;
    if(lo<plo && hi>phi && cl>o){ base=true; bull=true; }
    if(lo<plo && cl>phi){ sfu=true; bull=true; }
    if(base && body/rng<=0.30 && loWick>=1.5*body && loWick>upWick){ afu=true; }
    if(!bull && hi>phi && lo<plo && cl<o){ base=true; }
    if(!bull && hi>phi && cl<plo){ sfu=true; }
    if(!bull && base && body/rng<=0.30 && upWick>=1.5*body && upWick>loWick){ afu=true; }
    if(!(base||sfu||afu)) continue;
    var top,bottom;
    if(bull){ top=Math.min(o,cl); bottom=lo; } else { top=hi; bottom=Math.max(o,cl); }
    if(!(top>bottom)) continue;
    /* o'ng chegara: joriy TFda birth+zoneMaxBars, ustki TFda ham; birinchi tegishda to'xtaydi */
    var end=Math.min(n-1,i+S.zoneMaxBars), touch=null, broken=null;
    for(var j=i+1;j<n;j++){
      var jb=bars[j];
      if(jb[2]>=bottom && jb[3]<=top){ touch=j; break; }
      if(bull && jb[4]<bottom){ broken=j; break; }
      if(!bull && jb[4]>top){ broken=j; break; }
      if(j>=i+S.zoneMaxBars){ end=j; break; }
    }
    if(touch!==null) end=touch;
    if(end<=i) continue;
    z.push({i0:i,i1:end,top:top,bottom:bottom,bull:bull,tf:tf,
            kind:afu?'AFU':(sfu?'SFU':'FU'), broken:broken!==null});
  }
  /* juda uzoq o'tmishdagilarni tashlaymiz */
  var from=n-S.zoneLookback;
  return z.filter(function(x){ return x.i1>=from; });
}

/* ---------- sweep + FVG (modul 1) ---------- */
function sweepsFor(bars,boxes){
  var res=[];
  var byDay={};
  for(var i=0;i<bars.length;i++){ byDay[dayKey(bars[i][0])]=true; }
  for(var k=0;k<boxes.length;k++){
    var bx=boxes[k], hi=bx.high, lo=bx.low, found={hi:null,lo:null};
    for(var i=bx.i1+1;i<bars.length;i++){
      var b=bars[i];
      if(dayKey(b[0])!==bx.key) break;
      var h=dts(b[0]).getUTCHours();
      if(!(h>=S.asiaEnd)) continue;
      if(found.hi===null && b[2]>hi && b[4]<hi) found.hi=i;
      if(found.lo===null && b[3]<lo && b[4]>lo) found.lo=i;
      if(found.hi!==null && found.lo!==null) break;
    }
    if(found.hi!==null) res.push({i:found.hi,dir:'up',level:hi,box:bx});
    if(found.lo!==null) res.push({i:found.lo,dir:'dn',level:lo,box:bx});
  }
  return res;
}
function fvgsFor(bars,swp){
  var out=[];
  for(var s=0;s<swp.length;s++){
    var sw=swp[s], i=sw.i;
    for(var j=i;j<Math.min(i+3,bars.length-2);j++){
      var a=bars[j], c=bars[j+2];
      if(sw.dir==='dn' && a[3]>c[2]){ out.push({i0:j,i1:Math.min(j+S.fvgExtend,bars.length-1),top:a[3],bottom:c[2],bull:true}); break; }
      if(sw.dir==='up' && c[3]>a[2]){ out.push({i0:j,i1:Math.min(j+S.fvgExtend,bars.length-1),top:c[3],bottom:a[2],bull:false}); break; }
    }
  }
  return out;
}

/* ---------- CVD (modul 3: delta proxy) ---------- */
function cvdSeries(bars){
  var v=[], acc=0, base=0;
  for(var i=0;i<bars.length;i++){
    var b=bars[i], hi=b[2], lo=b[3], cl=b[4], vol=b[5];
    var rng=Math.max(hi-lo,1e-9);
    var delta=vol*(2*(cl-lo)/rng-1);
    acc+=delta;
    if(i===0) base=acc;
    v.push(acc);
  }
  /* nisbiy foizda ko'rsatamiz */
  var mn=Math.min.apply(null,v), mx=Math.max.apply(null,v);
  var rng=Math.max(Math.abs(mx),Math.abs(mn),1);
  return v.map(function(x){ return x/rng*100; });
}

/* darhol hisoblanadigan keshlar */
var CACHE = {};
function invalidate(){ CACHE={}; }
function getInd(sym,tf){
  var key=sym+'|'+tf;
  if(CACHE[key]) return CACHE[key];
  var bars=ASSETS[sym].tfs[tf];
  var boxes=asiaBoxes(bars);
  var swp=sweepsFor(bars,boxes);
  var zones=computeZones(bars,tf);
  var upper={};
  for(var k=0;k<S.zoneTFs.length;k++){
    var t=S.zoneTFs[k];
    if(!ASSETS[sym].tfs[t]) continue;
    upper[t]=computeZones(ASSETS[sym].tfs[t],t);
  }
  var cvd=cvdSeries(bars);
  var o={bars:bars,boxes:boxes,sweeps:swp,fvgs:fvgsFor(bars,swp),zones:zones,upper:upper,cvd:cvd};
  CACHE[key]=o;
  return o;
}

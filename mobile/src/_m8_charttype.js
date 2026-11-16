/* ==========================================================================
   v10: CHART TURLARI — sham / hollow / bar / chiziq / area
   drawCandles ni almashtiradi (oxirgi deklaratsiya ustun).
   ========================================================================== */
'use strict';

var CHART_TYPES = [
  ['candles', 'Shamlar', 'ic_chart_type_candles_28'],
  ['hollow', 'Hollow', 'ic_chart_type_hollow_candles_28'],
  ['bars', 'Barlar', 'ic_chart_type_bars_28'],
  ['line', 'Chiziq', 'ic_chart_type_baseline_28'],
  ['area', 'Area', 'ic_chart_type_area_28']
];

function chartTypeName(t){
  for (var i = 0; i < CHART_TYPES.length; i++) if (CHART_TYPES[i][0] === t) return CHART_TYPES[i][1];
  return 'Shamlar';
}
function setChartType(t){
  S.chartType = t || 'candles';
  try { localStorage.setItem('xauview.m.chart', S.chartType); } catch (e) {}
  updateLegend(); mark();
}
function chartSheet(){
  var h = '<div class="grid2">';
  CHART_TYPES.forEach(function(t){
    h += '<button class="opt' + (S.chartType === t[0] ? ' on' : '') + '" data-ct="' + t[0] + '">' + apkIcon(t[2], 'oi') + t[1] + '</button>';
  });
  h += '</div>';
  h += '<div class="hint">Chart turi tanlangan symbolga bogliq emas — barcha chartlar uchun amal qiladi. Volume pastda qoladi.</div>';
  openSheet('Chart turi', h, function(body){
    body.querySelectorAll('[data-ct]').forEach(function(b){
      b.addEventListener('click', function(){ setChartType(b.dataset.ct); closeSheet(); });
    });
  });
}

function drawCandles(b, v){
  var type = S.chartType || 'candles';
  var bw = Math.max(1, Math.round(V.spacing * 0.72));
  var thin = V.spacing < 2.2;
  var i, r, o, hh, ll, c, up, color, xc, top, hgt, first;
  if (type === 'line' || type === 'area') {
    ctx.save();
    if (type === 'area') {
      var grd = ctx.createLinearGradient(0, 0, 0, LAY.priceH);
      grd.addColorStop(0, 'rgba(41,98,255,.30)');
      grd.addColorStop(1, 'rgba(41,98,255,0)');
      ctx.beginPath();
      first = true;
      for (i = v.i0; i <= v.i1; i++) {
        xc = xOf(i); var ya = pY(b[i][4]);
        if (first) { ctx.moveTo(xc, ya); first = false; } else ctx.lineTo(xc, ya);
      }
      ctx.lineTo(xOf(v.i1), LAY.priceH);
      ctx.lineTo(xOf(v.i0), LAY.priceH);
      ctx.closePath();
      ctx.fillStyle = grd; ctx.fill();
    }
    ctx.beginPath();
    first = true;
    for (i = v.i0; i <= v.i1; i++) {
      xc = xOf(i); var yb = pY(b[i][4]);
      if (first) { ctx.moveTo(xc, yb); first = false; } else ctx.lineTo(xc, yb);
    }
    ctx.strokeStyle = col('--accent'); ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
    return;
  }
  if (type === 'bars') {
    var tick = Math.max(1, Math.round(bw / 2));
    for (i = v.i0; i <= v.i1; i++) {
      r = b[i]; o = r[1]; hh = r[2]; ll = r[3]; c = r[4];
      up = c >= o; color = up ? col('--up') : col('--down');
      xc = Math.round(xOf(i)) + .5;
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xc, Math.round(pY(hh)) + .5); ctx.lineTo(xc, Math.round(pY(ll)) + .5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xc - tick, Math.round(pY(o)) + .5); ctx.lineTo(xc, Math.round(pY(o)) + .5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xc, Math.round(pY(c)) + .5); ctx.lineTo(xc + tick, Math.round(pY(c)) + .5); ctx.stroke();
    }
    return;
  }
  for (i = v.i0; i <= v.i1; i++) {
    r = b[i]; o = r[1]; hh = r[2]; ll = r[3]; c = r[4];
    up = c >= o; color = up ? col('--up') : col('--down');
    xc = Math.round(xOf(i)) + .5;
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(xc, Math.round(pY(hh)) + .5); ctx.lineTo(xc, Math.round(pY(ll)) + .5); ctx.stroke();
    if (thin) continue;
    top = Math.min(pY(o), pY(c));
    hgt = Math.max(1, Math.abs(pY(c) - pY(o)));
    var bx = Math.round(xc - bw / 2);
    if (type === 'hollow') {
      ctx.fillStyle = col('--bg');
      ctx.fillRect(bx, Math.round(top), bw, Math.round(hgt));
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.strokeRect(bx + .5, Math.round(top) + .5, bw, Math.round(hgt));
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(bx, Math.round(top), bw, Math.round(hgt));
    }
  }
}

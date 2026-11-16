const fs=require('fs');
const base='D:\\Project\\AI\\tvclone\\mobile\\';
let h=fs.readFileSync(base+'src\\_m1_head.html','utf8');
h=h.replace('.badge{position:absolute;left:8px;top:44px;','.badge{position:absolute;right:60px;top:7px;');
fs.writeFileSync(base+'src\\_m1_head.html',h,'utf8');
const ov=[
'' ,
'/* ===== v2: feed race guard ===== */',
'function handleMsg(m){',
'  if (m.type === "alert") { onAlert(m.alert); return; }',
'  if (!m.symbol || !m.tf) return;',
'  if (m.symbol !== S.sym || m.tf !== S.tf) return;',
'  if (m.type === "snapshot") {',
'    if (!ASSETS[m.symbol]) return;',
'    if (m.digits != null) ASSETS[m.symbol].digits = m.digits;',
'    ASSETS[m.symbol].tfs[m.tf] = m.bars;',
'    V.autoPrice = true;',
'    invalidate(); fit(); updateLegend(); mark();',
'  } else if (m.type === "tick") {',
'    applyTick(m);',
'  }',
'}',
'function applyTick(m){',
'  if (!m || !m.bar) return;',
'  if (m.symbol && m.symbol !== S.sym) return;',
'  if (m.tf && m.tf !== S.tf) return;',
'  var b = m.bar;',
'  var bars = ASSETS[S.sym] && ASSETS[S.sym].tfs[S.tf];',
'  LAST.bid = m.bid; LAST.ask = m.ask; LAST.t = m.time;',
'  if (!bars || !bars.length) { if (ASSETS[S.sym]) ASSETS[S.sym].tfs[S.tf] = [b]; mark(); return; }',
'  var last = bars[bars.length - 1];',
'  if (b[0] > last[0]) { bars.push(b); if (bars.length > 4000) bars.shift(); }',
'  else if (b[0] === last[0]) {',
'    last[1] = b[1]; last[2] = Math.max(last[2], b[2]); last[3] = Math.min(last[3], b[3]); last[4] = b[4]; last[5] = b[5];',
'  }',
'  if (!V.cross) updateLegend();',
'  mark();',
'}',
''].join('\n');
fs.appendFileSync(base+'src\\_m4_ui.js', ov, 'utf8');
console.log('feed guard appended');
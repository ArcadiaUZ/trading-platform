
const fs=require('fs');
const base='D:\\Project\\AI\\tvclone\\mobile\\';
const src=base+'src\\';
const head=fs.readFileSync(src+'_m1_head.html','utf8');
const data=fs.readFileSync(base+'data.json','utf8');
const parts=['_p2_ind.js','_m3_chart.js','_m4_ui.js','_m5_feed.js','_m6_pwa.js','_m7_alerts.js','_m8_charttype.js','_m9_style.js','_m11_icons.js','_m10_open.js','_m12_direct.js','_m13_gestures.js','_m14_trade.js'].map(f=>fs.readFileSync(src+f,'utf8'));
const js=parts.join('\n\n');
const out=head+'\n<script>\nvar DATA='+data+';\n'+js+'\n</script>\n</body>\n</html>\n';
fs.writeFileSync(base+'index.html',out,'utf8');
console.log('mobile index.html:',(out.length/1024).toFixed(1),'KB');
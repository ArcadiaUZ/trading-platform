const fs=require('fs');
const base='D:\\Project\\AI\\tvclone\\mobile\\src\\';
let f=fs.readFileSync(base+'_m4_ui.js','utf8');
const i=f.indexOf('/* ===== v3: connection generation guard');
if(i>=0){ f=f.slice(0,i).replace(/\s+$/,'')+'\n'; fs.writeFileSync(base+'_m4_ui.js',f,'utf8'); console.log('truncated at',i); }
else console.log('marker topilmadi');
let a=fs.readFileSync(base+'assemble.js','utf8');
a=a.replace("['_p2_ind.js','_m3_chart.js','_m4_ui.js']","['_p2_ind.js','_m3_chart.js','_m4_ui.js','_m5_feed.js']");
fs.writeFileSync(base+'assemble.js',a,'utf8');
console.log('assemble updated');
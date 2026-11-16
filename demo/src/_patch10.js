
const fs=require('fs');
const src='D:\\Project\\AI\\tvclone\\demo\\src\\';
const f=src+'_p3_engine.js';
let e=fs.readFileSync(f,'utf8');
const a='    if(x1-x0<64 && !isLast) continue;';
const b='    if(x1-x0<64 && !isLast) continue;\n    if(x0<352 && yh<72) continue;';
const n=e.split(a).length-1;
e=e.split(a).join(b);
fs.writeFileSync(f,e,'utf8');
console.log('legend-guard qoshildi:',n);

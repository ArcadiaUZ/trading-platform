const fs=require('fs');
const f='D:\\Project\\AI\\tvclone\\mobile\\src\\_m4_ui.js';
let s=fs.readFileSync(f,'utf8');
const parts=s.split('\n');
let cut=-1;
for(let i=0;i<parts.length;i++){ if(parts[i].indexOf("'' ,")>=0){ cut=i; break; } }
if(cut>=0){ s=parts.slice(0,cut).join('\n')+'\n'; fs.writeFileSync(f,s,'utf8'); console.log('cut at line',cut); }
else console.log('not found; tail:');
console.log(s.slice(-260));
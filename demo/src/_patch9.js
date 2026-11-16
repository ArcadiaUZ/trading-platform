
const fs=require('fs');
const src='D:\\Project\\AI\\tvclone\\demo\\src\\';
const f=src+'_p3_engine.js';
let e=fs.readFileSync(f,'utf8');
const a='    if(ly<10) ly=10;';
const b='    if(ly<52) ly=yl+9;';
const n=e.split(a).length-1;
e=e.split(a).join(b);
fs.writeFileSync(f,e,'utf8');
console.log('replaced',n,'occurrence(s)');

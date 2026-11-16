
const fs=require('fs');
const src='D:\\Project\\AI\\tvclone\\demo\\src\\';
let u=fs.readFileSync(src+'_p5_ui.js','utf8');
const before=u.length;
u=u.replace('var cvd=ind.cvd[b?b.length-1:0]||0;','var cvd=ind.cvd[ind.cvd.length-1]||0;');
u=u.replace('var cvd=ind.cvd[b?b.length-1:0]||0;','var cvd=ind.cvd[ind.cvd.length-1]||0;');
fs.writeFileSync(src+'_p5_ui.js',u,'utf8');
console.log('fixed', before, '->', u.length);

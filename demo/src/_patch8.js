
const fs=require('fs');
const src='D:\\Project\\AI\\tvclone\\demo\\src\\';
let e=fs.readFileSync(src+'_p3_engine.js','utf8');
/* Asia label legend bilan to'qnashmasin: yuqorida joy bo'lmasa — quti ostiga */
e=e.replace("    var lx=clamp(x0+2,2,Math.max(2,LAY.plotW-w-4)), ly=yh-8;\n    if(ly<10) ly=10;",
            "    var lx=clamp(x0+2,2,Math.max(2,LAY.plotW-w-4)), ly=yh-8;\n    if(ly<52) ly=yl+9;");
fs.writeFileSync(src+'_p3_engine.js',e,'utf8');
console.log('patch8 ok');

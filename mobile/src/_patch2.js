
const fs=require('fs');
const f='D:\\Project\\AI\\tvclone\\mobile\\src\\_m3_chart.js';
let c=fs.readFileSync(f,'utf8');
c=c.replace("    rect(x0, yh, x1 - x0, yl - yh, null, col('--asiaB'), 1);",
            "    if (x1 < LAY.plotW - 2 && x0 > -2) rect(x0, yh, x1 - x0, yl - yh, null, col('--asiaB'), 1);\n    else { line(x0, yh, Math.min(x1, LAY.plotW), yh, col('--asiaB'), 1); line(x0, yl, Math.min(x1, LAY.plotW), yl, col('--asiaB'), 1); }");
fs.writeFileSync(f,c,'utf8');
console.log('asia border fix ok');

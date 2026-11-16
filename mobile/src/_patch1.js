
const fs=require('fs');
const base='D:\\Project\\AI\\tvclone\\mobile\\';
/* 1) badge joyi */
let h=fs.readFileSync(base+'src\\_m1_head.html','utf8');
h=h.replace('.badge{position:absolute;right:60px;top:7px;','.badge{position:absolute;left:8px;top:44px;');
fs.writeFileSync(base+'src\\_m1_head.html',h,'utf8');
/* 2) Asia label: ko'rinmayotgan quti uchun label chizmaslik */
let c=fs.readFileSync(base+'src\\_m3_chart.js','utf8');
c=c.replace("    if (lx < 210 && ly < 52) ly = yl + 8;",
            "    if (lx < 210 && ly < 52) ly = yl + 8;\n    if (yl > LAY.priceH - 6) continue;");
fs.writeFileSync(base+'src\\_m3_chart.js',c,'utf8');
console.log('mobile patch ok');


const fs=require('fs');
const base='D:\\Project\\AI\\tvclone\\demo\\';
const src=base+'src\\';
const head=fs.readFileSync(src+'_p1_head.html','utf8');
const data=fs.readFileSync(base+'data.json','utf8');
const parts=['_p2_ind.js','_p3_engine.js','_p4_draw.js','_p5_ui.js'].map(f=>fs.readFileSync(src+f,'utf8'));
let js=parts.join('\n\n');
const out=head+'\n<script>\nvar DATA='+data+';\n'+js+'\n</script>\n</body>\n</html>\n';
fs.writeFileSync(base+'xauview-demo.html',out,'utf8');
console.log('assembled',(out.length/1024).toFixed(1),'KB  parts:',parts.length);


const fs=require('fs');
const base='D:\\Project\\AI\\tvclone\\demo\\';
const src=base+'src\\';
const rw=f=>fs.readFileSync(src+f,'utf8');
const wr=(f,s)=>fs.writeFileSync(src+f,s,'utf8');

/* ---- CSS: o'lchangan "app" tema ---- */
let h=rw('_p1_head.html');
const appTheme=[
'body.apptheme{',
'  --bg:#000000; --panel:#0F0F0F; --panel2:#1F1F1F; --border:#2E2E2E; --border2:#4A4A4A;',
'  --text:#DBDBDB; --text2:#B8B8B8; --text3:#8C8C8C; --hover:#1F1F1F;',
'  --up:#22AB94; --down:#F7525F; --accent:#2962FF; --cross:#8C8C8C;',
'  --upF:rgba(34,171,148,.10); --downF:rgba(247,82,95,.10);',
'  --shadow:0 8px 28px rgba(0,0,0,.7);',
'  --asiaF:rgba(99,102,241,.05); --asiaB:rgba(129,140,248,.5);',
'  --lonF:rgba(59,130,246,.045); --nyF:rgba(249,115,22,.045);',
'}',
'body.apptheme #dash{background:rgba(15,15,15,.9)}',
'body.apptheme .tooltip{background:rgba(15,15,15,.96)}',
''].join('\n');
h=h.replace('*{box-sizing:border-box;margin:0;padding:0}', appTheme+'\n*{box-sizing:border-box;margin:0;padding:0}');
wr('_p1_head.html',h);

/* ---- tema sikli (dark -> light -> app) ---- */
let u=rw('_p5_ui.js');
const oldListener=[
"  document.getElementById('themeBtn').addEventListener('click',function(){",
"    document.body.classList.toggle('light');",
"    S.theme=document.body.classList.contains('light')?'light':'dark';",
"    readVars(); mark();",
"  });"].join('\n');
const newListener=[
"  document.getElementById('themeBtn').addEventListener('click',function(){",
"    var order=['dark','light','app'];",
"    var i=order.indexOf(S.theme); if(i<0) i=0;",
"    applyTheme(order[(i+1)%order.length]);",
"  });"].join('\n');
if(u.indexOf(oldListener)<0) throw new Error('theme listener topilmadi');
u=u.replace(oldListener,newListener);

/* applyTheme funksiyasi + init */
u=u.replace('/* ---------- init ---------- */',
"function applyTheme(t){\n" +
"  document.body.classList.remove('light','apptheme');\n" +
"  if(t==='light') document.body.classList.add('light');\n" +
"  if(t==='app') document.body.classList.add('apptheme');\n" +
"  S.theme=t; readVars(); mark();\n" +
"  var b=document.getElementById('themeBtn');\n" +
"  if(b){ b.title='Tema: '+t+' (bosib almashtir)'; b.textContent = (t==='light')?'\\u2600':(t==='app'?'\\u25C9':'\\u263E'); }\n" +
"}\n\n/* ---------- init ---------- */");

u=u.replace("  if(sv&&sv.theme===\"light\"){ document.body.classList.add(\"light\"); S.theme=\"light\"; readVars(); }",
            "  if(sv&&sv.theme===\"app\"){ document.body.classList.add(\"apptheme\"); S.theme=\"app\"; readVars(); }\n" +
            "  if(sv&&sv.theme===\"light\"){ document.body.classList.add(\"light\"); S.theme=\"light\"; readVars(); }");
wr('_p5_ui.js',u);
console.log('patch7 ok');

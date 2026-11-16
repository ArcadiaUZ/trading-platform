const fs=require('fs');
const h=fs.readFileSync('D:\\Project\\AI\\tvclone\\mobile\\index.html','utf8');
const i=h.indexOf('<script>')+8, j=h.lastIndexOf('</script>');
const js=h.slice(i,j);
fs.writeFileSync('D:\\Project\\AI\\tvclone\\mobile\\_check.js',js,'utf8');
console.log('extracted',js.length);
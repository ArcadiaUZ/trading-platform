const fs=require('fs');
const h=fs.readFileSync('D:\\Project\\AI\\tvclone\\mobile\\index.html','utf8');
const keys=['ic_curve_drawings','ic_highlighter_drawings','ic_parallel_channel_drawings','ic_horizontal_ray_drawings','ic_extended_line_drawings','ic_drawing_locked_drawings','ic_remove_drawings','ic_polyline_drawings'];
keys.forEach(k=>console.log(k, h.includes('"'+k+'"')?'ok':'MISSING'));

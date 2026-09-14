const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const core = fs.readFileSync(path.join(root,'src/catalog.cjs'),'utf8');
const template = fs.readFileSync(path.join(root,'src/ui.html'),'utf8');
fs.writeFileSync(path.join(root,'plugin/ui.html'),template.replace('/* CORE */',()=>core));
console.log('Built plugin/ui.html');

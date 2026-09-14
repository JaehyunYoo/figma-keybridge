const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'.build'),{recursive:true});
execFileSync(process.execPath,[path.join(root,'node_modules/@tailwindcss/cli/dist/index.mjs'),'-i',path.join(root,'src/styles.css'),'-o',path.join(root,'.build/ui.css'),'--minify'],{cwd:root,stdio:'inherit'});
const result=esbuild.buildSync({entryPoints:[path.join(root,'src/app.tsx')],bundle:true,write:false,minify:true,format:'iife',platform:'browser',target:['es2020'],jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const css=fs.readFileSync(path.join(root,'.build/ui.css'),'utf8');
fs.writeFileSync(path.join(root,'plugin/ui.html'),`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Keybridge</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`);
console.log('Built self-contained shadcn/React plugin UI');

#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path');
const core = require('../src/catalog.cjs');
const [command, ...args] = process.argv.slice(2);
const opt = name => {const i=args.indexOf('--'+name);return i<0?undefined:args[i+1];};
function read(file){if(!file)throw new Error('입력 파일이 필요합니다.');return core.parse(fs.readFileSync(file,'utf8'));}
function write(file, content){if(!file)throw new Error('--out 경로가 필요합니다.');fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});fs.writeFileSync(file,content);}
try {
 if(command==='check'){const c=read(args[0]);core.exportJson(c,{allowDraft:args.includes('--allow-draft'),locales:opt('locales')?.split(',')});console.log('카탈로그 검사 통과');}
 else if(command==='export'){
  const c=read(args[0]);const result=core.exportJson(c,{allowDraft:args.includes('--allow-draft'),locales:opt('locales')?.split(',')});
  const out=opt('out');if(!out)throw new Error('--out 디렉터리가 필요합니다.');
  for(const [locale,values] of Object.entries(result))write(path.join(out,locale+'.json'),JSON.stringify(values,null,2)+'\n');
  console.log('생성: '+Object.keys(result).join(', '));
 }
 else if(command==='merge'){const result=core.merge(read(args[0]),read(args[1]));write(opt('out'),core.stringify(result.catalog));console.log(JSON.stringify(result.report,null,2));}
 else if(command==='accept'){write(opt('out'),core.stringify(core.accept(read(args[0]),opt('key'))));console.log('원문 변경을 적용했습니다. 원문·번역은 재검수 상태입니다.');}
 else if(command==='init'){
  const locale=opt('locale')||'ko', input=JSON.parse(fs.readFileSync(args[0],'utf8'));
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('평면 JSON 객체가 필요합니다.');
  const entries=Object.entries(input).map(([key,source])=>({key,source,status:'draft',translations:{},refs:[]}));
  write(opt('out'),core.stringify({schema:'keybridge/v1',sourceLocale:locale,entries}));console.log('기존 키를 가져왔습니다. 상태는 draft입니다.');
 }
 else {console.log(`Keybridge CLI (Node 20+)\n\ninit ko.json --locale ko --out catalog.md\ncheck catalog.md [--allow-draft] [--locales ko,en]\nexport catalog.md --out locales [--allow-draft] [--locales ko,en]\nmerge catalog.md figma.md --out merged.md\naccept catalog.md --key checkout.payButton --out reviewed.md\n\n기본 내보내기는 approved만 허용합니다. --allow-draft는 개발용입니다.\n지원: 평면 key-value JSON, {name}/{{name}} 변수. ICU/ARB는 별도 어댑터가 필요합니다.`); if(command)process.exitCode=1;}
} catch(e){console.error(e.message);process.exitCode=1;}

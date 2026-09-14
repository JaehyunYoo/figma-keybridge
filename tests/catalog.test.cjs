const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const C=require('../src/catalog.cjs');
const ref={documentId:'doc1',nodeId:'1:2',page:'Checkout',frame:'Pay'};
function base(){return {schema:'keybridge/v1',sourceLocale:'ko',entries:[{key:'checkout.payButton',source:'결제 {amount}',status:'approved',translations:{en:{value:'Pay {amount}',status:'approved'}},refs:[ref]}]};}
function incoming(source='결제하기 {amount}') {return C.fromRows([{key:'checkout.payButton',text:source,ref}], 'ko');}
test('Markdown round trip preserves multiline, quotes, markdown fences, Unicode and literal escapes',()=>{const c=base();c.entries[0].source='안녕\n```\n| "quote" \\path\n</script>';assert.deepEqual(C.parse(C.stringify(c)),c);});
test('malformed or duplicate catalog blocks fail',()=>{assert.throws(()=>C.parse('hello'));assert.throws(()=>C.parse(C.stringify(base())+C.stringify(base())));});
test('merge protects reviewed content and translations, queues source change',()=>{const old=base(),r=C.merge(old,incoming());assert.equal(r.catalog.entries[0].source,old.entries[0].source);assert.deepEqual(r.catalog.entries[0].translations,old.entries[0].translations);assert.equal(r.catalog.entries[0].pendingSource,'결제하기 {amount}');assert.equal(old.entries[0].pendingSource,undefined);});
test('selection export never deletes absent entries',()=>{const r=C.merge(base(),{schema:'keybridge/v1',sourceLocale:'ko',entries:[]});assert.equal(r.catalog.entries.length,1);assert.deepEqual(r.report.retained,['checkout.payButton']);});
test('accept source invalidates approvals in every language',()=>{const c=C.accept(C.merge(base(),incoming()).catalog,'checkout.payButton');assert.equal(c.entries[0].source,'결제하기 {amount}');assert.equal(c.entries[0].status,'needs-review');assert.equal(c.entries[0].translations.en.status,'needs-review');assert.equal(c.entries[0].pendingSource,undefined);});
test('pending source prevents even development export',()=>{assert.throws(()=>C.exportJson(C.merge(base(),incoming()).catalog,{allowDraft:true}),/미해결/);});
test('release rejects drafts, development can include them',()=>{const c=base();c.entries[0].status='draft';assert.throws(()=>C.exportJson(c),/draft/);assert.equal(C.exportJson(c,{allowDraft:true}).ko['checkout.payButton'],'결제 {amount}');});
test('missing explicit target locale and mismatching placeholders fail',()=>{assert.throws(()=>C.exportJson(base(),{locales:['ko','ja']}),/누락/);const c=base();c.entries[0].translations.en.value='Pay {price}';assert.throws(()=>C.exportJson(c),/불일치/);});
test('duplicate keys and conflicting shared-key text fail',()=>{const c=base();c.entries.push(c.entries[0]);assert.throws(()=>C.validate(c),/중복/);assert.throws(()=>C.fromRows([{key:'a',text:'one',ref},{key:'a',text:'two',ref}],'ko'),/서로 다른/);});
test('same key same text keeps both Figma references',()=>{const c=C.fromRows([{key:'a',text:'확인',ref},{key:'a',text:'확인',ref:{...ref,nodeId:'1:3'}}],'ko');assert.equal(c.entries.length,1);assert.equal(c.entries[0].refs.length,2);});
test('reserved keys and locale path traversal fail',()=>{const c=base();c.entries[0].key='x.__proto__.z';assert.throws(()=>C.validate(c));assert.throws(()=>C.exportJson(base(),{locales:['../../en']}));});
test('unsupported ICU is rejected, not silently mistranslated',()=>{const c=base();c.entries[0].source='{count, plural, one {one} other {many}}';assert.throws(()=>C.exportJson(c),/ICU/);});
test('CLI emits deterministic flat UTF-8 JSON and no files on validation failure',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'keybridge-'));try{
 const md=path.join(dir,'c.md'),out=path.join(dir,'out');fs.writeFileSync(md,C.stringify(base()));
 const cli=path.resolve(__dirname,'../scripts/catalog.cjs');
 const r=spawnSync(process.execPath,[cli,'export',md,'--out',out,'--locales','ko,en'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(fs.readFileSync(path.join(out,'en.json'),'utf8'))['checkout.payButton'],'Pay {amount}');
 const badOut=path.join(dir,'bad');const bad=spawnSync(process.execPath,[cli,'export',md,'--out',badOut,'--locales','ko,ja'],{encoding:'utf8'});assert.equal(bad.status,1);assert.equal(fs.existsSync(badOut),false);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}});
function mockFigma(){
 const messages=[],rootData={},nodeData={};
 const node={id:'1:2',type:'TEXT',name:'Payment',characters:'결제',parent:{name:'Checkout',type:'FRAME'},getPluginData:k=>nodeData[k]||'',setPluginData:(k,v)=>{nodeData[k]=v;}};
 const figma={showUI(){},root:{getPluginData:k=>rootData[k]||'',setPluginData:(k,v)=>{rootData[k]=v;}},currentPage:{name:'Page',selection:[node],children:[node]},ui:{postMessage:m=>messages.push(m)},getNodeByIdAsync:async()=>node,notify(){},commitUndo(){},viewport:{scrollAndZoomIntoView(){}}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../plugin/code.js'),'utf8'),{figma,__html__:''});return {figma,node,messages,nodeData};
}
test('Figma scan/save persists stable key without changing displayed text',async()=>{const {figma,node,messages,nodeData}=mockFigma();await figma.ui.onmessage({type:'scan',scope:'selection'});assert.equal(messages[0].rows.length,1);await figma.ui.onmessage({type:'save',rows:[{id:'1:2',key:'checkout.payButton'}]});assert.equal(nodeData['keybridge.key'],'checkout.payButton');assert.equal(node.characters,'결제');node.characters='결제하기';await figma.ui.onmessage({type:'scan',scope:'selection'});assert.equal(messages.at(-1).rows[0].key,'checkout.payButton');});
test('concurrent text change blocks stale metadata write',async()=>{const {figma,node,messages,nodeData}=mockFigma();await figma.ui.onmessage({type:'scan',scope:'selection'});node.characters='다른 문구';await figma.ui.onmessage({type:'save',rows:[{id:'1:2',key:'checkout.payButton'}]});assert.equal(messages.at(-1).type,'error');assert.equal(nodeData['keybridge.key'],undefined);});
test('built UI scripts have valid JS syntax',()=>{const html=fs.readFileSync(path.resolve(__dirname,'../plugin/ui.html'),'utf8');for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);});

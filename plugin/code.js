/* Figma sandbox: changes metadata only, never displayed text. */
figma.showUI(__html__, {width: 680, height: 720, themeColors: true});
const DATA = 'keybridge.key';
const DOC = 'keybridge.documentId';
const KEY = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/;
let currentRows = [];
function documentId() {
  let id = figma.root.getPluginData(DOC);
  if (!id) { id = 'doc_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,10); figma.root.setPluginData(DOC, id); }
  return id;
}
function collect(roots) {
  const found = new Map();
  function walk(node) {
    if (node.type === 'TEXT') found.set(node.id, node);
    if ('children' in node) for (const child of node.children) walk(child);
  }
  for (const root of roots) walk(root);
  return [...found.values()];
}
function scan(scope) {
  const roots = scope === 'page' ? figma.currentPage.children : figma.currentPage.selection;
  if (!roots.length) throw new Error('Figma에서 프레임 또는 텍스트를 먼저 선택하세요.');
  const docId = documentId();
  currentRows = collect(roots).map(n => {
    let frame = n.parent;
    while (frame && !['FRAME','COMPONENT','INSTANCE','PAGE'].includes(frame.type)) frame = frame.parent;
    return {id:n.id, key:n.getPluginData(DATA), name:n.name, text:n.characters,
      ref:{documentId:docId, nodeId:n.id, page:figma.currentPage.name, frame:frame ? frame.name : ''}};
  });
  figma.ui.postMessage({type:'rows', rows:currentRows});
}
figma.ui.onmessage = async msg => {
  try {
    if (msg.type === 'scan') scan(msg.scope);
    if (msg.type === 'save') {
      const allowed = new Set(currentRows.map(r => r.id));
      const mutations = [];
      for (const r of msg.rows) {
        if (!allowed.has(r.id)) throw new Error('다시 텍스트를 불러온 뒤 저장하세요.');
        if (r.key && (!KEY.test(r.key) || r.key.split('.').some(p => ['__proto__','prototype','constructor'].includes(p)))) throw new Error('키 형식 오류: ' + r.key);
        const node = await figma.getNodeByIdAsync(r.id);
        if (!node || node.type !== 'TEXT') throw new Error('삭제된 텍스트가 있습니다. 다시 불러오세요.');
        const oldRow = currentRows.find(x => x.id === r.id);
        if (node.characters !== oldRow.text || node.getPluginData(DATA) !== oldRow.key) throw new Error('다른 작업으로 문구 또는 키가 변경되었습니다. 다시 불러오세요.');
        mutations.push({node,key:r.key});
      }
      const sources = new Map();
      for (const {node,key} of mutations) {
        if (!key) continue;
        if (sources.has(key) && sources.get(key) !== node.characters) throw new Error(key + ': 선택 영역 안에 서로 다른 문구가 있습니다. 키를 분리하세요.');
        sources.set(key,node.characters);
      }
      for (const {node,key} of mutations) node.setPluginData(DATA,key);
      currentRows = currentRows.map(r => {
        const m = mutations.find(x => x.node.id === r.id);
        return m ? Object.assign({},r,{key:m.key}) : r;
      });
      figma.commitUndo();
      figma.ui.postMessage({type:'rows',rows:currentRows});
      figma.notify('키 연결을 저장했습니다.');
    }
    if (msg.type === 'focus') {
      const n = await figma.getNodeByIdAsync(msg.id);
      if (n && n.type === 'TEXT') { figma.currentPage.selection = [n]; figma.viewport.scrollAndZoomIntoView([n]); }
    }
  } catch (e) { figma.ui.postMessage({type:'error',message:e.message}); }
};

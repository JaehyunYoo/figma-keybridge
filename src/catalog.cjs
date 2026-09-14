/* Shared by Node CLI and the Figma iframe. No third-party dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Keybridge = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEY = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/;
  const LOCALE = /^[A-Za-z]{2,8}(?:[-_][A-Za-z0-9]{2,8})*$/;
  const STATES = ['draft', 'approved', 'needs-review'];
  const copy = x => JSON.parse(JSON.stringify(x));
  function assert(ok, message) { if (!ok) throw new Error(message); }
  function validate(c) {
    assert(c && c.schema === 'keybridge/v1', '지원하지 않는 스키마입니다.');
    assert(LOCALE.test(c.sourceLocale), 'sourceLocale 형식이 올바르지 않습니다.');
    assert(Array.isArray(c.entries), 'entries 배열이 필요합니다.');
    const keys = new Set();
    for (const e of c.entries) {
      assert(e && typeof e.key === 'string' && KEY.test(e.key), `잘못된 키: ${e && e.key}`);
      assert(!e.key.split('.').some(p => ['__proto__','constructor','prototype'].includes(p)), `예약어 키: ${e.key}`);
      assert(!keys.has(e.key), `중복 키: ${e.key}`); keys.add(e.key);
      assert(typeof e.source === 'string', `${e.key}: source 문자열이 필요합니다.`);
      assert(STATES.includes(e.status), `${e.key}: 잘못된 status`);
      assert(e.translations && typeof e.translations === 'object' && !Array.isArray(e.translations), `${e.key}: translations 객체가 필요합니다.`);
      for (const [locale, t] of Object.entries(e.translations)) {
        assert(LOCALE.test(locale) && locale !== c.sourceLocale, `${e.key}: 잘못된 번역 언어 ${locale}`);
        assert(t && typeof t.value === 'string' && STATES.includes(t.status), `${e.key}/${locale}: value 및 status 필요`);
      }
      assert(Array.isArray(e.refs), `${e.key}: refs 배열 필요`);
      for (const r of e.refs) assert(r && typeof r.documentId === 'string' && typeof r.nodeId === 'string', `${e.key}: 잘못된 화면 연결`);
      if ('pendingSource' in e) assert(typeof e.pendingSource === 'string', `${e.key}: pendingSource 문자열 필요`);
    }
    return c;
  }
  function parse(md) {
    const blocks = [...md.matchAll(/^```keybridge\s*\r?\n([\s\S]*?)^```\s*$/gm)];
    assert(blocks.length === 1, 'MD에 정확히 하나의 ```keybridge JSON 블록이 필요합니다.');
    let c; try { c = JSON.parse(blocks[0][1]); } catch (e) { throw new Error(`MD JSON 파싱 실패: ${e.message}`); }
    return validate(c);
  }
  function stringify(c) {
    validate(c);
    const sorted = copy(c); sorted.entries.sort((a,b) => a.key.localeCompare(b.key));
    return '# Keybridge 문구 카탈로그\n\n이 파일이 문구의 원본입니다. JSON은 자동 생성합니다.\n' +
      'status: draft / approved / needs-review. pendingSource는 Figma의 변경 제안입니다.\n\n' +
      '```keybridge\n' + JSON.stringify(sorted, null, 2) + '\n```\n';
  }
  function merge(base, incoming) {
    validate(base); validate(incoming);
    assert(base.sourceLocale === incoming.sourceLocale, '기준 언어가 서로 다릅니다.');
    const result = copy(base), byKey = new Map(result.entries.map(e => [e.key,e]));
    const report = {added: [], changed: [], unchanged: [], retained: []};
    const incomingKeys = new Set();
    for (const item of incoming.entries) {
      incomingKeys.add(item.key);
      const prev = byKey.get(item.key);
      if (!prev) {
        const fresh = copy(item); fresh.status = 'draft';
        for (const t of Object.values(fresh.translations)) t.status = 'draft';
        result.entries.push(fresh); report.added.push(item.key); continue;
      }
      const refs = new Map(prev.refs.map(r => [r.documentId + '/' + r.nodeId, r]));
      for (const r of item.refs) refs.set(r.documentId + '/' + r.nodeId, copy(r));
      prev.refs = [...refs.values()];
      if (prev.source !== item.source) {
        prev.pendingSource = item.source; report.changed.push(item.key);
      } else {
        delete prev.pendingSource; report.unchanged.push(item.key);
      }
    }
    for (const e of base.entries) if (!incomingKeys.has(e.key)) report.retained.push(e.key);
    return {catalog: result, report};
  }
  function accept(c, key) {
    validate(c); const result = copy(c), e = result.entries.find(x => x.key === key);
    assert(e && 'pendingSource' in e, `${key}: 승인할 원문 변경 제안이 없습니다.`);
    e.source = e.pendingSource; delete e.pendingSource; e.status = 'needs-review';
    for (const t of Object.values(e.translations)) t.status = 'needs-review';
    return result;
  }
  function placeholders(value) {
    // Plain {name} and {{name}} only. ICU plural/select requires a dedicated adapter.
    return [...new Set([...value.matchAll(/\{\{?([A-Za-z_][A-Za-z0-9_]*)\}\}?/g)].map(m => m[1]))].sort().join(',');
  }
  function exportJson(c, options = {}) {
    validate(c);
    const locales = options.locales || [...new Set([c.sourceLocale, ...c.entries.flatMap(e => Object.keys(e.translations))])].sort();
    assert(locales.length > 0 && locales.every(l => LOCALE.test(l)), '유효한 locale 목록이 필요합니다.');
    const outputs = {}, errors = [];
    for (const locale of locales) outputs[locale] = Object.create(null);
    for (const e of [...c.entries].sort((a,b) => a.key.localeCompare(b.key))) {
      if ('pendingSource' in e) errors.push(`${e.key}: 미해결 원문 변경 제안`);
      if (/\{\s*\w+\s*,\s*(plural|select|selectordinal)\s*,/.test(e.source)) errors.push(`${e.key}: ICU 복수형/선택 구문은 v1에서 지원하지 않습니다.`);
      for (const locale of locales) {
        const t = locale === c.sourceLocale ? {value:e.source, status:e.status} : e.translations[locale];
        if (!t) { errors.push(`${e.key}/${locale}: 번역 누락`); continue; }
        if (!options.allowDraft && t.status !== 'approved') errors.push(`${e.key}/${locale}: ${t.status}`);
        if (placeholders(t.value) !== placeholders(e.source)) errors.push(`${e.key}/${locale}: 변수 불일치`);
        outputs[locale][e.key] = t.value;
      }
    }
    assert(!errors.length, errors.join('\n'));
    return outputs;
  }
  function fromRows(rows, sourceLocale) {
    const entries = new Map();
    for (const row of rows) {
      assert(row.key, `키가 없는 텍스트: ${row.name}`);
      const existing = entries.get(row.key);
      if (existing) {
        assert(existing.source === row.text, `${row.key}: 같은 키에 서로 다른 문구가 연결되어 있습니다.`);
        existing.refs.push(row.ref);
      } else entries.set(row.key, {key:row.key, source:row.text, status:'draft', translations:{}, refs:[row.ref]});
    }
    return validate({schema:'keybridge/v1', sourceLocale, entries:[...entries.values()]});
  }
  return {KEY, parse, stringify, validate, merge, accept, exportJson, fromRows};
});

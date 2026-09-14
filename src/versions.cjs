// Version records contain observed Figma text, not approved translations.
const C = require("./catalog.cjs");
const clone = (x) => JSON.parse(JSON.stringify(x));
const id = (r) => r.documentId + "/" + r.nodeId;
const validateRecords = C.validateRecords;
function capture(catalog, rows, version) {
  if (!version) return catalog;
  const incoming = C.fromRows(rows, catalog.sourceLocale, version);
  const result = clone(catalog);
  const records = result.versionRecords || [];
  validateRecords(records);
  let record = records.find((s) => s.version === version);
  if (!record) {
    record = { version, scope: "observed", entries: [] };
    records.push(record);
  }
  for (const e of incoming.entries) {
    const old = record.entries.find((x) => x.key === e.key);
    const refs = new Map((old?.refs || []).map((r) => [id(r), r]));
    e.refs.forEach((r) => refs.set(id(r), r));
    const item = { key: e.key, value: e.source, refs: [...refs.values()] };
    if (old) Object.assign(old, item);
    else record.entries.push(item);
  }
  result.versionRecords = records;
  return result;
}
function records(catalog) {
  const all = new Map();
  // Legacy catalogs retain locations but have no trustworthy historical values.
  for (const e of catalog?.entries || [])
    for (const r of e.refs) {
      if (!r.version) continue;
      if (!all.has(r.version)) all.set(r.version, new Map());
      const m = all.get(r.version);
      if (!m.has(e.key)) m.set(e.key, { key: e.key, value: null, refs: [] });
      m.get(e.key).refs.push(r);
    }
  for (const s of validateRecords(catalog?.versionRecords || [])) {
    if (!all.has(s.version)) all.set(s.version, new Map());
    for (const e of s.entries) all.get(s.version).set(e.key, clone(e));
  }
  return [...all]
    .map(([version, m]) => ({
      version,
      entries: [...m.values()].sort((a, b) => a.key.localeCompare(b.key)),
    }))
    .sort((a, b) =>
      a.version.localeCompare(b.version, undefined, { numeric: true }),
    );
}
function compare(before, after) {
  const a = new Map((before?.entries || []).map((e) => [e.key, e]));
  const b = new Map((after?.entries || []).map((e) => [e.key, e]));
  return [...new Set([...a.keys(), ...b.keys()])].sort().map((key) => {
    const prev = a.get(key),
      next = b.get(key);
    let state = !prev
      ? "이전 기록에 없음"
      : !next
        ? "현재 기록에서 미확인"
        : prev.value === null || next.value === null
          ? "문구 기록 없음"
          : prev.value !== next.value
            ? "문구 변경"
            : "문구 유지";
    const p = new Map((prev?.refs || []).map((r) => [id(r), r]));
    const n = new Map((next?.refs || []).map((r) => [id(r), r]));
    return {
      key,
      prev,
      next,
      state,
      added: [...n].filter(([k]) => !p.has(k)).map(([, r]) => r),
      unconfirmed: [...p].filter(([k]) => !n.has(k)).map(([, r]) => r),
    };
  });
}
module.exports = { capture, records, compare, validateRecords };

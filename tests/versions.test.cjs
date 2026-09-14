const { test } = require("node:test"),
  assert = require("node:assert/strict");
const C = require("../src/catalog.cjs"),
  V = require("../src/versions.cjs"),
  G = require("../src/github.cjs");
const row = (key, text, nodeId = "1") => ({
  key,
  text,
  ref: {
    documentId: "d",
    nodeId,
    page: "설정",
    frame: nodeId === "1" ? "프로필" : "배송지",
  },
});
const empty = () => ({
  schema: "keybridge/v1",
  sourceLocale: "ko",
  entries: [],
});
function sample() {
  let c = C.fromRows([row("common.save", "저장")], "ko", "1.1.0");
  c = V.capture(c, [row("common.save", "저장")], "1.1.0");
  c = C.merge(
    c,
    C.fromRows([row("common.save", "저장하기", "2")], "ko", "1.1.1"),
  ).catalog;
  return V.capture(c, [row("common.save", "저장하기", "2")], "1.1.1");
}
test("version snapshots round trip independently of reviewed source and compare text plus locations", () => {
  const c = C.parse(C.stringify(sample()));
  assert.equal(c.entries[0].source, "저장");
  assert.equal(c.entries[0].pendingSource, "저장하기");
  const [a, b] = V.records(c),
    [diff] = V.compare(a, b);
  assert.equal(diff.state, "문구 변경");
  assert.equal(diff.added.length, 1);
  assert.equal(diff.unconfirmed.length, 1);
  assert.equal(a.entries[0].value, "저장");
  assert.equal(b.entries[0].value, "저장하기");
});
test("partial same-version exports preserve unseen keys and older versions", () => {
  const initial = sample();
  let c = V.capture(initial, [row("new.title", "새 화면")], "1.1.1");
  c = V.capture(c, [row("common.save", "저장 완료", "2")], "1.1.1");
  assert.equal(V.records(c)[1].entries.length, 2);
  assert.deepEqual(c.versionRecords[0], initial.versionRecords[0]);
  assert.equal(V.records(initial)[1].entries[0].value, "저장하기");
  const result = V.compare(V.records(c)[1], V.records(c)[0]);
  assert.equal(
    result.find((e) => e.key === "new.title").state,
    "현재 기록에서 미확인",
  );
});
test("legacy version references never borrow current source as historical text", () => {
  const c = C.fromRows([row("common.save", "지금 문구")], "ko", "1.0");
  const s = V.records(c)[0];
  assert.equal(s.entries[0].value, null);
  assert.equal(V.compare(s, s)[0].state, "문구 기록 없음");
});
test("versions sort numerically, skip excluded rows, and reject corrupt imported records", () => {
  let c = V.capture(empty(), [row("x", "값")], "1.10.0");
  c = V.capture(
    c,
    [row("y", "값"), { ...row("icon", "x"), excluded: true }],
    "1.2.0",
  );
  assert.deepEqual(
    V.records(c).map((x) => x.version),
    ["1.2.0", "1.10.0"],
  );
  assert.equal(V.records(c)[0].entries.length, 1);
  c.versionRecords[0].entries[0].value = {};
  assert.throws(() => C.stringify(c), /버전 키/);
});
test("GitHub candidate cannot silently discard version history", () => {
  const c = sample(),
    next = structuredClone(c);
  delete next.versionRecords;
  assert.throws(() => G.checkCandidate({ catalog: c }, next), /버전 기록/);
});

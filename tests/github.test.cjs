const { test } = require("node:test"),
  assert = require("node:assert/strict");
const G = require("../src/github.cjs"),
  C = require("../src/catalog.cjs");
const config = {
  repo: "JaehyunYoo/figma-keybridge",
  branch: "main",
  path: "localization/catalog.md",
};
const catalog = { schema: "keybridge/v1", sourceLocale: "ko", entries: [] };
function mock(queue) {
  const calls = [];
  return {
    calls,
    fetch: async (url, options) => {
      calls.push({
        url,
        ...options,
        body: options.body ? JSON.parse(options.body) : undefined,
      });
      const item = queue.shift();
      if (!item) throw new Error("unexpected request");
      return {
        ok: item.status >= 200 && item.status < 300,
        status: item.status,
        json: async () => item.body,
      };
    },
  };
}
test("GitHub accepts repo URL and rejects path traversal", () => {
  assert.equal(
    G.settings({
      ...config,
      repo: "https://github.com/JaehyunYoo/figma-keybridge.git",
    }).repo,
    config.repo,
  );
  assert.throws(() => G.settings({ ...config, path: "../secrets.md" }));
});
test("UTF-8 GitHub content round trip", () =>
  assert.equal(G.decode(G.encode("한글 日本語 😀")), "한글 日本語 😀"));
test("load pins catalog to commit SHA instead of moving branch", async () => {
  const m = mock([
    { status: 200, body: { object: { sha: "abc" } } },
    {
      status: 200,
      body: {
        type: "file",
        encoding: "base64",
        size: 100,
        sha: "blob",
        content: G.encode(C.stringify(catalog)),
      },
    },
  ]);
  const s = await G.client("test-token", m.fetch).load(config);
  assert.equal(s.commit, "abc");
  assert.match(m.calls[1].url, /ref=abc$/);
  assert.equal(s.catalog.sourceLocale, "ko");
});
test("empty repository is recognized without writing", async () => {
  const m = mock([{ status: 409 }, { status: 200, body: { size: 0 } }]);
  const s = await G.client("test-token", m.fetch).load(config);
  assert.equal(s.empty, true);
  assert.ok(m.calls.every((c) => c.method === "GET"));
});
test("nonexistent catalog can be added on a populated branch", async () => {
  const m = mock([
    { status: 200, body: { object: { sha: "abc" } } },
    { status: 404 },
  ]);
  const s = await G.client("test-token", m.fetch).load(config);
  assert.equal(s.catalog, null);
  assert.equal(s.commit, "abc");
});
test("changed base aborts PR creation before any writes", async () => {
  const m = mock([{ status: 200, body: { object: { sha: "new" } } }]);
  await assert.rejects(
    G.client("secret", m.fetch).publish(
      { ...config, commit: "old", content: null },
      catalog,
      "keybridge/test",
    ),
    /기준 브랜치가 변경/,
  );
  assert.equal(m.calls.length, 1);
});
test("publish writes only new branch and creates draft PR", async () => {
  const m = mock([
    { status: 200, body: { object: { sha: "abc" } } },
    { status: 201, body: {} },
    { status: 200, body: {} },
    { status: 201, body: { number: 7 } },
  ]);
  const r = await G.client("secret", m.fetch).publish(
    { ...config, commit: "abc", content: null, fileSha: "blob" },
    catalog,
    "keybridge/test",
  );
  assert.equal(m.calls[1].body.ref, "refs/heads/keybridge/test");
  assert.equal(m.calls[2].body.branch, "keybridge/test");
  assert.equal(m.calls[2].body.sha, "blob");
  assert.equal(m.calls[3].body.draft, true);
  assert.equal(m.calls[3].body.base, "main");
  assert.equal(r.url, "https://github.com/JaehyunYoo/figma-keybridge/pull/7");
});
test("PR failure reports created branch without exposing token", async () => {
  const m = mock([
    { status: 200, body: { object: { sha: "abc" } } },
    { status: 201, body: {} },
    { status: 200, body: {} },
    { status: 403 },
  ]);
  await assert.rejects(
    G.client("super-secret", m.fetch).publish(
      { ...config, commit: "abc", content: null },
      catalog,
      "keybridge/recover",
    ),
    (e) =>
      e.message.includes("keybridge/recover") &&
      !e.message.includes("super-secret"),
  );
});
test("initialization is explicit and writes an empty valid catalog", async () => {
  const m = mock([
    { status: 409 },
    { status: 200, body: { size: 0 } },
    { status: 201, body: {} },
    { status: 200, body: { object: { sha: "first" } } },
    {
      status: 200,
      body: {
        type: "file",
        encoding: "base64",
        size: 100,
        sha: "blob",
        content: G.encode(C.stringify(catalog)),
      },
    },
  ]);
  await G.client("secret", m.fetch).initialize(config, "ko");
  assert.equal(m.calls[2].method, "PUT");
  assert.equal(C.parse(G.decode(m.calls[2].body.content)).entries.length, 0);
});
test("switching to a foreign MD cannot remove existing remote keys or approvals", () => {
  const old = C.fromRows(
    [
      {
        key: "common.save",
        text: "저장",
        ref: { documentId: "d", nodeId: "1" },
      },
    ],
    "ko",
    "1.1.0",
  );
  assert.throws(
    () => G.checkCandidate({ catalog: old }, catalog),
    /다른 카탈로그/,
  );
  const changed = JSON.parse(JSON.stringify(old));
  changed.entries[0].source = "바꿈";
  assert.throws(
    () => G.checkCandidate({ catalog: old }, changed),
    /다른 카탈로그/,
  );
});

const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const script = fs.readFileSync(
  path.join(__dirname, "../plugin/code.js"),
  "utf8",
);
function start(store, fail = false) {
  const messages = [];
  const figma = {
    showUI() {},
    ui: { postMessage: (m) => messages.push(m) },
    root: {
      setPluginData() {
        throw new Error("Must not store credentials in document");
      },
    },
    clientStorage: {
      getAsync: async (k) => store.get(k),
      setAsync: async (k, v) => {
        if (fail) throw new Error("test-secret-must-not-leak");
        store.set(k, v);
      },
      deleteAsync: async (k) => store.delete(k),
    },
  };
  vm.runInNewContext(script, { figma, __html__: "" });
  return {
    send: (m) => figma.ui.onmessage({ type: "github-storage-request", ...m }),
    messages,
  };
}
test("connection survives plugin restart and delete removes it without document writes", async () => {
  const store = new Map(),
    a = start(store),
    connection = {
      token: "test-token",
      repo: "owner/repo",
      branch: "main",
      path: "catalog.md",
    };
  await a.send({ action: "save", connection });
  assert.equal(a.messages.at(-1).action, "save");
  assert.equal(JSON.stringify(a.messages).includes("test-token"), false);
  const b = start(store);
  await b.send({ action: "load" });
  assert.equal(b.messages.at(-1).connection.token, "test-token");
  assert.equal(b.messages.at(-1).connection.repo, "owner/repo");
  await b.send({ action: "delete" });
  await start(store).send({ action: "load" });
  assert.equal(store.size, 0);
});
test("invalid saved data and storage errors never expose credentials", async () => {
  const store = new Map(),
    a = start(store, true);
  await a.send({
    action: "save",
    connection: {
      token: "test-token",
      repo: "a/b",
      branch: "main",
      path: "c.md",
    },
  });
  assert.ok(a.messages.at(-1).error);
  assert.doesNotMatch(JSON.stringify(a.messages), /test-token|test-secret/);
  store.set("keybridge.github.connection.v1", { token: {} });
  await a.send({ action: "load" });
  assert.equal(a.messages.at(-1).connection, null);
});

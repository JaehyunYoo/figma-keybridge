const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
function setup() {
  let sequence = 0;
  const nodes = new Map(),
    messages = [];
  function make(type, id) {
    const data = {};
    const n = {
      type,
      id: id || `new:${++sequence}`,
      name: type,
      children: [],
      x: 0,
      y: 0,
      width: 360,
      height: 40,
      visible: true,
      annotations: [],
      getPluginData: (k) => data[k] || "",
      setPluginData: (k, v) => (data[k] = v),
      appendChild(c) {
        if (c.parent)
          c.parent.children = c.parent.children.filter((x) => x !== c);
        c.parent = this;
        this.children.push(c);
      },
      resize(w, h) {
        this.width = w;
        this.height = h;
      },
    };
    Object.defineProperty(n, "absoluteBoundingBox", {
      get() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
      },
    });
    let characters = "";
    Object.defineProperty(n, "characters", {
      get() {
        return characters;
      },
      set(v) {
        characters = v;
        if (this.textAutoResize === "WIDTH_AND_HEIGHT") {
          this.width = Math.max(1, v.length * 7);
          this.height = 22;
        }
        if (this.textAutoResize === "HEIGHT")
          this.height =
            v
              .split("\n")
              .reduce(
                (s, line) => s + Math.max(1, Math.ceil(line.length / 40)),
                0,
              ) * 20;
      },
    });
    nodes.set(n.id, n);
    return n;
  }
  const root = make("DOCUMENT", "root"),
    page = make("PAGE", "p");
  root.appendChild(page);
  page.name = "Page";
  const screen = make("FRAME", "screen");
  screen.x = 100;
  screen.y = 50;
  screen.width = 400;
  screen.height = 800;
  page.appendChild(screen);
  const source = make("TEXT", "source");
  source.name = "Save";
  source.characters = "저장";
  source.fontName = { family: "Inter", style: "Regular" };
  source.setPluginData("keybridge.key", "common.save");
  screen.appendChild(source);
  page.selection = [screen];
  const figma = {
    root,
    currentPage: page,
    showUI() {},
    ui: { postMessage: (m) => messages.push(m) },
    getNodeByIdAsync: async (id) => nodes.get(id) || null,
    loadFontAsync: async () => {},
    createFrame() {
      const n = make("FRAME");
      page.appendChild(n);
      return n;
    },
    createText() {
      const n = make("TEXT");
      page.appendChild(n);
      return n;
    },
    createLine() {
      const n = make("LINE");
      page.appendChild(n);
      return n;
    },
    createEllipse() {
      const n = make("ELLIPSE");
      page.appendChild(n);
      return n;
    },
    commitUndo() {},
    notify() {},
    loadAllPagesAsync: async () => {},
    annotations: {
      getAnnotationCategoryByIdAsync: async (id) =>
        id === "kb-category" ? { id } : null,
      addAnnotationCategoryAsync: async () => ({ id: "kb-category" }),
    },
  };
  vm.runInNewContext(
    fs.readFileSync(
      require("node:path").join(__dirname, "../plugin/code.js"),
      "utf8",
    ),
    { figma, __html__: "" },
  );
  for (const method of [
    "createFrame",
    "createText",
    "createLine",
    "createEllipse",
    "loadFontAsync",
  ])
    figma[method] = () => {
      throw new Error(
        "Native annotations must not create shapes or load fonts",
      );
    };
  const send = async (m) => figma.ui.onmessage(m);
  const cards = () =>
    page.children.filter((n) => n.getPluginData("keybridge.cardOwner"));
  return { figma, source, screen, page, make, messages, send, cards };
}
test("native annotations preserve manual notes and update without creating shapes", async () => {
  const m = setup(),
    manual = { label: "수동 주석", properties: [{ type: "fills" }] };
  m.source.annotations = [manual];
  await m.send({ type: "scan", scope: "selection" });
  await m.send({ type: "annotations", version: "1.1.0" });
  assert.equal(m.messages.at(-1).type, "annotations");
  assert.equal(m.source.annotations.length, 2);
  assert.deepEqual(m.source.annotations[0], manual);
  assert.match(m.source.annotations[1].label, /common.save/);
  assert.match(m.source.annotations[1].label, /1.1.0/);
  assert.equal(m.source.characters, "저장");
  assert.equal(m.cards().length, 0);
  m.source.characters = "저장하기";
  await m.send({ type: "scan", scope: "selection" });
  await m.send({ type: "annotations", version: "1.1.1" });
  assert.equal(m.source.annotations.length, 2);
  assert.match(m.source.annotations[1].label, /저장하기/);
  assert.match(m.source.annotations[1].label, /1.1.1/);
});
test("manual changes to managed annotations are preserved and reported", async () => {
  const m = setup();
  await m.send({ type: "scan", scope: "selection" });
  await m.send({ type: "annotations", version: "1" });
  m.source.annotations[0].label += "\n수동 메모";
  const before = JSON.stringify(m.source.annotations);
  await m.send({ type: "annotations", version: "2" });
  assert.equal(JSON.stringify(m.source.annotations), before);
  assert.equal(m.messages.at(-1).skipped, 1);
});
test("excluding a source removes only its unchanged generated annotation", async () => {
  const m = setup();
  m.source.annotations = [{ label: "keep me" }];
  await m.send({ type: "scan", scope: "selection" });
  await m.send({
    type: "save",
    annotations: true,
    version: "1",
    rows: [{ id: "source", key: "common.save", excluded: false }],
  });
  assert.equal(m.source.annotations.length, 2);
  await m.send({
    type: "save",
    annotations: true,
    version: "1",
    rows: [{ id: "source", key: "common.save", excluded: true }],
  });
  assert.equal(m.source.annotations.length, 1);
  assert.equal(m.source.annotations[0].label, "keep me");
});
test("migration hides verified legacy cards only after annotation write succeeds", async () => {
  const m = setup(),
    card = m.make("FRAME", "legacy");
  card.setPluginData("keybridge.cardOwner", "source");
  m.page.appendChild(card);
  m.source.setPluginData("keybridge.cardId", card.id);
  await m.send({ type: "scan", scope: "selection" });
  await m.send({ type: "annotations", version: "1" });
  assert.equal(card.visible, false);
  assert.ok(m.source.annotations.length);
  card.visible = true;
  Object.defineProperty(m.source, "annotations", {
    get: () => [],
    set() {
      throw new Error("Permission denied");
    },
  });
  await m.send({ type: "annotations", version: "2" });
  assert.equal(card.visible, true);
  assert.equal(m.messages.at(-1).type, "error");
});
test("stale or unsupported sources fail before overwriting notes", async () => {
  const m = setup();
  await m.send({ type: "scan", scope: "selection" });
  m.source.characters = "changed";
  await m.send({ type: "annotations", version: "1" });
  assert.equal(m.messages.at(-1).type, "error");
  assert.equal(m.source.annotations.length, 0);
  await m.send({ type: "scan", scope: "selection" });
  delete m.source.annotations;
  await m.send({ type: "annotations", version: "1" });
  assert.match(m.messages.at(-1).message, /기본 주석/);
});
test("legacy shape contents remain excluded from selection and usage extraction", async () => {
  const m = setup(),
    card = m.make("FRAME", "legacy"),
    body = m.make("TEXT", "body");
  card.setPluginData("keybridge.cardOwner", "source");
  body.characters = "old card";
  card.appendChild(body);
  m.page.appendChild(card);
  await m.send({ type: "scan", scope: "page" });
  assert.equal(m.messages.at(-1).rows.length, 1);
  m.page.selection = [body];
  await m.send({ type: "scan", scope: "selection" });
  assert.equal(m.messages.at(-1).rows.length, 0);
  await m.send({ type: "usages" });
  assert.equal(m.messages.at(-1).usages.length, 1);
});

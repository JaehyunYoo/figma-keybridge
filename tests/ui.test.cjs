const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { JSDOM, VirtualConsole } = require("jsdom");
const html = fs.readFileSync(path.join(__dirname, "../plugin/ui.html"), "utf8");
const tick = () => new Promise((resolve) => setTimeout(resolve, 35));
function start() {
  const errors = [],
    messages = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => {
    if (!e.message.includes("navigation")) errors.push(e.message);
  });
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      w.confirm = () => true;
      w.URL.createObjectURL = () => "blob:test";
      w.URL.revokeObjectURL = () => {};
      w.HTMLAnchorElement.prototype.click = function () {};
      w.addEventListener("message", (e) => {
        if (e.data.pluginMessage) messages.push(e.data.pluginMessage);
      });
    },
  });
  return { dom, errors, messages };
}
const data = [
  {
    id: "12:34",
    key: "",
    name: "Payment",
    text: "결제하기",
    ref: { documentId: "d", nodeId: "12:34", frame: "Checkout" },
  },
  {
    id: "12:35",
    key: "",
    name: "Greeting",
    text: "안녕하세요",
    ref: { documentId: "d", nodeId: "12:35", frame: "Profile" },
  },
];
async function rows(w, value = data, saved = false) {
  w.dispatchEvent(
    new w.MessageEvent("message", {
      data: { pluginMessage: { type: "rows", rows: value, saved } },
    }),
  );
  await tick();
}
test("React shadcn UI loads, generates keys, saves, and exports Markdown", async () => {
  const { dom, errors, messages } = start();
  try {
    await tick();
    const w = dom.window,
      d = w.document;
    assert.match(d.body.textContent, /디자인에서 개발로/);
    assert.ok(d.querySelector('[data-slot="card"]'));
    assert.equal(d.querySelector("#export").disabled, true);
    await rows(w);
    assert.equal(
      d.querySelectorAll('#rows input[data-slot="input"]').length,
      2,
    );
    d.querySelector("#generate").click();
    await tick();
    assert.equal(
      d.querySelector('#rows input[data-slot="input"]').value,
      "screen.text_12_34",
    );
    assert.equal(d.querySelector("#export").disabled, true);
    d.querySelector("#save").click();
    await tick();
    const save = messages.find((m) => m.type === "save");
    assert.equal(save.rows[0].key, "screen.text_12_34");
    await rows(
      w,
      data.map((r, i) => ({ ...r, key: save.rows[i].key })),
      true,
    );
    assert.equal(d.querySelector("#export").disabled, false);
    d.querySelector("#export").click();
    await tick();
    assert.match(d.querySelector("#preview").value, /screen.text_12_34/);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
test("DOM renders Figma text safely and displays host errors", async () => {
  const { dom, errors } = start();
  try {
    await tick();
    const w = dom.window;
    await rows(w, [{ ...data[0], text: "<img src=x onerror=alert(1)>" }]);
    assert.equal(w.document.querySelectorAll("#rows img").length, 0);
    assert.match(w.document.querySelector("#rows").textContent, /<img/);
    w.dispatchEvent(
      new w.MessageEvent("message", {
        data: { pluginMessage: { type: "error", message: "다시 불러오세요" } },
      }),
    );
    await tick();
    assert.match(
      w.document.querySelector('[role="alert"]').textContent,
      /다시 불러오세요/,
    );
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
test("excluded icons are hidden, skipped by key generation, and can be restored", async () => {
  const { dom, errors, messages } = start();
  try {
    await tick();
    const w = dom.window,
      d = w.document;
    await rows(w, [
      data[0],
      {
        ...data[1],
        name: "Back icon",
        text: "arrow_back",
        excluded: true,
        exclusionReason: "아이콘 폰트",
      },
    ]);
    assert.equal(
      d.querySelectorAll('#rows input[data-slot="input"]').length,
      1,
    );
    d.querySelector("#generate").click();
    await tick();
    d.querySelector("#save").click();
    await tick();
    const save = messages.find((m) => m.type === "save");
    assert.equal(save.rows[1].key, "");
    assert.equal(save.rows[1].excluded, true);
    const label = [...d.querySelectorAll("label")].find((l) =>
      l.textContent.includes("제외 항목 보기"),
    );
    label.querySelector("input").click();
    await tick();
    assert.equal(
      d.querySelectorAll('#rows input[data-slot="input"]').length,
      2,
    );
    const include = d.querySelector('[aria-label="Back icon 번역 대상 포함"]');
    include.click();
    await tick();
    assert.equal(
      d.querySelector('[aria-label="Back icon 번역 키"]').disabled,
      false,
    );
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});
test("usage UI groups a common key, shows locations, and can focus a node", async () => {
  const { dom, messages } = start();
  try {
    await tick();
    const w = dom.window,
      d = w.document;
    [...d.querySelectorAll("nav button")]
      .find((b) => b.textContent === "키 사용처")
      .click();
    await tick();
    const button = [...d.querySelectorAll("button")].find((b) =>
      b.textContent.includes("현재 파일 전체 조회"),
    );
    button.click();
    await tick();
    assert.ok(messages.some((m) => m.type === "usages"));
    w.dispatchEvent(
      new w.MessageEvent("message", {
        data: {
          pluginMessage: {
            type: "usages",
            documentId: "d",
            usages: [
              {
                key: "common.save",
                text: "저장",
                ref: {
                  documentId: "d",
                  nodeId: "1",
                  page: "Settings",
                  frame: "Profile",
                },
              },
              {
                key: "common.save",
                text: "저장",
                ref: {
                  documentId: "d",
                  nodeId: "2",
                  page: "Checkout",
                  frame: "Address",
                },
              },
            ],
          },
        },
      }),
    );
    await tick();
    const keyButton = [...d.querySelectorAll("button")].find((b) =>
      b.textContent.includes("common.save"),
    );
    assert.match(keyButton.textContent, /2곳/);
    keyButton.click();
    await tick();
    assert.match(d.body.textContent, /최초 등록 기록 없음/);
    assert.match(d.body.textContent, /Settings \/ Profile/);
    [...d.querySelectorAll("button")]
      .find((b) => b.textContent === "위치 보기")
      .click();
    await tick();
    assert.ok(messages.some((m) => m.type === "focus" && m.id === "1"));
  } finally {
    dom.window.close();
  }
});

test("export records version text and version table switches and compares values", async () => {
  const { dom, errors } = start();
  try {
    await tick();
    const w = dom.window,
      d = w.document;
    const setInput = (el, value) => {
      Object.getOwnPropertyDescriptor(
        w.HTMLInputElement.prototype,
        "value",
      ).set.call(el, value);
      el.dispatchEvent(new w.Event("input", { bubbles: true }));
    };
    setInput(d.querySelector('[aria-label="기록 버전"]'), "1.1.0");
    await tick();
    await rows(w, [{ ...data[0], key: "common.save", text: "저장" }], true);
    d.querySelector("#export").click();
    await tick();
    setInput(d.querySelector('[aria-label="기록 버전"]'), "1.1.1");
    await tick();
    await rows(w, [{ ...data[0], key: "common.save", text: "저장하기" }], true);
    d.querySelector("#export").click();
    await tick();
    [...d.querySelectorAll("nav button")]
      .find((b) => b.textContent === "키 사용처")
      .click();
    await tick();
    assert.match(
      d.querySelector('[aria-label="버전별 키 테이블"]').textContent,
      /저장하기/,
    );
    const sel = d.querySelector('[aria-label="키 목록 버전"]');
    sel.value = "1.1.0";
    sel.dispatchEvent(new w.Event("change", { bubbles: true }));
    await tick();
    assert.doesNotMatch(
      d.querySelector('[aria-label="버전별 키 테이블"]').textContent,
      /저장하기/,
    );
    sel.value = "1.1.1";
    sel.dispatchEvent(new w.Event("change", { bubbles: true }));
    await tick();
    [...d.querySelectorAll("button")]
      .find((b) => b.textContent === "두 버전 비교")
      .click();
    await tick();
    const table = d.querySelector('[aria-label="버전 비교 테이블"]');
    assert.match(table.textContent, /문구 변경/);
    assert.match(table.textContent, /저장하기/);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("native annotation controls send saved keys and allow separate refresh", async () => {
  const { dom, messages, errors } = start();
  try {
    await tick();
    const w = dom.window,
      d = w.document;
    await rows(w, [{ ...data[0], key: "common.save" }], true);
    const button = d.querySelector("#annotations");
    assert.equal(button.disabled, false);
    button.click();
    await tick();
    assert.ok(messages.some((m) => m.type === "annotations"));
    w.dispatchEvent(
      new w.MessageEvent("message", {
        data: {
          pluginMessage: {
            type: "annotations",
            count: 1,
            removed: 0,
            hidden: 0,
            skipped: 0,
          },
        },
      }),
    );
    await tick();
    assert.match(d.body.textContent, /Figma 기본 주석 1개 생성·갱신/);
    await rows(w);
    d.querySelector("#generate").click();
    await tick();
    d.querySelector("#save").click();
    await tick();
    assert.equal(messages.find((m) => m.type === "save").annotations, true);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("typing keys never invokes native datalist and explicit in-flow picker still supports reuse", async () => {
  const { dom, errors } = start();
  try {
    await tick();
    const w = dom.window,
      d = w.document;
    const C = require("../src/catalog.cjs");
    const catalog = C.fromRows(
      [
        { ...data[0], key: "medication_title", text: "Medication" },
        { ...data[1], key: "medication_description", text: "Test at home" },
      ],
      "en",
    );
    const file = d.querySelector('input[type="file"]');
    Object.defineProperty(file, "files", {
      value: [{ name: "catalog.md", text: async () => C.stringify(catalog) }],
      configurable: true,
    });
    file.dispatchEvent(new w.Event("change", { bubbles: true }));
    await tick();
    await rows(w, [{ ...data[0], key: "", text: "새로운 문구" }]);
    const input = d.querySelector('[aria-label="Payment 번역 키"]');
    input.focus();
    Object.getOwnPropertyDescriptor(
      w.HTMLInputElement.prototype,
      "value",
    ).set.call(input, "medication_custom");
    input.dispatchEvent(new w.Event("input", { bubbles: true }));
    await tick();
    assert.equal(input.value, "medication_custom");
    assert.equal(input.getAttribute("list"), null);
    assert.equal(d.querySelector("datalist"), null);
    assert.equal(input.autocomplete, "off");
    assert.equal(d.querySelector('[aria-label="Payment 기존 키 목록"]'), null);
    const toggle = d.querySelector('[aria-label="Payment 기존 키 선택"]');
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    toggle.click();
    await tick();
    const panel = d.querySelector('[aria-label="Payment 기존 키 목록"]');
    assert.ok(panel);
    assert.ok(input.closest(".key-record").contains(panel));
    assert.equal(input.value, "medication_custom");
    const search = d.querySelector('[aria-label="Payment 기존 키 검색"]');
    Object.getOwnPropertyDescriptor(
      w.HTMLInputElement.prototype,
      "value",
    ).set.call(search, "Test at home");
    search.dispatchEvent(new w.Event("input", { bubbles: true }));
    await tick();
    const buttons = panel.querySelectorAll("button");
    assert.equal(buttons.length, 1);
    assert.match(buttons[0].textContent, /medication_description/);
    buttons[0].click();
    await tick();
    assert.equal(input.value, "medication_description");
    assert.equal(d.activeElement, input);
    assert.equal(d.querySelector('[aria-label="Payment 기존 키 목록"]'), null);
    assert.equal(d.querySelector("#save").disabled, false);
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

test("GitHub connection restores, saves explicitly, and disconnect clears token", async () => {
  const { dom, messages, errors } = start();
  try {
    await tick();
    const w = dom.window,
      d = w.document;
    const reply = (m) =>
      w.dispatchEvent(
        new w.MessageEvent("message", {
          data: { pluginMessage: { type: "github-storage-result", ...m } },
        }),
      );
    assert.ok(
      messages.some(
        (m) => m.type === "github-storage-request" && m.action === "load",
      ),
    );
    reply({
      action: "load",
      connection: {
        token: "fake-test-token",
        repo: "test/repo",
        branch: "main",
        path: "catalog.md",
      },
    });
    await tick();
    const input = d.querySelector('[aria-label="GitHub 토큰"]');
    assert.equal(input.value, "fake-test-token");
    assert.equal(input.type, "password");
    assert.equal(
      d.querySelector('[aria-label="GitHub 저장소"]').value,
      "test/repo",
    );
    [...d.querySelectorAll("button")]
      .find((b) => b.textContent === "이 기기에 저장")
      .click();
    await tick();
    assert.equal(
      messages.find((m) => m.action === "save").connection.token,
      "fake-test-token",
    );
    reply({ action: "save" });
    await tick();
    [...d.querySelectorAll("button")]
      .find(
        (b) =>
          b.textContent.includes("연결 해제") &&
          b.textContent.includes("카탈로그") === false,
      )
      .click();
    await tick();
    assert.equal(input.value, "");
    assert.ok(messages.some((m) => m.action === "delete"));
    reply({ action: "delete" });
    reply({
      action: "load",
      connection: {
        token: "stale-token",
        repo: "stale/repo",
        branch: "main",
        path: "catalog.md",
      },
    });
    await tick();
    assert.equal(input.value, "");
    assert.deepEqual(errors, []);
  } finally {
    dom.window.close();
  }
});

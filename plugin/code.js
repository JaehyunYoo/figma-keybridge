/* Figma sandbox: stable key metadata and native Figma annotations. */
figma.showUI(__html__, { width: 680, height: 720, themeColors: true });
const DATA = "keybridge.key";
const EXCLUDED = "keybridge.excluded";
const DOC = "keybridge.documentId";
const CARD = "keybridge.cardOwner";
const CARD_LINK = "keybridge.cardId";
const CARD_TEXT = "keybridge.cardText";
const KEY = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/;
let currentRows = [];
function documentId() {
  let id = figma.root.getPluginData(DOC);
  if (!id) {
    id =
      "doc_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10);
    figma.root.setPluginData(DOC, id);
  }
  return id;
}
function collect(roots) {
  const found = new Map();
  function walk(node) {
    let ancestor = node;
    while (ancestor) {
      if (
        ancestor.getPluginData &&
        (ancestor.getPluginData(CARD) || ancestor.getPluginData(CARD_TEXT))
      )
        return;
      ancestor = ancestor.parent;
    }
    if (node.type === "TEXT") found.set(node.id, node);
    if ("children" in node) for (const child of node.children) walk(child);
  }
  for (const root of roots) walk(root);
  return [...found.values()];
}
function exclusionReason(node) {
  const value = node.characters.trim();
  if (!value) return "빈 텍스트";
  let fonts = [];
  if (node.fontName && typeof node.fontName === "object")
    fonts = [node.fontName];
  else if (typeof node.getRangeAllFontNames === "function")
    fonts = node.getRangeAllFontNames(0, node.characters.length);
  const iconFont = (f) =>
    /material[ _-]*(icons|symbols)|font[ _-]*awesome|^fa[bsrltd]?\s|icomoon|ionicons|bootstrap[ _-]*icons|remixicon|lucide|feather|phosphor|tabler[ _-]*icons|^icon(s|font)?$/i.test(
      f.family || "",
    );
  if (fonts.length && fonts.every(iconFont)) return "아이콘 폰트";
  if (
    [...value].every((c) => {
      const n = c.codePointAt(0);
      return (
        /\s/.test(c) ||
        (n >= 0xe000 && n <= 0xf8ff) ||
        (n >= 0xf0000 && n <= 0xffffd) ||
        (n >= 0x100000 && n <= 0x10fffd)
      );
    })
  )
    return "아이콘 전용 문자";
  return "";
}
function scan(scope) {
  const roots =
    scope === "page" ? figma.currentPage.children : figma.currentPage.selection;
  if (!roots.length)
    throw new Error("Figma에서 프레임 또는 텍스트를 먼저 선택하세요.");
  const docId = documentId();
  currentRows = collect(roots).map((n) => {
    let frame = n.parent;
    while (
      frame &&
      !["FRAME", "COMPONENT", "INSTANCE", "PAGE"].includes(frame.type)
    )
      frame = frame.parent;
    const reason = exclusionReason(n),
      override = n.getPluginData(EXCLUDED);
    return {
      excluded: override ? override === "true" : !!reason,
      exclusionReason: reason,
      exclusionOverride: override,
      id: n.id,
      key: n.getPluginData(DATA),
      name: n.name,
      text: n.characters,
      ref: {
        documentId: docId,
        ...(figma.fileKey ? { fileKey: figma.fileKey } : {}),
        nodeId: n.id,
        page: figma.currentPage.name,
        frame: frame ? frame.name : "",
      },
    };
  });
  figma.ui.postMessage({ type: "rows", rows: currentRows });
}
function pageOf(node) {
  let p = node.parent;
  while (p && p.type !== "PAGE") p = p.parent;
  return p;
}
const ANNOTATION_CATEGORY = "keybridge.annotationCategory";
const ANNOTATION_LAST = "keybridge.annotationLast";
async function updateAnnotations(version) {
  if (
    version &&
    (typeof version !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version))
  )
    throw new Error("주석 버전 형식을 확인하세요.");
  if (!currentRows.length) throw new Error("텍스트를 먼저 불러오세요.");
  if (!figma.annotations)
    throw new Error("현재 Figma 환경에서 기본 주석 API를 사용할 수 없습니다.");
  const items = [];
  for (const r of currentRows) {
    const node = await figma.getNodeByIdAsync(r.id);
    if (
      !node ||
      node.type !== "TEXT" ||
      node.characters !== r.text ||
      node.getPluginData(DATA) !== r.key ||
      node.getPluginData(EXCLUDED) !== r.exclusionOverride
    )
      throw new Error(
        "문구 또는 키가 변경되었습니다. 다시 불러온 뒤 주석을 갱신하세요.",
      );
    if (!Array.isArray(node.annotations))
      throw new Error("이 레이어에서 기본 주석을 사용할 수 없습니다.");
    const cardId = node.getPluginData(CARD_LINK);
    const legacy = cardId ? await figma.getNodeByIdAsync(cardId) : null;
    items.push({ r, node, legacy });
  }
  const savedCategory = figma.root.getPluginData(ANNOTATION_CATEGORY);
  let category = savedCategory
    ? await figma.annotations.getAnnotationCategoryByIdAsync(savedCategory)
    : null;
  if (!category) {
    category = await figma.annotations.addAnnotationCategoryAsync({
      label: "Keybridge",
      color: "blue",
    });
    figma.root.setPluginData(ANNOTATION_CATEGORY, category.id);
  }
  let count = 0,
    removed = 0,
    hidden = 0,
    skipped = 0;
  for (const { r, node, legacy } of items) {
    // Recheck after asynchronous category creation before replacing annotations.
    if (
      node.characters !== r.text ||
      node.getPluginData(DATA) !== r.key ||
      node.getPluginData(EXCLUDED) !== r.exclusionOverride
    )
      throw new Error("문구 또는 키가 변경되었습니다. 다시 불러오세요.");
    const annotations = Array.from(node.annotations);
    let last = null;
    try {
      last = JSON.parse(node.getPluginData(ANNOTATION_LAST) || "null");
    } catch {}
    const signature = (a) =>
      JSON.stringify([
        a.categoryId || "",
        a.label || "",
        a.labelMarkdown || "",
        a.properties || [],
      ]);
    const own = annotations.findIndex(
      (a) => last && signature(a) === signature(last),
    );
    // Preserve manual edits, pinned properties, and rich-text changes in our category.
    const conflicts = annotations.some(
      (a, i) =>
        (a.categoryId === category.id ||
          (last && a.categoryId === last.categoryId)) &&
        i !== own,
    );
    if (conflicts) {
      skipped++;
      continue;
    }
    const next = annotations.filter((_, i) => i !== own);
    if (r.excluded || !r.key) {
      if (own >= 0) {
        node.annotations = next;
        removed++;
      }
      node.setPluginData(ANNOTATION_LAST, "");
    } else {
      const annotation = {
        categoryId: category.id,
        label:
          "키: " +
          r.key +
          "\n문구: " +
          node.characters +
          "\n기록 버전: " +
          (version || "미기록"),
      };
      if (own >= 0) next.splice(own, 0, annotation);
      else next.push(annotation);
      node.annotations = next;
      node.setPluginData(
        ANNOTATION_LAST,
        JSON.stringify(
          Array.from(node.annotations).find(
            (a) => a.categoryId === category.id && a.label === annotation.label,
          ) || annotation,
        ),
      );
      count++;
    }
    // Keep old generated shapes recoverable; hide only a verified owned card.
    if (
      legacy &&
      legacy.type === "FRAME" &&
      legacy.getPluginData(CARD) === node.id &&
      legacy.visible
    ) {
      legacy.visible = false;
      hidden++;
    }
  }
  figma.commitUndo();
  figma.ui.postMessage({
    type: "annotations",
    count,
    removed,
    hidden,
    skipped,
  });
  figma.notify("Figma 기본 주석 " + count + "개 생성·갱신");
}
figma.ui.onmessage = async (msg) => {
  if (msg.type === "github-storage-request") {
    const storageKey = "keybridge.github.connection.v1";
    const valid = (v) =>
      v &&
      ["token", "repo", "branch", "path"].every(
        (k) => typeof v[k] === "string" && v[k].length <= 4096,
      ) &&
      v.token.trim();
    try {
      if (msg.action === "load") {
        const saved = await figma.clientStorage.getAsync(storageKey);
        figma.ui.postMessage({
          type: "github-storage-result",
          action: "load",
          connection: valid(saved)
            ? {
                token: saved.token,
                repo: saved.repo,
                branch: saved.branch,
                path: saved.path,
              }
            : null,
        });
      } else if (msg.action === "save") {
        if (!valid(msg.connection)) throw new Error("invalid settings");
        const { token, repo, branch, path } = msg.connection;
        await figma.clientStorage.setAsync(storageKey, {
          token: token.trim(),
          repo,
          branch,
          path,
        });
        figma.ui.postMessage({ type: "github-storage-result", action: "save" });
      } else if (msg.action === "delete") {
        await figma.clientStorage.deleteAsync(storageKey);
        figma.ui.postMessage({
          type: "github-storage-result",
          action: "delete",
        });
      }
    } catch {
      figma.ui.postMessage({
        type: "github-storage-result",
        action: msg.action,
        error:
          msg.action === "delete"
            ? "저장된 토큰 삭제에 실패했습니다. 연결 해제를 다시 시도하세요."
            : "이 기기의 연결 정보 저장소에 접근하지 못했습니다. 다시 시도하세요.",
      });
    }
    return;
  }
  try {
    if (msg.type === "usages") {
      await figma.loadAllPagesAsync();
      const docId = documentId(),
        usage = [];
      for (const page of figma.root.children) {
        for (const n of collect(page.children)) {
          const key = n.getPluginData(DATA);
          if (
            !key ||
            n.getPluginData(EXCLUDED) === "true" ||
            (!n.getPluginData(EXCLUDED) && exclusionReason(n))
          )
            continue;
          let frame = n.parent;
          while (
            frame &&
            !["FRAME", "COMPONENT", "INSTANCE", "PAGE"].includes(frame.type)
          )
            frame = frame.parent;
          usage.push({
            key,
            text: n.characters,
            ref: {
              documentId: docId,
              nodeId: n.id,
              page: page.name,
              frame: frame ? frame.name : "",
              ...(figma.fileKey ? { fileKey: figma.fileKey } : {}),
            },
          });
        }
      }
      figma.ui.postMessage({
        type: "usages",
        usages: usage,
        documentId: docId,
      });
    }
    if (msg.type === "scan") scan(msg.scope);
    if (msg.type === "annotations") await updateAnnotations(msg.version || "");
    if (msg.type === "save") {
      const allowed = new Set(currentRows.map((r) => r.id));
      const mutations = [];
      for (const r of msg.rows) {
        if (!allowed.has(r.id))
          throw new Error("다시 텍스트를 불러온 뒤 저장하세요.");
        if (
          r.key &&
          (!KEY.test(r.key) ||
            r.key
              .split(".")
              .some((p) =>
                ["__proto__", "prototype", "constructor"].includes(p),
              ))
        )
          throw new Error("키 형식 오류: " + r.key);
        const node = await figma.getNodeByIdAsync(r.id);
        if (!node || node.type !== "TEXT")
          throw new Error("삭제된 텍스트가 있습니다. 다시 불러오세요.");
        const oldRow = currentRows.find((x) => x.id === r.id);
        if (
          node.characters !== oldRow.text ||
          node.getPluginData(DATA) !== oldRow.key ||
          node.getPluginData(EXCLUDED) !== oldRow.exclusionOverride
        )
          throw new Error(
            "다른 작업으로 문구 또는 키가 변경되었습니다. 다시 불러오세요.",
          );
        mutations.push({
          node,
          key: r.key,
          excluded: r.excluded === undefined ? oldRow.excluded : !!r.excluded,
        });
      }
      const sources = new Map();
      for (const { node, key, excluded } of mutations) {
        if (excluded || !key) continue;
        if (sources.has(key) && sources.get(key) !== node.characters)
          throw new Error(
            key +
              ": 선택 영역 안에 서로 다른 문구가 있습니다. 키를 분리하세요.",
          );
        sources.set(key, node.characters);
      }
      for (const { node, key, excluded } of mutations) {
        node.setPluginData(DATA, key);
        node.setPluginData(EXCLUDED, String(excluded));
      }
      currentRows = currentRows.map((r) => {
        const m = mutations.find((x) => x.node.id === r.id);
        return m
          ? Object.assign({}, r, {
              key: m.key,
              excluded: m.excluded,
              exclusionOverride: String(m.excluded),
            })
          : r;
      });
      figma.commitUndo();
      figma.ui.postMessage({
        type: "rows",
        rows: currentRows,
        saved: true,
        annotationsPending: !!msg.annotations,
      });
      figma.notify("키 연결을 저장했습니다.");
      if (msg.annotations) {
        try {
          await updateAnnotations(msg.version || "");
        } catch (e) {
          throw new Error(
            "키 연결은 저장했습니다. Figma 기본 주석 갱신 실패: " + e.message,
          );
        }
      }
    }
    if (msg.type === "focus") {
      const n = await figma.getNodeByIdAsync(msg.id);
      if (!n || n.type !== "TEXT")
        throw new Error(
          "해당 텍스트가 삭제되었거나 현재 파일에 없습니다. 사용처를 다시 조회하세요.",
        );
      if (n && n.type === "TEXT") {
        let page = n.parent;
        while (page && page.type !== "PAGE") page = page.parent;
        if (page && page.id !== figma.currentPage.id)
          await figma.setCurrentPageAsync(page);
        figma.currentPage.selection = [n];
        figma.viewport.scrollAndZoomIntoView([n]);
      }
    }
  } catch (e) {
    figma.ui.postMessage({ type: "error", message: e.message });
  }
};

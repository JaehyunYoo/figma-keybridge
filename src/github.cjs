"use strict";
const C = require("./catalog.cjs");
function settings(input) {
  const repo = input.repo
    .trim()
    .replace(/^https:\/\/github\.com\//, "")
    .replace(/\/$/, "")
    .replace(/\.git$/, "");
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) ||
    repo.split("/").some((x) => x === "." || x === "..")
  )
    throw new Error("저장소는 owner/repository 형식으로 입력하세요.");
  const branch = input.branch.trim(),
    path = input.path.trim();
  if (
    !branch ||
    /[\s~^:?*\[\\]/.test(branch) ||
    branch.includes("..") ||
    branch.includes("@{")
  )
    throw new Error("기준 브랜치를 확인하세요.");
  if (
    !path.endsWith(".md") ||
    path.startsWith("/") ||
    path.split("/").some((x) => !x || x === "." || x === "..")
  )
    throw new Error("카탈로그 경로는 저장소 안의 .md 파일이어야 합니다.");
  return { repo, branch, path };
}
const encodePath = (s) => s.split("/").map(encodeURIComponent).join("/");
function encode(text) {
  if (typeof Buffer !== "undefined")
    return Buffer.from(text, "utf8").toString("base64");
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
function decode(text) {
  if (typeof Buffer !== "undefined")
    return Buffer.from(text, "base64").toString("utf8");
  return new TextDecoder().decode(
    Uint8Array.from(atob(text.replace(/\s/g, "")), (c) => c.charCodeAt(0)),
  );
}
function checkCandidate(snapshot, catalog) {
  C.validate(catalog);
  const current = new Map(catalog.entries.map((e) => [e.key, e]));
  for (const old of snapshot.catalog?.versionRecords || []) {
    const next = catalog.versionRecords?.find((s) => s.version === old.version);
    if (
      !next ||
      old.entries.some((e) => !next.entries.some((n) => n.key === e.key))
    )
      throw new Error(
        "기존 버전 기록이 누락되었습니다. GitHub 카탈로그를 다시 가져오세요.",
      );
  }
  for (const old of snapshot.catalog?.entries || []) {
    const e = current.get(old.key);
    if (
      !e ||
      e.source !== old.source ||
      JSON.stringify(e.translations) !== JSON.stringify(old.translations)
    )
      throw new Error(
        "GitHub 원본과 다른 카탈로그가 연결되어 있습니다. GitHub에서 다시 가져온 뒤 변경을 검토하세요.",
      );
    const ids = new Set(
      e.refs.map(
        (r) => r.documentId + "/" + r.nodeId + "/" + (r.version || ""),
      ),
    );
    if (
      old.refs.some(
        (r) =>
          !ids.has(r.documentId + "/" + r.nodeId + "/" + (r.version || "")),
      )
    )
      throw new Error(
        "기존 사용처 기록이 누락되었습니다. GitHub 카탈로그를 다시 가져오세요.",
      );
  }
}
function client(token, fetcher = fetch) {
  if (!token.trim())
    throw new Error("GitHub 토큰을 입력하거나 저장된 연결 정보를 불러오세요.");
  async function api(route, method = "GET", body) {
    let r;
    try {
      r = await fetcher("https://api.github.com" + route, {
        method,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: "Bearer " + token.trim(),
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "error",
      });
    } catch {
      throw new Error(
        "GitHub 요청에 실패했습니다. 네트워크 또는 Figma 허용 도메인을 확인하세요. 쓰기 요청이었다면 GitHub에서 결과를 먼저 확인하세요.",
      );
    }
    if (!r.ok) {
      const e = new Error(
        `GitHub ${r.status}: ${r.status === 401 ? "토큰을 확인하세요." : r.status === 403 ? "저장소 권한·조직 승인 또는 API 사용 한도를 확인하세요." : r.status === 404 ? "저장소·브랜치·파일 또는 접근 권한을 확인하세요." : r.status === 409 ? "저장소 변경 충돌입니다. 다시 가져오세요." : "요청을 완료하지 못했습니다. GitHub에서 결과를 확인하세요."}`,
      );
      e.status = r.status;
      throw e;
    }
    return r.status === 204 ? null : r.json();
  }
  async function head(s) {
    const result = await api(
      `/repos/${s.repo}/git/ref/heads/${encodePath(s.branch)}`,
    );
    return result.object.sha;
  }
  async function load(input) {
    const s = settings(input);
    let commit;
    try {
      commit = await head(s);
    } catch (e) {
      if (e.status !== 404 && e.status !== 409) throw e;
      const repo = await api(`/repos/${s.repo}`);
      if (repo.size === 0)
        return {
          ...s,
          commit: null,
          fileSha: null,
          content: null,
          catalog: null,
          empty: true,
        };
      throw e;
    }
    let file = null;
    try {
      file = await api(
        `/repos/${s.repo}/contents/${encodePath(s.path)}?ref=${encodeURIComponent(commit)}`,
      );
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    if (
      file &&
      (file.type !== "file" ||
        file.encoding !== "base64" ||
        file.size > 1000000)
    )
      throw new Error("1MB 이하의 일반 MD 파일만 지원합니다.");
    const content = file ? decode(file.content) : null;
    const catalog = content === null ? null : C.parse(content);
    return { ...s, commit, fileSha: file ? file.sha : null, content, catalog };
  }
  async function publish(snapshot, catalog, branchName) {
    const s = settings(snapshot);
    checkCandidate(snapshot, catalog);
    if (!/^keybridge\/[a-zA-Z0-9_-]+$/.test(branchName))
      throw new Error("변경 브랜치 이름이 올바르지 않습니다.");
    const content = C.stringify(catalog);
    if (snapshot.content === content)
      throw new Error("카탈로그 변경 내용이 없습니다.");
    if ((await head(s)) !== snapshot.commit)
      throw new Error(
        "기준 브랜치가 변경되었습니다. 최신 카탈로그를 다시 가져와 비교하세요.",
      );
    let created = false;
    try {
      await api(`/repos/${s.repo}/git/refs`, "POST", {
        ref: "refs/heads/" + branchName,
        sha: snapshot.commit,
      });
      created = true;
      await api(`/repos/${s.repo}/contents/${encodePath(s.path)}`, "PUT", {
        message: "Update localization catalog from Figma",
        content: encode(content),
        branch: branchName,
        ...(snapshot.fileSha ? { sha: snapshot.fileSha } : {}),
      });
      const pr = await api(`/repos/${s.repo}/pulls`, "POST", {
        title: "Update localization keys and Figma usages",
        head: branchName,
        base: s.branch,
        body: "Figma에서 추출한 키·원문 변경 제안·화면 사용처를 반영합니다. 기존 검수 문구와 번역은 보존했습니다. 원문 변경 제안 및 공통 키의 영향 범위를 검토한 뒤 병합해 주세요.",
        draft: true,
      });
      return {
        url: `https://github.com/${s.repo}/pull/${pr.number}`,
        branch: branchName,
      };
    } catch (e) {
      if (created)
        e.message += `\n변경 브랜치 ${branchName}가 생성되었습니다. 재시도 전에 GitHub에서 커밋·PR 상태를 확인하세요.`;
      throw e;
    }
  }
  async function initialize(input, sourceLocale) {
    const s = settings(input);
    const check = await load(s);
    if (!check.empty)
      throw new Error("이미 초기화된 저장소입니다. 다시 가져오세요.");
    const catalog = { schema: "keybridge/v1", sourceLocale, entries: [] };
    await api(`/repos/${s.repo}/contents/${encodePath(s.path)}`, "PUT", {
      message: "Initialize localization catalog",
      content: encode(C.stringify(catalog)),
      branch: s.branch,
    });
    return load(s);
  }
  return { load, publish, initialize };
}
module.exports = { settings, client, encode, decode, checkCandidate };

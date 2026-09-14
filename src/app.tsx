import { BrandMark } from "./BrandMark";
import { ExistingKeyPicker } from "./ExistingKeyPicker";
import V from "./versions.cjs";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { Card, CardContent } from "./components/ui/card";
import { Textarea } from "./components/ui/textarea";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  FileText,
  Frame,
  Hash,
  Link2,
  LocateFixed,
  Plus,
  RefreshCw,
  Search,
  Unlink,
  X,
  AlertCircle,
  Braces,
} from "lucide-react";
import { GitHubPanel } from "./GitHubPanel";
import { UsagePanel } from "./UsagePanel";
import * as C from "./catalog.cjs";
type Row = {
  id: string;
  key: string;
  name: string;
  text: string;
  ref: any;
  excluded?: boolean;
  exclusionReason?: string;
};
const send = (data: any) => parent.postMessage({ pluginMessage: data }, "*");
function propose(input: Row[], base: any) {
  let changed = false;
  const output = input.map((row) => {
    if (row.excluded || row.key || !base) return row;
    const byRef = base.entries.filter((e: any) =>
      e.refs.some(
        (r: any) => r.documentId === row.ref.documentId && r.nodeId === row.id,
      ),
    );
    const matches = byRef.length
      ? byRef
      : base.entries.filter((e: any) => e.source === row.text);
    if (matches.length === 1) {
      changed = true;
      return { ...row, key: matches[0].key };
    }
    return row;
  });
  return { output, changed };
}
function App() {
  const [rows, setRows] = useState<Row[]>([]),
    [base, setBase] = useState<any>(null),
    [baseName, setBaseName] = useState(""),
    [dirty, setDirty] = useState(false),
    [scope, setScope] = useState("selection"),
    [prefix, setPrefix] = useState("screen"),
    [locale, setLocale] = useState("ko"),
    [query, setQuery] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [preview, setPreview] = useState(""),
    [busy, setBusy] = useState(false),
    [showExcluded, setShowExcluded] = useState(false),
    [annotationsOnSave, setAnnotationsOnSave] = useState(true),
    [tab, setTab] = useState("keys"),
    [version, setVersion] = useState(""),
    [usages, setUsages] = useState<any[]>([]),
    [usageDoc, setUsageDoc] = useState(""),
    [usageBusy, setUsageBusy] = useState(false);
  const baseRef = useRef<any>(null),
    fileRef = useRef<HTMLInputElement>(null);
  const note = (m: string, bad = false) => {
    setMessage(m);
    setError(bad);
  };
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const m = event.data.pluginMessage;
      if (!m) return;
      if (m.type === "rows") {
        const p = propose(m.rows, baseRef.current);
        setRows(p.output);
        setDirty(p.changed);
        setBusy(!!m.annotationsPending);
        setPreview("");
        note(
          p.changed
            ? "기존 카탈로그에서 키를 찾았습니다. 확인 후 저장하세요."
            : m.saved
              ? "키 연결을 저장했습니다. MD로 내보낼 수 있어요."
              : "텍스트를 불러왔습니다.",
        );
      }
      if (m.type === "usages" && Array.isArray(m.usages)) {
        setUsages(m.usages);
        setUsageDoc(m.documentId);
        setUsageBusy(false);
        note(`현재 파일에서 ${m.usages.length}개 연결을 확인했습니다.`);
      }
      if (m.type === "annotations") {
        setBusy(false);
        note(
          `Figma 기본 주석 ${m.count}개 생성·갱신 · 제외 주석 ${m.removed}개 정리 · 이전 카드 ${m.hidden}개 숨김` +
            (m.skipped
              ? ` · 직접 수정된 주석 ${m.skipped}개는 보존했습니다. 해당 레이어의 Keybridge 주석을 확인하세요.`
              : ""),
        );
      }
      if (m.type === "error") {
        setUsageBusy(false);
        setBusy(false);
        note(m.message, true);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  const guard = (fn: () => void) => {
    try {
      fn();
    } catch (e: any) {
      note(e.message, true);
    }
  };
  const scan = () => {
    if (dirty && !confirm("저장하지 않은 키 편집을 버리고 다시 불러올까요?"))
      return;
    setBusy(true);
    send({ type: "scan", scope });
  };
  const generate = () =>
    guard(() => {
      if (!C.KEY.test(prefix))
        throw new Error(
          "접두사는 영문으로 시작하고 영문·숫자·밑줄·점으로 구성하세요.",
        );
      setRows(
        rows.map((r) =>
          r.excluded || r.key
            ? r
            : {
                ...r,
                key: prefix + ".text_" + r.id.replace(/[^A-Za-z0-9_]/g, "_"),
              },
        ),
      );
      setDirty(true);
      setPreview("");
      note("키를 생성했습니다. 이름을 확인하고 연결을 저장하세요.");
    });
  const save = () => {
    setBusy(true);
    send({
      type: "save",
      annotations: annotationsOnSave,
      version: version.trim(),
      rows: rows.map((r) => ({
        id: r.id,
        key: r.key.trim(),
        excluded: !!r.excluded,
      })),
    });
  };
  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const f = event.target.files?.[0];
      if (!f) return;
      const data = C.parse(await f.text());
      baseRef.current = data;
      setBase(data);
      setBaseName(f.name);
      setLocale(data.sourceLocale);
      const p = propose(rows, data);
      setRows(p.output);
      setDirty(dirty || p.changed);
      setPreview("");
      note("검수된 문구와 번역을 유지하며 변경을 비교합니다.");
    } catch (e: any) {
      note(e.message, true);
    } finally {
      event.target.value = "";
    }
  };
  const prepare = () => {
    if (!rows.some((r) => !r.excluded))
      throw new Error("내보낼 텍스트를 한 개 이상 포함하세요.");
    if (dirty) throw new Error("키 연결을 먼저 저장하세요.");
    const incoming = C.fromRows(rows, locale.trim(), version.trim());
    const result = base
      ? C.merge(base, incoming)
      : {
          catalog: incoming,
          report: {
            added: incoming.entries.map((e: any) => e.key),
            changed: [],
            retained: [],
          },
        };
    result.catalog = C.recordUsages(result.catalog, usages, version.trim());
    result.catalog = V.capture(result.catalog, rows, version.trim());
    return result;
  };
  const getCatalog = () => prepare().catalog;
  const attachCatalog = (data: any, name: string) => {
    baseRef.current = data;
    setBase(data);
    setBaseName(name);
    setLocale(data.sourceLocale);
    const p = propose(rows, data);
    setRows(p.output);
    setDirty(dirty || p.changed);
    setPreview("");
  };
  const download = () =>
    guard(() => {
      const result = prepare();
      const md = C.stringify(result.catalog);
      setPreview(md);
      setBase(result.catalog);
      baseRef.current = result.catalog;
      const url = URL.createObjectURL(
        new Blob([md], { type: "text/markdown;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "catalog.md";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      note(
        `새 키 ${result.report.added.length}개 · 변경 제안 ${result.report.changed.length}개 · 기존 키 ${result.report.retained.length}개 보존`,
      );
    });
  const included = rows.filter((r) => !r.excluded),
    excludedCount = rows.length - included.length;
  const missing = included.filter((r) => !r.key).length,
    visible = rows.filter(
      (r) =>
        (showExcluded || !r.excluded) &&
        (r.text + " " + r.key + " " + r.name)
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  return (
    <div className="mx-auto max-w-[780px]">
      <header className="outer-pad flex items-center justify-between border-b bg-white px-6 py-4">
        <div className="flex items-center gap-2.5">
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-tight">
            Keybridge
          </span>
          <Badge
            variant="secondary"
            className="ml-1 text-[10px] font-normal text-zinc-500"
          >
            Beta
          </Badge>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          로컬 작업 공간
        </span>
      </header>
      <main className="outer-pad space-y-5 px-6 py-6">
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Figma</span>
            <ChevronRight className="size-3" />
            <span>번역 키 관리</span>
          </div>
          <h1 className="text-[23px] font-semibold tracking-[-0.8px]">
            디자인에서 개발로, 바로.
          </h1>
          <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
            텍스트에 키를 연결하고, 검수할 문구를 Markdown으로 전달하세요.
          </p>
        </div>
        <nav
          className="flex gap-1 rounded-lg bg-zinc-100 p-1"
          aria-label="작업 화면"
        >
          {[
            ["keys", "키 편집"],
            ["usages", "키 사용처"],
            ["github", "GitHub"],
          ].map(([id, label]) => (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              className={
                "flex-1 " +
                (tab === id ? "bg-white shadow-xs" : "text-muted-foreground")
              }
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <label
            htmlFor="version"
            className="shrink-0 text-xs text-muted-foreground"
          >
            기록 버전
          </label>
          <Input
            id="version"
            aria-label="기록 버전"
            placeholder="예: 1.1.1"
            value={version}
            onChange={(e) => {
              setVersion(e.target.value);
              setPreview("");
            }}
            className="mono h-8 w-32 bg-white text-xs"
          />
          <span className="text-[10px] text-muted-foreground">
            최초 등록·화면 사용 이력을 기록합니다.
          </span>
        </div>
        <div hidden={tab !== "github"}>
          <GitHubPanel
            onLoad={attachCatalog}
            getCatalog={getCatalog}
            sourceLocale={locale}
          />
        </div>
        <div hidden={tab !== "usages"}>
          <UsagePanel
            base={base}
            rows={rows}
            live={usages}
            documentId={usageDoc}
            busy={usageBusy}
            scan={() => {
              setUsageBusy(true);
              send({ type: "usages" });
            }}
            focus={(id) => send({ type: "focus", id })}
            version={version}
          />
        </div>
        <div hidden={tab !== "keys"} className="space-y-5">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {["텍스트 불러오기", "키 연결", "MD 내보내기"].map((label, i) => (
              <React.Fragment key={label}>
                {i > 0 && <div className="h-px flex-1 bg-border" />}
                <span className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={
                      "flex size-5 items-center justify-center rounded-full text-[10px] " +
                      ((i === 0 && rows.length) ||
                      (i === 1 && rows.length && !dirty && !missing)
                        ? "bg-zinc-900 text-white"
                        : "border bg-white")
                    }
                  >
                    {(i === 0 && rows.length) ||
                    (i === 1 && rows.length && !dirty && !missing) ? (
                      <Check className="size-3" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  {label}
                </span>
              </React.Fragment>
            ))}
          </div>
          <Card className="gap-0 rounded-xl py-0 shadow-none">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-zinc-50">
                  <FileText className="size-4 text-zinc-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[12px] font-medium">
                    {base ? baseName : "기존 카탈로그 연결"}
                    {!base && (
                      <span className="text-[10px] font-normal text-muted-foreground">
                        선택 사항
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {base
                      ? `${base.entries.length}개의 키 · 기존 문구와 번역 보존`
                      : "기존 MD를 가져오면 등록된 키를 재사용할 수 있어요."}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  id="import"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <ArrowUpFromLine />
                  {base ? "다른 파일" : "MD 가져오기"}
                </Button>
                {base && (
                  <Button
                    title="카탈로그 연결 해제"
                    aria-label="카탈로그 연결 해제"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      baseRef.current = null;
                      setBase(null);
                      setPreview("");
                      note("카탈로그 연결을 해제했습니다.");
                    }}
                  >
                    <Unlink />
                  </Button>
                )}
              </div>
              <input
                ref={fileRef}
                id="file"
                type="file"
                accept=".md"
                className="hidden"
                onChange={importFile}
              />
            </CardContent>
          </Card>
          <section className="overflow-hidden rounded-xl border bg-white shadow-xs">
            <div className="flex items-center justify-between px-4 pt-4">
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-semibold">텍스트와 키</h2>
                <Badge variant="secondary" className="mono px-1.5 text-[10px]">
                  {rows.length}
                </Badge>
              </div>
              <span
                className={
                  "text-[10px] " +
                  (dirty ? "text-amber-600" : "text-muted-foreground")
                }
              >
                {dirty
                  ? "저장하지 않은 변경"
                  : rows.length
                    ? `${included.length - missing}개 연결됨 · ${excludedCount}개 제외`
                    : "아직 불러온 텍스트가 없어요"}
              </span>
            </div>
            <div className="toolbar-grid p-4">
              <select
                id="scope"
                aria-label="텍스트를 가져올 범위"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="selection">선택한 영역</option>
                <option value="page">현재 페이지 전체</option>
              </select>
              <Button
                id="scan"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={scan}
              >
                <RefreshCw className={busy ? "animate-spin" : ""} />
                불러오기
              </Button>
              <div className="flex-1" />
              <div className="relative">
                <Hash className="pointer-events-none absolute left-3 top-2.5 size-3 text-zinc-400" />
                <Input
                  id="prefix"
                  aria-label="키 접두사"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="mono h-8 w-40 pl-9 pr-3 text-xs"
                />
              </div>
              <Button
                id="generate"
                variant="outline"
                size="sm"
                disabled={!missing || busy}
                onClick={generate}
              >
                <Plus />빈 키 생성
              </Button>
            </div>
            {rows.length > 0 && (
              <div className="relative mx-4 mb-3">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-zinc-400" />
                <Input
                  aria-label="텍스트 또는 키 검색"
                  placeholder="텍스트 또는 키 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-8 border-zinc-200 bg-zinc-50/60 pl-10 pr-3 text-xs"
                />
              </div>
            )}
            <div className="flex items-center justify-between px-4 pb-3 text-[11px] text-muted-foreground">
              <span>
                번역 대상 {included.length}개 · 제외 {excludedCount}개
              </span>
              <label className="flex cursor-pointer items-center gap-3 py-1">
                <input
                  type="checkbox"
                  checked={showExcluded}
                  onChange={(e) => setShowExcluded(e.target.checked)}
                />
                제외 항목 보기
              </label>
            </div>
            <div className="flex border-y bg-zinc-50/80 px-4 py-2 text-[10px] font-medium text-muted-foreground">
              <span>디자인 텍스트 · 번역 키</span>
            </div>
            <div id="rows" className="max-h-[260px] overflow-auto">
              {rows.length === 0 ? (
                <div className="empty-grid flex min-h-[155px] flex-col items-center justify-center gap-2">
                  <div className="mb-1 flex size-10 items-center justify-center rounded-xl border bg-white shadow-xs">
                    <Frame className="size-5 text-zinc-400" />
                  </div>
                  <p className="text-[12px] font-medium">
                    프레임을 선택해 주세요
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Figma에서 영역을 선택하고 ‘불러오기’를 누르세요.
                  </p>
                </div>
              ) : visible.length === 0 ? (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  표시할 항목이 없습니다. 검색어나 제외 항목 보기를 확인하세요.
                </p>
              ) : (
                visible.map((row) => (
                  <div
                    key={row.id}
                    className="key-record border-b px-4 py-4 last:border-b-0 hover:bg-zinc-50/50"
                  >
                    <div className="key-record-source min-w-0">
                      <label className="mb-3 flex w-fit cursor-pointer items-center gap-3 text-[11px] text-muted-foreground">
                        <input
                          type="checkbox"
                          aria-label={row.name + " 번역 대상 포함"}
                          checked={!row.excluded}
                          onChange={(e) => {
                            setRows(
                              rows.map((r) =>
                                r.id === row.id
                                  ? { ...r, excluded: !e.target.checked }
                                  : r,
                              ),
                            );
                            setDirty(true);
                            setPreview("");
                          }}
                        />
                        {row.excluded
                          ? row.exclusionReason || "직접 제외"
                          : "번역 대상"}
                      </label>
                      <p className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-5">
                        {row.text}
                      </p>
                      <p
                        className="mt-1 truncate text-[10px] text-muted-foreground"
                        title={row.ref.frame + " / " + row.name}
                      >
                        {row.ref.frame} / {row.name}
                      </p>
                    </div>
                    <Input
                      aria-label={row.name + " 번역 키"}
                      disabled={!!row.excluded}
                      id={"key-input-" + row.id}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="mono h-10 bg-white px-3 text-[12px] text-zinc-900"
                      value={row.key}
                      placeholder="checkout.payButton"
                      onChange={(e) => {
                        const key = e.target.value;
                        setRows(
                          rows.map((r) =>
                            r.id === row.id ? { ...r, key } : r,
                          ),
                        );
                        setDirty(true);
                        setPreview("");
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={row.name + " 화면에서 보기"}
                      title="Figma에서 보기"
                      onClick={() => send({ type: "focus", id: row.id })}
                    >
                      <LocateFixed className="size-3.5 text-zinc-400" />
                    </Button>
                    <ExistingKeyPicker
                      entries={base?.entries || []}
                      name={row.name}
                      disabled={!!row.excluded || busy}
                      onPick={(key) => {
                        setRows(
                          rows.map((r) =>
                            r.id === row.id ? { ...r, key } : r,
                          ),
                        );
                        setDirty(true);
                        setPreview("");
                        document.getElementById("key-input-" + row.id)?.focus();
                      }}
                    />
                  </div>
                ))
              )}
            </div>
            <div className="space-y-3 border-t px-4 py-4">
              <label className="flex w-fit cursor-pointer items-center gap-3 text-xs">
                <input
                  type="checkbox"
                  checked={annotationsOnSave}
                  onChange={(e) => setAnnotationsOnSave(e.target.checked)}
                />
                키 저장 시 Figma 기본 주석 생성·갱신
              </label>
              <p className="text-[11px] leading-5 text-muted-foreground">
                텍스트 레이어의 기본 주석에 키·문구·버전을 기록합니다. Dev
                Mode의 주석에서 확인하세요. 갱신에 성공하면 이전 도형 카드는
                숨깁니다.
              </p>
              <Button
                id="annotations"
                variant="outline"
                size="sm"
                disabled={!included.some((r) => r.key) || dirty || busy}
                onClick={() => {
                  setBusy(true);
                  send({ type: "annotations", version: version.trim() });
                }}
              >
                Figma 주석 생성·갱신
              </Button>
            </div>
            <div className="flex items-center justify-between gap-2 border-t bg-zinc-50/50 px-4 py-3">
              <p className="text-[10px] text-muted-foreground">
                {missing
                  ? `${missing}개의 텍스트에 키가 필요합니다.`
                  : "문구가 바뀌어도 연결한 키는 유지됩니다."}
              </p>
              <Button
                id="save"
                variant={dirty ? "default" : "outline"}
                size="sm"
                disabled={!rows.length || busy || !dirty}
                onClick={save}
              >
                {dirty ? <Link2 /> : <CheckCheck />}키 연결 저장
              </Button>
            </div>
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="locale"
                className="text-[11px] text-muted-foreground"
              >
                기준 언어
              </label>
              <Input
                id="locale"
                aria-label="기준 언어"
                value={locale}
                disabled={!!base}
                onChange={(e) => setLocale(e.target.value)}
                className="mono h-8 w-16 bg-white text-xs"
              />
            </div>
            <Button
              id="export"
              disabled={!included.length || dirty || busy}
              onClick={download}
            >
              <ArrowDownToLine />
              MD 내보내기
              <ArrowRight className="ml-2" />
            </Button>
          </div>
          {message && (
            <div
              role={error ? "alert" : "status"}
              className={
                "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[11px] leading-5 " +
                (error
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-zinc-200 bg-white text-zinc-600")
              }
            >
              {error ? (
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              ) : (
                <Check className="mt-0.5 size-3.5 shrink-0" />
              )}
              <span className="flex-1 whitespace-pre-wrap">{message}</span>
              <button aria-label="알림 닫기" onClick={() => setMessage("")}>
                <X className="mt-0.5 size-3.5" />
              </button>
            </div>
          )}
          {preview && (
            <details open className="rounded-lg border bg-white">
              <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium">
                내보낸 Markdown
              </summary>
              <Textarea
                id="preview"
                aria-label="MD 미리보기"
                readOnly
                value={preview}
                className="mono h-44 rounded-t-none border-0 border-t text-[10px] shadow-none focus-visible:ring-0"
              />
            </details>
          )}
          <p className="flex items-center justify-center gap-1.5 pb-1 text-[10px] text-zinc-400">
            <FileText className="size-3" />
            MD에서 검수하고, JSON으로 앱에 반영하세요.
          </p>
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

import { VersionPanel } from "./VersionPanel";
import React, { useState } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import {
  Search,
  MapPin,
  RefreshCw,
  ExternalLink,
  GitBranch,
} from "lucide-react";
export function UsagePanel({
  base,
  rows,
  live,
  documentId,
  busy,
  scan,
  focus,
  version,
}: {
  base: any;
  rows: any[];
  live: any[];
  documentId: string;
  busy: boolean;
  scan: () => void;
  focus: (id: string) => void;
  version: string;
}) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(""),
    [shared, setShared] = useState(false),
    [filter, setFilter] = useState("all");
  const entries = new Map<string, any>();
  for (const e of base?.entries || [])
    entries.set(e.key, { ...e, refs: [...e.refs], live: [] });
  for (const r of rows.filter((r) => r.key && !r.excluded)) {
    if (!entries.has(r.key))
      entries.set(r.key, {
        key: r.key,
        source: r.text,
        refs: [],
        live: [],
        introducedVersion: version || undefined,
      });
  }
  for (const r of live) {
    if (!entries.has(r.key))
      entries.set(r.key, { key: r.key, source: r.text, refs: [], live: [] });
    entries.get(r.key).live.push(r);
  }
  const places = (e: any) =>
    new Set(
      [...e.refs, ...e.live.map((r: any) => r.ref)].map(
        (r) => r.documentId + "/" + r.nodeId,
      ),
    ).size;
  const versions = [
    ...new Set<string>(
      [...entries.values()].flatMap((e) =>
        e.refs.map((r: any) => r.version).filter(Boolean),
      ),
    ),
  ].sort();
  const list = [...entries.values()]
    .filter(
      (e) =>
        (e.key + " " + e.source).toLowerCase().includes(query.toLowerCase()) &&
        (!shared || places(e) > 1) &&
        (filter === "all" || e.refs.some((r: any) => r.version === filter)),
    )
    .sort((a, b) => a.key.localeCompare(b.key));
  const entry = entries.get(selected);
  return (
    <section className="space-y-4 rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <MapPin className="size-4" />키 사용처
        </h2>
        <Button variant="outline" size="sm" disabled={busy} onClick={scan}>
          <RefreshCw className={busy ? "animate-spin" : ""} />
          현재 파일 전체 조회
        </Button>
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">
        GitHub·MD에 기록한 버전별 화면과 현재 Figma 파일의 연결 위치입니다. 앱
        코드의 사용처는 포함하지 않습니다.
      </p>
      <VersionPanel base={base} />
      <Input
        aria-label="사용처 키 검색"
        placeholder="키 또는 문구 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 py-2 text-xs">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
          />
          여러 위치에 연결된 키만
        </label>
        <select
          aria-label="사용처 버전 필터"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">모든 기록 버전</option>
          {versions.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <div className="max-h-44 overflow-auto rounded-lg border">
        {list.length ? (
          list.map((e) => (
            <button
              key={e.key}
              className={
                "flex w-full items-center justify-between gap-2 border-b px-3 py-2.5 text-left last:border-0 " +
                (selected === e.key ? "bg-zinc-100" : "hover:bg-zinc-50")
              }
              onClick={() => setSelected(e.key)}
            >
              <div className="min-w-0">
                <p className="mono truncate text-[11px]">{e.key}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  {e.source}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {places(e)}곳
              </Badge>
            </button>
          ))
        ) : (
          <p className="p-5 text-center text-xs text-muted-foreground">
            카탈로그를 가져오거나 현재 파일 전체를 조회하세요.
          </p>
        )}
      </div>
      {entry && (
        <div className="space-y-3 rounded-lg border bg-zinc-50/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs">{entry.key}</code>
            <Badge variant="secondary">
              최초 등록 {entry.introducedVersion || "기록 없음"}
            </Badge>
          </div>
          <h3 className="text-xs font-medium">
            현재 파일에서 확인 · {entry.live.length}곳
          </h3>
          {entry.live.map((r: any) => (
            <div
              key={r.ref.nodeId}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span>
                {r.ref.page} / {r.ref.frame}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => focus(r.ref.nodeId)}
              >
                위치 보기
              </Button>
            </div>
          ))}
          {!entry.live.length && (
            <p className="text-[11px] text-muted-foreground">
              조회 결과가 없습니다. 미조회 또는 현재 파일에 연결되지 않은
              키입니다.
            </p>
          )}
          <h3 className="border-t pt-3 text-xs font-medium">
            카탈로그에 기록된 화면
          </h3>
          <div className="max-h-48 space-y-2 overflow-auto">
            {entry.refs
              .filter((r: any) => filter === "all" || r.version === filter)
              .map((r: any, i: number) => (
                <div
                  key={i}
                  className="rounded-md border bg-white p-2 text-[11px]"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {r.version || "버전 미기록"}
                    </Badge>
                    <span className="mono text-[10px] text-muted-foreground">
                      {r.nodeId}
                    </span>
                  </div>
                  <p>
                    {r.page || "페이지 미기록"} / {r.frame || "화면 미기록"}
                  </p>
                  {/^[A-Za-z0-9]+$/.test(r.fileKey || "") && (
                    <a
                      className="mt-1 inline-flex items-center gap-1 underline"
                      target="_blank"
                      rel="noreferrer"
                      href={`https://www.figma.com/design/${r.fileKey}?node-id=${encodeURIComponent(r.nodeId)}`}
                    >
                      Figma 링크
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            기록은 누적됩니다. 삭제된 화면이나 과거 연결이 남아 있을 수
            있습니다.
          </p>
        </div>
      )}
    </section>
  );
}

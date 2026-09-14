import React, { useState } from "react";
import V from "./versions.cjs";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Input } from "./components/ui/input";
const places = (refs: any[]) =>
  [
    ...new Set(
      refs.map((r) => `${r.page || "페이지 미기록"} / ${r.frame || r.nodeId}`),
    ),
  ].join(", ") || "기록 없음";
export function VersionPanel({ base }: { base: any }) {
  const all = V.records(base);
  const [mode, setMode] = useState("list");
  const [current, setCurrent] = useState("");
  const [previous, setPrevious] = useState("");
  const [query, setQuery] = useState("");
  const [changes, setChanges] = useState(false);
  const next = all.find((s: any) => s.version === current) || all.at(-1);
  const prev = all.find((s: any) => s.version === previous) || all.at(-2);
  const match = (e: any) =>
    [e.key, e.value, e.prev?.value, e.next?.value]
      .filter((x) => typeof x === "string")
      .join(" ")
      .toLowerCase()
      .includes(query.toLowerCase());
  const rows = (next?.entries || []).filter(match);
  const comparison = V.compare(prev, next)
    .filter(match)
    .filter(
      (e: any) =>
        !changes ||
        e.state !== "문구 유지" ||
        e.added.length ||
        e.unconfirmed.length,
    );
  return (
    <section
      className="space-y-3 rounded-lg border bg-zinc-50/50 p-3"
      aria-label="버전별 키 목록과 비교"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">버전별 키</h3>
        <Badge variant="outline">{all.length}개 버전</Badge>
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">
        MD·GitHub에 저장한 기록입니다. 문구는 추출 당시 Figma 원문이며, 검수된
        번역과 다를 수 있습니다. 선택한 화면의 기록을 모으므로 버전의 전체 앱
        목록을 보장하지 않습니다.
      </p>
      {!all.length ? (
        <p className="rounded-md border bg-white p-4 text-xs">
          기록 버전을 입력하고 MD 또는 GitHub로 내보낸 뒤 카탈로그를 가져오세요.
          버전별 키 목록과 문구를 여기서 확인할 수 있습니다.
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "list" ? "default" : "outline"}
              onClick={() => setMode("list")}
            >
              버전별 목록
            </Button>
            <Button
              size="sm"
              variant={mode === "compare" ? "default" : "outline"}
              onClick={() => setMode("compare")}
              disabled={all.length < 2}
            >
              두 버전 비교
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4 py-2 text-xs">
            {mode === "compare" && (
              <label className="flex min-w-0 flex-col gap-2">
                기준 버전
                <select
                  className="w-full rounded-md border bg-white p-2"
                  aria-label="비교 기준 버전"
                  value={prev?.version || ""}
                  onChange={(e) => setPrevious(e.target.value)}
                >
                  {all.map((s: any) => (
                    <option key={s.version}>{s.version}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex min-w-0 flex-col gap-2">
              {mode === "compare" ? "비교 버전" : "조회 버전"}
              <select
                className="w-full rounded-md border bg-white p-2"
                aria-label="키 목록 버전"
                value={next.version}
                onChange={(e) => setCurrent(e.target.value)}
              >
                {all.map((s: any) => (
                  <option key={s.version}>{s.version}</option>
                ))}
              </select>
            </label>
          </div>
          <Input
            aria-label="버전 키 검색"
            placeholder="키 또는 버전별 문구 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {mode === "compare" && (
            <label className="flex items-center gap-3 py-2 text-xs">
              <input
                type="checkbox"
                checked={changes}
                onChange={(e) => setChanges(e.target.checked)}
              />
              차이가 있는 키만
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            {mode === "list"
              ? `${next.version} · ${rows.length} / ${next.entries.length}개 키`
              : `${prev?.version} → ${next.version} · ${comparison.length}개 키`}
          </p>
          <div className="max-h-96 overflow-auto rounded-md border bg-white">
            <table
              className="w-full text-left text-[11px]"
              aria-label={
                mode === "list" ? "버전별 키 테이블" : "버전 비교 테이블"
              }
            >
              <thead className="sticky top-0 bg-zinc-100">
                <tr>
                  {(mode === "list"
                    ? ["키", "문구", "기록된 사용처"]
                    : ["키 / 비교 결과", prev?.version, next.version]
                  ).map((h, i) => (
                    <th className="p-2 font-medium" key={i}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mode === "list"
                  ? rows.map((e: any) => (
                      <tr className="border-t align-top" key={e.key}>
                        <td className="break-all p-2 font-mono">{e.key}</td>
                        <td className="whitespace-pre-wrap break-words p-2">
                          {e.value === null ? (
                            <span className="text-muted-foreground">
                              문구 기록 없음
                            </span>
                          ) : (
                            e.value
                          )}
                        </td>
                        <td className="p-2">{places(e.refs)}</td>
                      </tr>
                    ))
                  : comparison.map((e: any) => (
                      <tr className="border-t align-top" key={e.key}>
                        <td className="space-y-1 break-all p-2">
                          <p className="font-mono">{e.key}</p>
                          <Badge
                            variant={
                              e.state === "문구 변경" ? "default" : "outline"
                            }
                          >
                            {e.state}
                          </Badge>
                          {(e.added.length > 0 || e.unconfirmed.length > 0) && (
                            <p className="text-muted-foreground">
                              사용처 추가 {e.added.length} · 미확인{" "}
                              {e.unconfirmed.length}
                            </p>
                          )}
                        </td>
                        {[e.prev, e.next].map((v: any, i: number) => (
                          <td key={i} className="p-2">
                            <p className="whitespace-pre-wrap break-words">
                              {!v
                                ? "키 기록 없음"
                                : v.value === null
                                  ? "문구 기록 없음"
                                  : v.value}
                            </p>
                            {v && (
                              <p className="mt-2 text-muted-foreground">
                                {places(v.refs)}
                              </p>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
            {!(mode === "list" ? rows : comparison).length && (
              <p className="p-4 text-center text-xs text-muted-foreground">
                조건에 맞는 키가 없습니다.
              </p>
            )}
          </div>
          <p className="text-[10px] leading-4 text-muted-foreground">
            누락은 삭제를 뜻하지 않습니다. 이전 기록에 없던 키도 신규 생성으로
            단정하지 않습니다. 같은 버전으로 다시 내보내면 관측한 키의 문구를
            갱신하고 사용처를 누적합니다.
          </p>
        </>
      )}
    </section>
  );
}

import React, { useId, useState } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

// Deliberately rendered in normal layout: native datalist popups obscure the
// focused input in Figma's embedded browser on macOS.
export function ExistingKeyPicker({
  entries,
  name,
  disabled,
  onPick,
}: {
  entries: { key: string; source: string }[];
  name: string;
  disabled: boolean;
  onPick: (key: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const panelId = useId();
  if (!entries.length) return null;
  const matches = entries.filter((e) =>
    (e.key + " " + e.source).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="col-span-full min-w-0">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
        disabled={disabled}
        aria-label={name + " 기존 키 선택"}
        aria-expanded={open && !disabled}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {open && !disabled ? "기존 키 목록 닫기" : "기존 키에서 선택"}
      </Button>
      {open && !disabled && (
        <div
          id={panelId}
          className="mt-2 space-y-2 rounded-lg border bg-zinc-50 p-3"
          aria-label={name + " 기존 키 목록"}
        >
          <Input
            aria-label={name + " 기존 키 검색"}
            placeholder="기존 키 또는 문구 검색"
            value={query}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 bg-white text-xs"
          />
          <div className="max-h-36 overflow-auto rounded-md border bg-white">
            {matches.slice(0, 30).map((e) => (
              <button
                type="button"
                key={e.key}
                className="block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-zinc-100 focus-visible:bg-zinc-100"
                onClick={() => {
                  onPick(e.key);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="block break-all font-mono text-xs">
                  {e.key}
                </span>
                <span className="mt-1 block whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                  {e.source}
                </span>
              </button>
            ))}
            {!matches.length && (
              <p className="p-3 text-xs text-muted-foreground">
                일치하는 기존 키가 없습니다. 위 입력란에서 새 키를 작성하세요.
              </p>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {matches.length}개 일치
            {matches.length > 30
              ? " · 처음 30개 표시, 검색어로 좁혀 주세요."
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}

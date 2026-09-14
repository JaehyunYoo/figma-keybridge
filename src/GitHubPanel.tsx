import React, { useEffect, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import {
  GitBranch,
  GitPullRequest,
  Download,
  Unplug,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import * as G from "./github.cjs";
import * as C from "./catalog.cjs";
export function GitHubPanel({
  onLoad,
  getCatalog,
  sourceLocale,
}: {
  onLoad: (c: any, name: string) => void;
  getCatalog: () => any;
  sourceLocale: string;
}) {
  const [repo, setRepo] = useState("JaehyunYoo/figma-keybridge"),
    [branch, setBranch] = useState("main"),
    [path, setPath] = useState("localization/catalog.md"),
    [token, setToken] = useState(""),
    [snapshot, setSnapshot] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(false),
    [plan, setPlan] = useState<any>(null),
    [result, setResult] = useState("");
  const edited = useRef(false);
  const [storageBusy, setStorageBusy] = useState(false),
    [storageMessage, setStorageMessage] = useState("");
  const sendStorage = (action: string, connection?: any) => {
    if (action !== "load") {
      edited.current = true;
      setStorageBusy(true);
      setStorageMessage("");
    }
    parent.postMessage(
      { pluginMessage: { type: "github-storage-request", action, connection } },
      "*",
    );
  };
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const m = event.data.pluginMessage;
      if (m?.type !== "github-storage-result") return;
      if (m.action !== "load") setStorageBusy(false);
      if (m.error) {
        setStorageMessage(m.error);
        return;
      }
      if (m.action === "load" && !edited.current && m.connection) {
        const c = m.connection;
        if (
          !["token", "repo", "branch", "path"].every(
            (k) => typeof c[k] === "string",
          )
        )
          return;
        setToken(c.token);
        setRepo(c.repo);
        setBranch(c.branch);
        setPath(c.path);
        setStorageMessage("이 기기에 저장된 연결 정보를 불러왔습니다.");
      } else if (m.action === "save")
        setStorageMessage(
          "이 기기에 저장했습니다. 다음 실행부터 자동으로 불러옵니다.",
        );
      else if (m.action === "delete")
        setStorageMessage("이 기기에 저장된 토큰과 연결 정보를 삭제했습니다.");
    };
    window.addEventListener("message", listener);
    sendStorage("load");
    return () => window.removeEventListener("message", listener);
  }, []);
  const input = { repo, branch, path };
  const reset = () => {
    setSnapshot(null);
    setPlan(null);
    setResult("");
    setMessage("");
  };
  const attach = (s: any) => {
    setSnapshot(s);
    setPlan(null);
    if (!s.empty)
      onLoad(
        s.catalog || { schema: "keybridge/v1", sourceLocale, entries: [] },
        `${s.repo} · ${s.branch}`,
      );
    setMessage(
      s.empty
        ? "빈 저장소입니다. 아래 버튼으로 main에 빈 카탈로그를 먼저 생성하세요."
        : s.catalog
          ? "GitHub 카탈로그를 가져왔습니다."
          : "기존 카탈로그가 없습니다. 새 파일을 PR로 추가할 수 있습니다.",
    );
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(false);
    try {
      await fn();
    } catch (e: any) {
      setError(true);
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  const review = () => {
    try {
      const c = getCatalog();
      G.checkCandidate(snapshot, c);
      if (snapshot.catalog && snapshot.catalog.sourceLocale !== c.sourceLocale)
        throw new Error("GitHub와 기준 언어가 다릅니다. 다시 가져오세요.");
      const md = C.stringify(c);
      if (md === snapshot.content) throw new Error("카탈로그 변경이 없습니다.");
      const old = new Map(
        (snapshot.catalog?.entries || []).map((e: any) => [
          e.key,
          JSON.stringify(e),
        ]),
      );
      const changes = c.entries.filter(
        (e: any) => old.get(e.key) !== JSON.stringify(e),
      );
      setPlan({ catalog: c, md, changes });
      setError(false);
      setMessage("아래 변경을 확인한 뒤 초안 PR을 생성하세요.");
    } catch (e: any) {
      setError(true);
      setMessage(e.message);
    }
  };
  return (
    <section className="space-y-4 rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold">
          <GitBranch className="size-4" />
          GitHub 연결
        </h2>
        <Badge variant="outline">{snapshot ? "연결됨" : "연결 전"}</Badge>
      </div>
      <p className="text-xs leading-5 text-muted-foreground">
        카탈로그를 가져오고, 검토할 변경을 초안 PR로 보냅니다.
      </p>
      <label className="block space-y-1 text-xs">
        저장소
        <Input
          aria-label="GitHub 저장소"
          value={repo}
          disabled={busy || storageBusy}
          onChange={(e) => {
            edited.current = true;
            setRepo(e.target.value);
            reset();
          }}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs">
          기준 브랜치
          <Input
            aria-label="GitHub 기준 브랜치"
            value={branch}
            disabled={busy || storageBusy}
            onChange={(e) => {
              edited.current = true;
              setBranch(e.target.value);
              reset();
            }}
          />
        </label>
        <label className="space-y-1 text-xs">
          카탈로그 경로
          <Input
            aria-label="GitHub 카탈로그 경로"
            value={path}
            disabled={busy || storageBusy}
            onChange={(e) => {
              edited.current = true;
              setPath(e.target.value);
              reset();
            }}
          />
        </label>
      </div>
      <label className="block space-y-1 text-xs">
        GitHub fine-grained token
        <Input
          aria-label="GitHub 토큰"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={token}
          disabled={busy || storageBusy}
          placeholder="github_pat_…"
          onChange={(e) => {
            edited.current = true;
            setToken(e.target.value);
            reset();
          }}
        />
      </label>
      <p className="text-[11px] leading-5 text-muted-foreground">
        선택한 저장소의 Contents·Pull requests 읽기/쓰기 권한이 필요합니다. ‘이
        기기에 저장’을 누르면 재실행·업데이트 후에도 불러옵니다. Figma
        문서·MD·Git에는 저장하지 않습니다. 로컬 저장소는 암호화된 비밀 보관함이
        아니므로 개인 기기에서 사용하세요.
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || storageBusy || !token.trim()}
        onClick={() => {
          try {
            const settings = G.settings(input);
            sendStorage("save", { ...settings, token: token.trim() });
          } catch (e: any) {
            setStorageMessage(e.message);
          }
        }}
      >
        이 기기에 저장
      </Button>
      {storageMessage && (
        <p
          role="status"
          className="text-[11px] leading-5 text-muted-foreground"
        >
          {storageMessage}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={busy || !token}
          onClick={() =>
            run(async () => attach(await G.client(token).load(input)))
          }
        >
          <Download />
          카탈로그 가져오기
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || storageBusy}
          onClick={() => {
            setToken("");
            reset();
            sendStorage("delete");
          }}
        >
          <Unplug />
          연결 해제
        </Button>
      </div>
      {snapshot?.empty && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs">
          <p>
            저장소에 커밋이 없어 PR을 만들 수 없습니다. 아래 작업은{" "}
            <strong>{branch}</strong> 브랜치에 빈 <strong>{path}</strong>를 직접
            생성합니다.
          </p>
          <Button
            size="sm"
            disabled={busy || storageBusy}
            onClick={() =>
              run(async () =>
                attach(await G.client(token).initialize(input, sourceLocale)),
              )
            }
          >
            빈 저장소 초기화
          </Button>
        </div>
      )}
      {snapshot && !snapshot.empty && (
        <div className="space-y-3 border-t pt-3">
          <p className="mono text-[10px] text-muted-foreground">
            기준 커밋 {snapshot.commit.slice(0, 8)}
          </p>
          <Button
            size="sm"
            disabled={busy || storageBusy}
            variant="outline"
            onClick={review}
          >
            PR 변경 내용 확인
          </Button>
        </div>
      )}
      {plan && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs font-medium">
            {plan.changes.length}개 키 변경 · {snapshot.repo} /{" "}
            {snapshot.branch}
          </p>
          <ul className="max-h-28 overflow-auto text-xs">
            {plan.changes.map((e: any) => (
              <li key={e.key} className="py-1">
                <code>{e.key}</code>
                {e.pendingSource !== undefined ? " · 원문 재검수 필요" : ""}
              </li>
            ))}
          </ul>
          <details>
            <summary className="cursor-pointer text-xs text-muted-foreground">
              제출할 MD 전체 보기
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[10px]">
              {plan.md}
            </pre>
          </details>
          <Button
            size="sm"
            disabled={busy || storageBusy}
            onClick={() =>
              run(async () => {
                if (C.stringify(getCatalog()) !== plan.md)
                  throw new Error(
                    "검토 후 내용이 변경되었습니다. PR 변경 내용을 다시 확인하세요.",
                  );
                const suffix =
                  Date.now().toString(36) +
                  "-" +
                  Math.random().toString(36).slice(2, 8);
                const p = await G.client(token).publish(
                  snapshot,
                  plan.catalog,
                  "keybridge/" + suffix,
                );
                setResult(p.url);
                setPlan(null);
                setSnapshot(null);
                setMessage(
                  "초안 PR을 생성했습니다. GitHub에서 검토하고 병합하세요.",
                );
              })
            }
          >
            <GitPullRequest />
            {busy ? "처리 중…" : "초안 PR 만들기"}
          </Button>
        </div>
      )}
      {message && (
        <p
          role={error ? "alert" : "status"}
          className={
            "whitespace-pre-wrap text-xs leading-5 " +
            (error ? "text-red-600" : "text-muted-foreground")
          }
        >
          {message}
        </p>
      )}
      {result && (
        <a
          className="inline-flex items-center gap-1 text-xs underline"
          href={result}
          target="_blank"
          rel="noreferrer"
        >
          GitHub PR 열기
          <ExternalLink className="size-3" />
        </a>
      )}
    </section>
  );
}

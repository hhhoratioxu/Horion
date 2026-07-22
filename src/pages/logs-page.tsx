import { useMemo, useState } from "react";
import { LoaderCircle, RefreshCw, Search } from "lucide-react";

import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { PageHeading } from "../components/ui/page-heading";
import { PageState } from "../components/ui/page-state";
import { useCoreStore } from "../stores/core-store";
import type { CoreLogLevel } from "../types/core";
import { cn } from "../utils/cn";

const levelClasses: Record<CoreLogLevel, string> = {
  trace: "border-line bg-surface-raised text-text-subtle",
  debug: "border-line bg-surface-raised text-text-muted",
  info: "border-positive/25 bg-positive-soft text-positive",
  warn: "border-warning/25 bg-warning-soft text-warning",
  error: "border-negative/25 bg-negative-soft text-negative",
};

function formatTimestamp(timestamp: string): string {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
}

export function LogsPage() {
  const [query, setQuery] = useState("");
  const snapshot = useCoreStore((state) => state.snapshot);
  const logs = useCoreStore((state) => state.logs);
  const runtimeAvailable = useCoreStore((state) => state.runtimeAvailable);
  const isRefreshing = useCoreStore((state) => state.isRefreshingLogs);
  const logsError = useCoreStore((state) => state.logsError);
  const refreshLogs = useCoreStore((state) => state.refreshLogs);

  const visibleLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return logs;
    }

    return logs.filter((entry) =>
      `${entry.level} ${entry.stream} ${entry.message}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [logs, query]);

  return (
    <div className="space-y-5">
      <PageHeading
        description="查看 Rust 后端采集的 Mihomo 生命周期与进程输出。"
        eyebrow="Logs"
        title="内核日志"
      />
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1 sm:max-w-md">
          <span className="sr-only">搜索内核日志</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle"
            size={15}
          />
          <input
            className="h-9 w-full rounded-[10px] border border-line bg-surface pl-9 pr-3 text-xs text-text outline-none placeholder:text-text-subtle focus:border-accent/60 focus:ring-2 focus:ring-focus"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder="搜索级别、输出流或消息"
            type="search"
            value={query}
          />
        </label>
        <div className="flex items-center justify-end gap-3">
          <span className="text-[11px] text-text-subtle" role="status">
            {logs.length} 条内核日志
          </span>
          <Button
            disabled={!runtimeAvailable || isRefreshing}
            onClick={() => void refreshLogs()}
          >
            {isRefreshing ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
            ) : (
              <RefreshCw aria-hidden="true" size={15} />
            )}
            刷新
          </Button>
        </div>
      </div>

      {logsError ? (
        <p
          className="rounded-[10px] border border-negative/25 bg-negative-soft px-3 py-2 text-xs leading-5 text-negative"
          role="alert"
        >
          日志读取失败：{logsError}
        </p>
      ) : null}

      {!runtimeAvailable ? (
        <PageState
          description="浏览器预览不会调用 Tauri 命令。请启动 Horion 桌面应用查看真实内核日志。"
          kind="offline"
          title="仅桌面应用可读取日志"
        />
      ) : logs.length === 0 ? (
        <PageState
          action={
            <Button disabled={isRefreshing} onClick={() => void refreshLogs()}>
              <RefreshCw aria-hidden="true" size={15} />
              再次读取
            </Button>
          }
          description={
            snapshot.installed
              ? "后端尚未采集到内核输出。启动内核后，日志会自动刷新。"
              : "安装或导入 Mihomo 内核后，这里将显示真实的生命周期和进程输出。"
          }
          kind="empty"
          title={snapshot.installed ? "暂无内核日志" : "内核尚未安装"}
        />
      ) : visibleLogs.length === 0 ? (
        <PageState
          description="尝试缩短关键词，或搜索日志级别和输出流。"
          kind="empty"
          title="没有匹配的日志"
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-xs font-semibold text-text">Mihomo 进程输出</h2>
            <span className="text-[11px] text-text-subtle">自动刷新</span>
          </div>
          <ol
            aria-label="Mihomo 内核日志"
            className="max-h-[calc(100vh-260px)] min-h-72 overflow-auto font-mono text-xs"
          >
            {visibleLogs.map((entry, index) => (
              <li
                key={`${entry.timestamp}-${entry.stream}-${String(index)}`}
                className="grid gap-2 border-b border-line/70 px-4 py-3 last:border-b-0 lg:grid-cols-[112px_64px_72px_minmax(0,1fr)] lg:items-start"
              >
                <time className="text-[11px] text-text-subtle" dateTime={entry.timestamp}>
                  {formatTimestamp(entry.timestamp)}
                </time>
                <span
                  className={cn(
                    "w-fit rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase",
                    levelClasses[entry.level],
                  )}
                >
                  {entry.level}
                </span>
                <span className="text-[11px] text-text-subtle">{entry.stream}</span>
                <code className="min-w-0 whitespace-pre-wrap break-words text-text-muted">
                  {entry.message}
                </code>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

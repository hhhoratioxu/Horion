import { useEffect, useMemo, useState } from "react";
import {
  CircleCheck,
  CircleX,
  LoaderCircle,
  RefreshCw,
  Search,
  TimerReset,
  X,
} from "lucide-react";

import { filterAndSortNodes, formatDelay } from "../core/proxy-view";
import { ModeSwitch } from "../components/proxy/mode-switch";
import { ProxyTabs } from "../components/navigation/proxy-tabs";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { PageHeading } from "../components/ui/page-heading";
import { PageState } from "../components/ui/page-state";
import { useCoreStore } from "../stores/core-store";
import { useProxyStore } from "../stores/proxy-store";
import type { ProxySort } from "../types/proxy";
import { cn } from "../utils/cn";

export function ProxyNodesPage() {
  const [query, setQuery] = useState("");
  const [protocol, setProtocol] = useState("all");
  const [sort, setSort] = useState<ProxySort>("default");
  const snapshot = useCoreStore((state) => state.snapshot);
  const coreInitialized = useCoreStore((state) => state.initialized);
  const desktopRuntime = useCoreStore((state) => state.runtimeAvailable);
  const overview = useProxyStore((state) => state.overview);
  const initialized = useProxyStore((state) => state.initialized);
  const loading = useProxyStore((state) => state.loading);
  const error = useProxyStore((state) => state.error);
  const testingNames = useProxyStore((state) => state.testingNames);
  const testingAll = useProxyStore((state) => state.testingAll);
  const load = useProxyStore((state) => state.load);
  const testDelay = useProxyStore((state) => state.testDelay);
  const testAll = useProxyStore((state) => state.testAll);
  const cancelTests = useProxyStore((state) => state.cancelTests);

  const connected = snapshot.state === "running" && snapshot.controller_available;
  useEffect(() => {
    if (desktopRuntime && connected) void load();
    return () => { cancelTests(); };
  }, [cancelTests, connected, desktopRuntime, load]);

  const protocols = useMemo(
    () =>
      [...new Set((overview?.nodes ?? []).map((node) => node.type))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [overview],
  );
  const visibleNodes = useMemo(
    () =>
      filterAndSortNodes(overview?.nodes ?? [], {
        protocol,
        query,
        sort,
      }),
    [overview, protocol, query, sort],
  );

  const content = (() => {
    if (!coreInitialized || (connected && !initialized && loading)) {
      return (
        <PageState
          description="正在从本机 Controller 读取代理节点。"
          kind="loading"
          title="正在载入节点"
        />
      );
    }
    if (!desktopRuntime) {
      return (
        <PageState
          description="浏览器预览不会访问本机 Controller。请启动 Horion 桌面应用。"
          kind="offline"
          title="仅桌面应用可读取节点"
        />
      );
    }
    if (!connected) {
      return (
        <PageState
          description="请先安装并启动 Mihomo，再激活一份有效配置。"
          kind="offline"
          title="Controller 尚未连接"
        />
      );
    }
    if (error && !overview) {
      return (
        <PageState
          action={<Button onClick={() => void load()}><RefreshCw aria-hidden="true" size={15} />重试</Button>}
          description={error}
          kind="error"
          title="节点读取失败"
        />
      );
    }
    if (!overview || overview.nodes.length === 0) {
      return (
        <PageState
          action={<Button onClick={() => void load()}><RefreshCw aria-hidden="true" size={15} />重新读取</Button>}
          description="当前配置没有返回可展示的代理节点。"
          kind="empty"
          title="没有代理节点"
        />
      );
    }
    if (visibleNodes.length === 0) {
      return (
        <PageState
          action={<Button onClick={() => { setQuery(""); setProtocol("all"); }}>清除筛选</Button>}
          description="尝试更换关键词或协议类型。"
          kind="empty"
          title="没有匹配的节点"
        />
      );
    }

    return (
      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(180px,1.4fr)_90px_minmax(140px,1fr)_100px_90px] gap-4 border-b border-line bg-surface-raised/65 px-4 py-2.5 text-[11px] font-semibold text-text-subtle lg:grid">
          <span>节点</span><span>协议</span><span>地址 / 分组</span><span>状态</span><span className="text-right">操作</span>
        </div>
        <ul aria-label="代理节点">
          {visibleNodes.map((node) => {
            const testing = testingNames.includes(node.name);
            return (
              <li
                key={node.name}
                className="grid gap-3 border-b border-line/75 px-4 py-3.5 last:border-0 lg:grid-cols-[minmax(180px,1.4fr)_90px_minmax(140px,1fr)_100px_90px] lg:items-center lg:gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", node.alive ? "bg-positive" : "bg-text-subtle")} />
                    <p className="truncate text-sm font-semibold text-text" title={node.name}>{node.name}</p>
                  </div>
                </div>
                <span className="w-fit rounded-md border border-line bg-surface-raised px-2 py-1 text-[10px] font-bold tracking-wide text-text-muted uppercase">
                  {node.type}
                </span>
                <div className="min-w-0 text-xs text-text-muted">
                  <p className="truncate font-mono text-[11px] text-text-subtle">
                    {node.server ? `${node.server}${node.port ? `:${String(node.port)}` : ""}` : "地址未提供"}
                  </p>
                  <p className="mt-1 truncate">{node.groups.length ? node.groups.join(" · ") : "未归入策略组"}</p>
                </div>
                <div className={cn("inline-flex w-fit items-center gap-1.5 text-xs font-semibold", node.alive ? "text-positive" : "text-text-subtle")}>
                  {node.alive ? <CircleCheck aria-hidden="true" size={14} /> : <CircleX aria-hidden="true" size={14} />}
                  {formatDelay(node.delay, node.alive)}
                </div>
                <div className="flex justify-end">
                  <Button
                    aria-label={`测试 ${node.name} 延迟`}
                    className="h-8 px-2.5 text-xs"
                    disabled={testing}
                    onClick={() => void testDelay(node.name)}
                  >
                    {testing ? <LoaderCircle aria-hidden="true" className="animate-spin" size={13} /> : <TimerReset aria-hidden="true" size={13} />}
                    测速
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    );
  })();

  return (
    <div className="space-y-5">
      <PageHeading
        action={<ModeSwitch />}
        description="搜索、筛选并测试 Controller 返回的真实节点。"
        eyebrow="Proxies"
        title="代理节点"
      />
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <ProxyTabs />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="relative min-w-52 flex-1 xl:w-64 xl:flex-none">
            <span className="sr-only">搜索节点</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" size={15} />
            <input
              className="control h-9 w-full pl-9 pr-8"
              onChange={(event) => { setQuery(event.target.value); }}
              placeholder="搜索名称、地址或分组"
              type="search"
              value={query}
            />
            {query ? (
              <button aria-label="清除搜索" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-subtle hover:text-text" onClick={() => { setQuery(""); }} type="button"><X aria-hidden="true" size={14} /></button>
            ) : null}
          </label>
          <select aria-label="协议筛选" className="control h-9 min-w-24" onChange={(event) => { setProtocol(event.target.value); }} value={protocol}>
            <option value="all">全部协议</option>
            {protocols.map((item) => <option key={item} value={item.toLocaleLowerCase()}>{item}</option>)}
          </select>
          <select aria-label="节点排序" className="control h-9 min-w-24" onChange={(event) => { setSort(event.target.value as ProxySort); }} value={sort}>
            <option value="default">默认顺序</option>
            <option value="latency">延迟优先</option>
          </select>
          <Button disabled={!connected || loading} onClick={() => void load()}><RefreshCw aria-hidden="true" className={cn(loading && "animate-spin")} size={14} /></Button>
          {testingAll ? (
            <Button onClick={cancelTests}><X aria-hidden="true" size={14} />取消后续</Button>
          ) : (
            <Button disabled={!connected || !overview?.nodes.length} onClick={() => void testAll(overview?.nodes.map((node) => node.name) ?? [])} variant="primary">
              <TimerReset aria-hidden="true" size={14} />全部测速
            </Button>
          )}
        </div>
      </div>
      {error && overview ? <p className="notice-error" role="alert">{error}</p> : null}
      {content}
    </div>
  );
}

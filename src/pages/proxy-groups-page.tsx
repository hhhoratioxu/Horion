import { useEffect } from "react";
import { Check, ChevronRight, LoaderCircle, RefreshCw } from "lucide-react";

import { formatDelay } from "../core/proxy-view";
import { ProxyTabs } from "../components/navigation/proxy-tabs";
import { ModeSwitch } from "../components/proxy/mode-switch";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { PageHeading } from "../components/ui/page-heading";
import { PageState } from "../components/ui/page-state";
import { useCoreStore } from "../stores/core-store";
import { useProxyStore } from "../stores/proxy-store";
import { cn } from "../utils/cn";

export function ProxyGroupsPage() {
  const snapshot = useCoreStore((state) => state.snapshot);
  const coreInitialized = useCoreStore((state) => state.initialized);
  const desktopRuntime = useCoreStore((state) => state.runtimeAvailable);
  const overview = useProxyStore((state) => state.overview);
  const initialized = useProxyStore((state) => state.initialized);
  const loading = useProxyStore((state) => state.loading);
  const error = useProxyStore((state) => state.error);
  const pendingSelection = useProxyStore((state) => state.pendingSelection);
  const load = useProxyStore((state) => state.load);
  const selectGroup = useProxyStore((state) => state.selectGroup);
  const connected = snapshot.state === "running" && snapshot.controller_available;

  useEffect(() => {
    if (desktopRuntime && connected) void load();
  }, [connected, desktopRuntime, load]);

  let content;
  if (!coreInitialized || (connected && !initialized && loading)) {
    content = <PageState description="正在读取策略组及当前选择。" kind="loading" title="正在载入策略组" />;
  } else if (!desktopRuntime) {
    content = <PageState description="浏览器预览不会访问本机 Controller。" kind="offline" title="仅桌面应用可读取策略组" />;
  } else if (!connected) {
    content = <PageState description="启动内核并激活有效配置后，策略组会显示在这里。" kind="offline" title="Controller 尚未连接" />;
  } else if (error && !overview) {
    content = <PageState action={<Button onClick={() => void load()}><RefreshCw aria-hidden="true" size={15} />重试</Button>} description={error} kind="error" title="策略组读取失败" />;
  } else if (!overview?.groups.length) {
    content = <PageState description="当前配置没有 Controller 可切换的策略组。" kind="empty" title="没有策略组" />;
  } else {
    content = (
      <div className="grid gap-4 xl:grid-cols-2">
        {overview.groups.map((group) => (
          <Card key={group.name} className="overflow-hidden">
            <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-semibold text-text">{group.name}</h2>
                  <span className="rounded-md bg-surface-raised px-1.5 py-0.5 text-[10px] font-bold text-text-subtle uppercase">{group.type}</span>
                </div>
                <p className="mt-1 text-xs text-text-muted">当前：<span className="font-semibold text-accent">{group.now || "未选择"}</span></p>
              </div>
              <span className={cn("shrink-0 text-xs font-semibold", group.alive ? "text-positive" : "text-text-subtle")}>{formatDelay(group.delay, group.alive)}</span>
            </header>
            <div className="max-h-72 overflow-auto p-2">
              {group.all.map((name) => {
                const selected = group.now === name;
                const pending = pendingSelection === `${group.name}\u0000${name}`;
                return (
                  <button
                    key={name}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus",
                      selected ? "bg-accent-soft text-accent" : "text-text-muted hover:bg-surface-hover hover:text-text",
                    )}
                    disabled={Boolean(pendingSelection)}
                    onClick={() => void selectGroup(group.name, name)}
                    type="button"
                  >
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border", selected ? "border-accent/35 bg-accent text-accent-contrast" : "border-line bg-surface-raised")}>
                      {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={12} /> : selected ? <Check aria-hidden="true" size={12} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                    {!selected ? <ChevronRight aria-hidden="true" className="text-text-subtle" size={14} /> : null}
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeading action={<ModeSwitch />} description="查看每个策略组的真实选项，并将选择写回 Mihomo。" eyebrow="Proxies" title="策略组" />
      <div className="flex items-center justify-between gap-3">
        <ProxyTabs />
        <Button disabled={!connected || loading} onClick={() => void load()}><RefreshCw aria-hidden="true" className={cn(loading && "animate-spin")} size={14} />刷新</Button>
      </div>
      {error && overview ? <p className="notice-error" role="alert">{error}</p> : null}
      {content}
    </div>
  );
}

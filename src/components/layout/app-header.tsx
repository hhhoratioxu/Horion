import { Circle, Route, ShieldCheck } from "lucide-react";
import { useLocation } from "react-router-dom";

import { navigationItems } from "../../app/route-meta";
import { coreStatePresentation } from "../../core/core-status";
import { useCoreStore } from "../../stores/core-store";
import { useProfileStore } from "../../stores/profile-store";
import { useProxyStore } from "../../stores/proxy-store";
import { cn } from "../../utils/cn";

const modeLabels = { rule: "规则", global: "全局", direct: "直连" } as const;

export function AppHeader() {
  const location = useLocation();
  const snapshot = useCoreStore((state) => state.snapshot);
  const initialized = useCoreStore((state) => state.initialized);
  const runtimeAvailable = useCoreStore((state) => state.runtimeAvailable);
  const activeProfile = useProfileStore((state) => state.profiles.find((item) => item.active));
  const mode = useProxyStore((state) => state.overview?.mode ?? null);
  const page = navigationItems.find((item) =>
    item.matchPrefix
      ? location.pathname.startsWith(item.matchPrefix)
      : location.pathname === item.path,
  );
  const presentation = coreStatePresentation[snapshot.state];
  const coreOnline = snapshot.state === "running" && snapshot.healthy;

  return (
    <header className="shrink-0 border-b border-line bg-canvas/90 px-5 backdrop-blur-xl xl:px-6">
      <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-text-subtle uppercase">Horion / Desktop</p>
          <h1 className="mt-0.5 truncate text-sm font-semibold text-text">{page?.label ?? "Horion"}</h1>
        </div>
        <div aria-label="运行状态" className="flex min-w-0 items-center justify-end gap-2">
          <div className="hidden h-8 max-w-48 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[11px] text-text-muted md:flex" title={activeProfile?.name ?? "尚未激活配置"}>
            <ShieldCheck aria-hidden="true" className={activeProfile ? "text-positive" : "text-text-subtle"} size={13} />
            <span className="truncate">{activeProfile?.name ?? "未选择配置"}</span>
          </div>
          <div className="hidden h-8 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-[11px] text-text-muted xl:flex">
            <Route aria-hidden="true" size={13} />
            {mode ? `${modeLabels[mode]}模式` : "模式未连接"}
          </div>
          <div
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg border px-2.5 text-[11px] font-semibold",
              coreOnline
                ? "border-positive/25 bg-positive-soft text-positive"
                : snapshot.state === "error" || snapshot.state === "crashed"
                  ? "border-negative/25 bg-negative-soft text-negative"
                  : "border-line bg-surface text-text-muted",
            )}
            role="status"
          >
            <Circle aria-hidden="true" className={cn("fill-current", !initialized && "animate-pulse")} size={7} />
            {!initialized
              ? "检测中"
              : !runtimeAvailable
                ? "桌面能力不可用"
                : presentation.label}
          </div>
          <span className="hidden h-8 items-center rounded-lg border border-line bg-surface px-2.5 text-[10px] text-text-subtle 2xl:flex">系统代理未接入</span>
        </div>
      </div>
    </header>
  );
}

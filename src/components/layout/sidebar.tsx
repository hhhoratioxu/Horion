import { ChevronLeft, ChevronRight, Orbit } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { navigationItems } from "../../app/route-meta";
import { useCoreStore } from "../../stores/core-store";
import { useLayoutStore } from "../../stores/layout-store";
import { cn } from "../../utils/cn";
import { Button } from "../ui/button";

export function Sidebar() {
  const location = useLocation();
  const collapsed = useLayoutStore((state) => state.sidebarCollapsed);
  const toggle = useLayoutStore((state) => state.toggleSidebar);
  const snapshot = useCoreStore((state) => state.snapshot);
  const online = snapshot.state === "running" && snapshot.healthy;

  return (
    <aside
      className={cn(
        "relative z-10 flex shrink-0 flex-col border-r border-line bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[72px]" : "w-[72px] min-[1180px]:w-[224px]",
      )}
    >
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-accent/20 bg-accent text-accent-contrast shadow-[0_8px_24px_rgba(82,111,214,0.22)]">
          <Orbit aria-hidden="true" size={21} strokeWidth={2.2} />
        </div>
        <div className={cn("min-w-0", collapsed ? "hidden" : "hidden min-[1180px]:block")}>
          <p className="text-[15px] font-bold tracking-[-0.01em] text-text">Horion</p>
          <p className="mt-0.5 text-[9px] font-semibold tracking-[0.17em] text-text-subtle uppercase">Network control</p>
        </div>
      </div>

      <nav aria-label="主导航" className="flex-1 space-y-1 px-2.5 py-4">
        {navigationItems.map((item) => {
          const active = item.matchPrefix
            ? location.pathname.startsWith(item.matchPrefix)
            : location.pathname === item.path;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              aria-label={item.label}
              className={cn(
                "group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus",
                active
                  ? "bg-surface text-text shadow-sm ring-1 ring-line"
                  : "text-text-muted hover:bg-surface-hover hover:text-text",
              )}
              title={collapsed ? item.label : item.description}
              to={item.path}
            >
              {active ? <span className="absolute -left-2.5 h-5 w-0.5 rounded-r-full bg-accent" /> : null}
              <Icon aria-hidden="true" className={cn("shrink-0", active && "text-accent")} size={18} strokeWidth={active ? 2.25 : 1.85} />
              <span className={cn("truncate", collapsed ? "hidden" : "hidden min-[1180px]:block")}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-line p-2.5">
        <div className={cn("mb-2 rounded-xl border border-line bg-surface/70 p-3", collapsed ? "hidden" : "hidden min-[1180px]:block")}>
          <div className="flex items-center gap-2 text-xs font-semibold text-text">
            <span className={cn("size-1.5 rounded-full", online ? "bg-positive" : "bg-text-subtle")} />
            {online ? "本地内核在线" : "本地内核离线"}
          </div>
          <p className="mt-1.5 truncate text-[10px] text-text-subtle">{snapshot.version ? `Mihomo v${snapshot.version}` : "尚未安装 Mihomo"}</p>
        </div>
        <Button aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"} className="w-full px-0 max-[1179px]:!hidden" onClick={toggle} title={collapsed ? "展开侧边栏" : "收起侧边栏"} variant="ghost">
          {collapsed ? <ChevronRight aria-hidden="true" size={16} /> : <><ChevronLeft aria-hidden="true" size={16} /><span>收起侧边栏</span></>}
        </Button>
      </div>
    </aside>
  );
}

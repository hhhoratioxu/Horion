import { ChevronLeft, ChevronRight, Orbit } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { navigationItems } from "../../app/route-meta";
import { coreStatePresentation } from "../../core/core-status";
import { useCoreStore } from "../../stores/core-store";
import { useLayoutStore } from "../../stores/layout-store";
import { cn } from "../../utils/cn";
import { Button } from "../ui/button";

export function Sidebar() {
  const location = useLocation();
  const sidebarCollapsed = useLayoutStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar);
  const snapshot = useCoreStore((state) => state.snapshot);
  const corePresentation = coreStatePresentation[snapshot.state];

  return (
    <aside
      className={cn(
        "relative z-10 flex shrink-0 flex-col border-r border-line bg-sidebar transition-[width] duration-200",
        sidebarCollapsed ? "w-[76px]" : "w-[76px] min-[1180px]:w-56",
      )}
    >
      <div className="flex h-[68px] items-center gap-3 border-b border-line px-[18px]">
        <div className="grid size-10 shrink-0 place-items-center rounded-[13px] bg-accent text-accent-contrast shadow-[0_10px_28px_rgba(88,211,197,0.22)]">
          <Orbit aria-hidden="true" size={22} strokeWidth={2.1} />
        </div>
        <div
          className={cn(
            "min-w-0",
            sidebarCollapsed ? "hidden" : "hidden min-[1180px]:block",
          )}
        >
          <p className="text-[15px] font-bold tracking-[0.02em] text-text">Horion</p>
          <p className="text-[10px] font-semibold tracking-[0.15em] text-text-subtle uppercase">
            Desktop
          </p>
        </div>
      </div>

      <nav aria-label="主导航" className="flex-1 space-y-1.5 px-3 py-5">
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
                "group flex h-11 items-center gap-3 rounded-[11px] px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus",
                active
                  ? "bg-accent-soft text-accent"
                  : "text-text-muted hover:bg-surface-hover hover:text-text",
              )}
              title={sidebarCollapsed ? item.label : item.description}
              to={item.path}
            >
              <Icon
                aria-hidden="true"
                className="shrink-0"
                size={18}
                strokeWidth={active ? 2.3 : 1.9}
              />
              <span
                className={cn(
                  "truncate",
                  sidebarCollapsed ? "hidden" : "hidden min-[1180px]:block",
                )}
              >
                {item.label}
              </span>
              {active && !sidebarCollapsed ? (
                <ChevronRight
                  aria-hidden="true"
                  className="ml-auto hidden min-[1180px]:block"
                  size={14}
                />
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-line p-3">
        <div
          className={cn(
            "mb-3 rounded-[11px] border border-line bg-surface-raised p-3",
            sidebarCollapsed ? "hidden" : "hidden min-[1180px]:block",
          )}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-text">
            <span
              className={cn(
                "size-1.5 rounded-full",
                snapshot.state === "running" ? "bg-positive" : "bg-text-subtle",
              )}
            />
            内核：{corePresentation.label}
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-text-subtle">
            {snapshot.version ? `Mihomo ${snapshot.version}` : "可在首页安装或管理内核。"}
          </p>
        </div>
        <Button
          aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          className="hidden w-full px-0 min-[1180px]:flex"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          variant="ghost"
        >
          {sidebarCollapsed ? (
            <ChevronRight aria-hidden="true" size={17} />
          ) : (
            <>
              <ChevronLeft aria-hidden="true" size={17} />
              <span>收起侧边栏</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

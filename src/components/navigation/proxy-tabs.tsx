import { NavLink } from "react-router-dom";

import { cn } from "../../utils/cn";

const tabs = [
  { label: "节点", path: "/proxies/nodes" },
  { label: "代理组", path: "/proxies/groups" },
] as const;

export function ProxyTabs() {
  return (
    <div className="inline-flex rounded-[11px] border border-line bg-surface-raised p-1">
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          className={({ isActive }) =>
            cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus",
              isActive
                ? "bg-surface text-text shadow-sm"
                : "text-text-muted hover:text-text",
            )
          }
          to={tab.path}
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}

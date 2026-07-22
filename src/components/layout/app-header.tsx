import { ShieldCheck } from "lucide-react";

import { StatusChip } from "../ui/status-chip";

const runtimeStatuses = [
  { label: "当前配置", value: "未连接" },
  { label: "当前节点", value: "未连接" },
  { label: "代理模式", value: "未连接" },
  { label: "系统代理", value: "未连接" },
  { label: "TUN", value: "未连接" },
  { label: "内核", value: "未连接" },
] as const;

export function AppHeader() {
  return (
    <header className="border-b border-line bg-surface/82 px-5 backdrop-blur-xl xl:px-6">
      <div className="mx-auto flex h-[68px] max-w-[1680px] items-center gap-4">
        <div className="hidden min-w-40 shrink-0 2xl:block">
          <div className="flex items-center gap-2 text-xs font-semibold text-text">
            <ShieldCheck aria-hidden="true" className="text-accent" size={15} />
            本地控制台
          </div>
          <p className="mt-1 text-[11px] text-text-subtle">尚未连接 Mihomo</p>
        </div>
        <div
          aria-label="运行状态"
          className="scrollbar-none flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
        >
          {runtimeStatuses.map((status) => (
            <StatusChip key={status.label} {...status} />
          ))}
        </div>
      </div>
    </header>
  );
}

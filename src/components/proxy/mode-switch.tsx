import { LoaderCircle } from "lucide-react";

import { useProxyStore } from "../../stores/proxy-store";
import type { ProxyMode } from "../../types/proxy";
import { cn } from "../../utils/cn";

const modes: { label: string; value: ProxyMode }[] = [
  { label: "规则", value: "rule" },
  { label: "全局", value: "global" },
  { label: "直连", value: "direct" },
];

export function ModeSwitch() {
  const mode = useProxyStore((state) => state.overview?.mode ?? null);
  const pendingMode = useProxyStore((state) => state.pendingMode);
  const setMode = useProxyStore((state) => state.setMode);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div aria-label="代理模式" className="inline-flex rounded-xl border border-line bg-surface-raised p-1" role="group">
        {modes.map((item) => {
          const selected = mode === item.value;
          const pending = pendingMode === item.value;
          return (
            <button
              key={item.value}
              aria-pressed={selected}
              className={cn(
                "inline-flex h-7 min-w-14 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-50",
                selected
                  ? "bg-surface text-text shadow-sm ring-1 ring-line"
                  : "text-text-muted hover:text-text",
              )}
              disabled={Boolean(pendingMode) || !mode}
              onClick={() => void setMode(item.value)}
              type="button"
            >
              {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={12} /> : null}
              {item.label}
            </button>
          );
        })}
      </div>
      <span className="text-[10px] font-medium text-text-subtle">仅对当前内核运行会话生效</span>
    </div>
  );
}

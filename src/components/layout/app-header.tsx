import { ShieldCheck } from "lucide-react";

import { coreStatePresentation } from "../../core/core-status";
import { useCoreStore } from "../../stores/core-store";
import type { StatusTone } from "../../types/status";
import { StatusChip } from "../ui/status-chip";

const unavailableStatuses = [
  { label: "当前配置", value: "未接入" },
  { label: "当前节点", value: "未接入" },
  { label: "代理模式", value: "未接入" },
  { label: "系统代理", value: "未接入" },
  { label: "TUN", value: "未接入" },
] as const;

export function AppHeader() {
  const snapshot = useCoreStore((state) => state.snapshot);
  const runtimeAvailable = useCoreStore((state) => state.runtimeAvailable);
  const initialized = useCoreStore((state) => state.initialized);
  const statusError = useCoreStore((state) => state.statusError);
  const presentation = coreStatePresentation[snapshot.state];

  let coreValue = presentation.label;
  let coreTone: StatusTone = presentation.tone;
  if (!runtimeAvailable && initialized) {
    coreValue = "仅桌面端";
    coreTone = "warning";
  } else if (statusError) {
    coreValue = "读取失败";
    coreTone = "negative";
  } else if (!initialized) {
    coreValue = "检测中";
    coreTone = "neutral";
  } else if (snapshot.state === "running" && !snapshot.healthy) {
    coreValue = "运行异常";
    coreTone = "warning";
  }

  const controllerValue = snapshot.controller_available ? "可用" : "未连接";
  const controllerTone: StatusTone = snapshot.controller_available
    ? "positive"
    : snapshot.state === "running"
      ? "warning"
      : "neutral";

  return (
    <header className="border-b border-line bg-surface/82 px-5 backdrop-blur-xl xl:px-6">
      <div className="mx-auto flex h-[68px] max-w-[1680px] items-center gap-4">
        <div className="hidden min-w-40 shrink-0 2xl:block">
          <div className="flex items-center gap-2 text-xs font-semibold text-text">
            <ShieldCheck aria-hidden="true" className="text-accent" size={15} />
            本地控制台
          </div>
          <p className="mt-1 text-[11px] text-text-subtle">
            {snapshot.state === "running" ? "Mihomo 进程已启动" : "系统代理保持关闭"}
          </p>
        </div>
        <div
          aria-label="运行状态"
          className="scrollbar-none flex min-w-0 flex-1 items-center gap-2 overflow-x-auto"
        >
          {unavailableStatuses.map((status) => (
            <StatusChip key={status.label} {...status} />
          ))}
          <StatusChip label="内核" tone={coreTone} value={coreValue} />
          <StatusChip
            label="Controller"
            tone={controllerTone}
            value={controllerValue}
          />
        </div>
      </div>
    </header>
  );
}

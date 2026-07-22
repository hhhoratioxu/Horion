import { useState } from "react";
import {
  Check,
  Download,
  FileInput,
  Laptop,
  LoaderCircle,
  Moon,
  Sun,
} from "lucide-react";

import {
  coreStatePresentation,
  getCoreSourceLabel,
  transitionalCoreStates,
} from "../core/core-status";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { FeatureBadge } from "../components/ui/feature-badge";
import { PageHeading } from "../components/ui/page-heading";
import { useCoreStore } from "../stores/core-store";
import { useThemeStore } from "../stores/theme-store";
import type { ThemePreference } from "../types/theme";
import { cn } from "../utils/cn";

const themeOptions = [
  { value: "dark", label: "深色", description: "默认主题", icon: Moon },
  { value: "light", label: "浅色", description: "明亮界面", icon: Sun },
  { value: "system", label: "跟随系统", description: "同步 Windows", icon: Laptop },
] satisfies readonly {
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Moon;
}[];

const futureSections = [
  { title: "常规设置", description: "开机启动、静默启动、窗口关闭行为与更新检查", phase: 2 },
  { title: "网络设置", description: "代理端口、局域网访问、IPv6、UDP 与连接参数", phase: 6 },
  { title: "高级设置", description: "诊断信息、数据目录、缓存与实验性能力", phase: 7 },
] as const;

export function SettingsPage() {
  const [importPath, setImportPath] = useState("");
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const snapshot = useCoreStore((state) => state.snapshot);
  const runtimeAvailable = useCoreStore((state) => state.runtimeAvailable);
  const pendingAction = useCoreStore((state) => state.pendingAction);
  const actionError = useCoreStore((state) => state.actionError);
  const clearActionError = useCoreStore((state) => state.clearActionError);
  const installOfficial = useCoreStore((state) => state.installOfficial);
  const importFromPath = useCoreStore((state) => state.importFromPath);

  const presentation = coreStatePresentation[snapshot.state];
  const coreBusy = Boolean(pendingAction) || transitionalCoreStates.has(snapshot.state);
  const coreRunning = snapshot.state === "running";
  const controlsDisabled = coreBusy || coreRunning || !runtimeAvailable;
  const visibleError = actionError ?? snapshot.last_error;

  return (
    <div className="space-y-5">
      <PageHeading
        description="管理界面主题和本机 Mihomo 内核。涉及系统网络的设置仍保持关闭。"
        eyebrow="Settings"
        title="设置"
      />

      <Card aria-busy={coreBusy} className="p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-text">Mihomo 内核</h2>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                  presentation.tone === "positive" &&
                    "border-positive/25 bg-positive-soft text-positive",
                  presentation.tone === "warning" &&
                    "border-warning/25 bg-warning-soft text-warning",
                  presentation.tone === "negative" &&
                    "border-negative/25 bg-negative-soft text-negative",
                  presentation.tone === "neutral" &&
                    "border-line bg-surface-raised text-text-muted",
                )}
                role="status"
              >
                {presentation.label}
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-xs leading-5 text-text-muted">
              推荐安装固定并经过校验的官方 v1.19.29；也可以导入本机已有的 Mihomo 可执行文件。
              {coreRunning ? " 请先在首页停止内核，再更换文件。" : ""}
            </p>
          </div>
          <Button
            disabled={controlsDisabled}
            onClick={() => void installOfficial()}
            variant="primary"
          >
            {pendingAction === "install_official" ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
            ) : (
              <Download aria-hidden="true" size={15} />
            )}
            {snapshot.installed ? "重新安装 v1.19.29" : "安装已验证版本 v1.19.29"}
          </Button>
        </div>

        {!runtimeAvailable ? (
          <p className="mt-4 rounded-[10px] border border-warning/25 bg-warning-soft px-3 py-2 text-xs text-warning">
            浏览器预览不会调用本机能力。请在 Horion 桌面应用中执行安装或导入。
          </p>
        ) : null}
        {visibleError ? (
          <p
            className="mt-4 rounded-[10px] border border-negative/25 bg-negative-soft px-3 py-2 text-xs leading-5 text-negative"
            role="alert"
          >
            {visibleError}
          </p>
        ) : null}

        <dl className="mt-5 grid gap-3 rounded-[12px] border border-line bg-surface-raised p-4 text-xs md:grid-cols-3">
          <div>
            <dt className="text-text-subtle">版本</dt>
            <dd className="mt-1 font-semibold text-text">{snapshot.version ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-text-subtle">来源</dt>
            <dd className="mt-1 font-semibold text-text">
              {getCoreSourceLabel(snapshot.source)}
            </dd>
          </div>
          <div>
            <dt className="text-text-subtle">当前文件</dt>
            <dd className="mt-1 break-all font-mono text-[11px] text-text">
              {snapshot.path ?? "—"}
            </dd>
          </div>
        </dl>

        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            void importFromPath(importPath);
          }}
        >
          <label className="text-xs font-semibold text-text" htmlFor="core-import-path">
            从本机路径导入
          </label>
          <p className="mt-1 text-[11px] leading-5 text-text-subtle" id="core-import-help">
            输入 `mihomo.exe` 的完整绝对路径。后端会执行 `-v` 验证身份；请只导入你信任的
            Mihomo 文件。
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              autoComplete="off"
              className="h-9 min-w-0 flex-1 rounded-[10px] border border-line bg-surface-raised px-3 font-mono text-xs text-text outline-none placeholder:text-text-subtle focus:border-accent/60 focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
              disabled={controlsDisabled}
              id="core-import-path"
              aria-describedby="core-import-help"
              onChange={(event) => {
                setImportPath(event.target.value);
                clearActionError();
              }}
              placeholder="C:\\Tools\\mihomo.exe"
              spellCheck={false}
              type="text"
              value={importPath}
            />
            <Button disabled={controlsDisabled} type="submit">
              {pendingAction === "import_from_path" ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" size={15} />
              ) : (
                <FileInput aria-hidden="true" size={15} />
              )}
              导入内核
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <div>
          <h2 className="text-sm font-semibold text-text">外观</h2>
          <p className="mt-1 text-xs text-text-muted">选择界面主题，设置会保存在本机。</p>
        </div>
        <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const selected = preference === option.value;

            return (
              <button
                key={option.value}
                aria-pressed={selected}
                className={cn(
                  "relative flex items-center gap-3 rounded-[12px] border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus",
                  selected
                    ? "border-accent/50 bg-accent-soft"
                    : "border-line bg-surface-raised hover:border-line-strong",
                )}
                onClick={() => {
                  setPreference(option.value);
                }}
                type="button"
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-[10px]",
                    selected ? "bg-accent text-accent-contrast" : "bg-surface text-text-muted",
                  )}
                >
                  <Icon aria-hidden="true" size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-text">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] text-text-subtle">
                    {option.description}
                  </span>
                </span>
                {selected ? (
                  <Check aria-hidden="true" className="absolute right-2 top-2 text-accent" size={13} />
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {futureSections.map((section) => (
          <Card key={section.title} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-text">{section.title}</h2>
                <p className="mt-1.5 text-xs leading-5 text-text-muted">{section.description}</p>
              </div>
              <FeatureBadge phase={section.phase} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

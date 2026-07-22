import { Check, Laptop, Moon, Sun } from "lucide-react";

import { Card } from "../components/ui/card";
import { FeatureBadge } from "../components/ui/feature-badge";
import { PageHeading } from "../components/ui/page-heading";
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
  { title: "内核设置", description: "内核路径、Controller 地址、工作目录与日志等级", phase: 3 },
  { title: "网络设置", description: "代理端口、局域网访问、IPv6、UDP 与连接参数", phase: 6 },
  { title: "高级设置", description: "诊断信息、数据目录、缓存与实验性能力", phase: 7 },
] as const;

export function SettingsPage() {
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  return (
    <div className="space-y-5">
      <PageHeading
        description="主题偏好已经可用；涉及系统或内核的设置会按阶段逐步开放。"
        eyebrow="Settings"
        title="设置"
      />

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
                    selected
                      ? "bg-accent text-accent-contrast"
                      : "bg-surface text-text-muted",
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
                <p className="mt-1.5 text-xs leading-5 text-text-muted">
                  {section.description}
                </p>
              </div>
              <FeatureBadge phase={section.phase} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

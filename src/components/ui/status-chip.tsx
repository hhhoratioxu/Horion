import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";

import type { StatusTone } from "../../types/status";
import { cn } from "../../utils/cn";

interface StatusChipProps {
  label: string;
  tone?: StatusTone;
  value: string;
}

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-line bg-surface-raised text-text-muted",
  positive: "border-positive/25 bg-positive-soft text-positive",
  warning: "border-warning/25 bg-warning-soft text-warning",
  negative: "border-negative/25 bg-negative-soft text-negative",
};

const toneIcons: Record<StatusTone, LucideIcon> = {
  neutral: CircleDashed,
  positive: CircleCheck,
  warning: CircleAlert,
  negative: CircleAlert,
};

export function StatusChip({ label, tone = "neutral", value }: StatusChipProps) {
  const Icon = toneIcons[tone];

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 rounded-[10px] border px-2.5",
        toneClasses[tone],
      )}
      title={`${label}：${value}`}
    >
      <Icon aria-hidden="true" size={13} strokeWidth={2.2} />
      <span className="text-[11px] text-text-subtle">{label}</span>
      <span className="max-w-24 truncate text-xs font-semibold">{value}</span>
    </div>
  );
}

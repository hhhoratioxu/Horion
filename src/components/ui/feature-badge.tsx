import { Construction } from "lucide-react";

interface FeatureBadgeProps {
  phase: number | string;
}

export function FeatureBadge({ phase }: FeatureBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/25 bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">
      <Construction aria-hidden="true" size={12} strokeWidth={2} />
      阶段 {phase} 开发中
    </span>
  );
}

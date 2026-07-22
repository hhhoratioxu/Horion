import type { LucideIcon } from "lucide-react";

import { Card } from "./card";

interface MetricCardProps {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: string;
}

export function MetricCard({ detail, icon: Icon, label, value }: MetricCardProps) {
  return (
    <Card className="group p-4 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-text">
            {value}
          </p>
        </div>
        <div className="grid size-9 place-items-center rounded-[11px] bg-accent-soft text-accent transition-colors group-hover:bg-accent/20">
          <Icon aria-hidden="true" size={17} />
        </div>
      </div>
      <p className="mt-3 text-[11px] text-text-subtle">{detail}</p>
    </Card>
  );
}

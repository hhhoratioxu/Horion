import {
  CircleAlert,
  Inbox,
  LoaderCircle,
  RadioTower,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";

import type { PageStateKind } from "../../types/status";
import { cn } from "../../utils/cn";
import { Card } from "./card";

interface PageStateProps {
  action?: ReactNode;
  description: string;
  kind: PageStateKind;
  title: string;
}

const icons = {
  loading: LoaderCircle,
  empty: Inbox,
  offline: RadioTower,
  error: CircleAlert,
  development: Wrench,
} satisfies Record<PageStateKind, typeof Inbox>;

export function PageState({ action, description, kind, title }: PageStateProps) {
  const Icon = icons[kind];

  return (
    <Card className="grid min-h-80 place-items-center border-dashed p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid size-12 place-items-center rounded-[14px] border border-line bg-surface-raised text-text-muted">
          <Icon
            aria-hidden="true"
            className={cn(kind === "loading" && "animate-spin")}
            size={22}
          />
        </div>
        <h2 className="text-base font-semibold text-text">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-text-muted">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </Card>
  );
}

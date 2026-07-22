import type { ReactNode } from "react";

interface PageHeadingProps {
  action?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}

export function PageHeading({
  action,
  description,
  eyebrow,
  title,
}: PageHeadingProps) {
  return (
    <header className="flex min-h-14 items-start justify-between gap-5">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-[11px] font-bold tracking-[0.16em] text-accent uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-text">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-text-muted">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

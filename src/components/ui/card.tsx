import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-[14px] border border-line bg-surface shadow-card",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

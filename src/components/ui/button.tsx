import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-contrast shadow-[0_8px_24px_rgba(88,211,197,0.18)] hover:bg-accent-strong",
  secondary:
    "border border-line bg-surface-raised text-text hover:border-line-strong hover:bg-surface-hover",
  ghost: "text-text-muted hover:bg-surface-hover hover:text-text",
};

export function Button({
  children,
  className,
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-[10px] px-3.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-45",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

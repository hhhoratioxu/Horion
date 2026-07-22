import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "./button";

interface ModalProps {
  children: ReactNode;
  description?: string;
  footer?: ReactNode;
  onClose: () => void;
  title: string;
  wide?: boolean;
}

export function Modal({
  children,
  description,
  footer,
  onClose,
  title,
  wide = false,
}: ModalProps) {
  return (
    <div
      aria-labelledby="dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-5 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
    >
      <section
        className={
          wide
            ? "flex max-h-[calc(100vh-40px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
            : "max-h-[calc(100vh-40px)] w-full max-w-lg overflow-auto rounded-2xl border border-line bg-surface shadow-2xl"
        }
      >
        <header className="flex items-start justify-between gap-5 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.01em] text-text" id="dialog-title">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-xs leading-5 text-text-muted">{description}</p>
            ) : null}
          </div>
          <Button aria-label="关闭" className="size-8 shrink-0 p-0" onClick={onClose} variant="ghost">
            <X aria-hidden="true" size={17} />
          </Button>
        </header>
        <div className={wide ? "min-h-0 flex-1 overflow-auto p-5" : "p-5"}>{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
  );
}

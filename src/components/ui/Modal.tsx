"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ICON_STROKE } from "./icons";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  bare?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function Modal({ open, onClose, title, bare, children, footer }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim/40 sm:items-start sm:px-4 sm:pt-24" onMouseDown={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-screen w-full max-w-modal overflow-y-auto rounded-t-container border border-border bg-surface shadow-popover sm:rounded-container"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!bare && title && (
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="text-section font-semibold text-text">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-sm p-1 text-text-muted hover:bg-subtle hover:text-text" aria-label="Close">
              <X size={16} strokeWidth={ICON_STROKE} />
            </button>
          </div>
        )}
        <div className={bare ? "" : "px-5 py-4"}>{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

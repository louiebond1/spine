"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { ICON_STROKE } from "./icons";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Command palette uses a bare modal with no title bar. */
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-text/30 px-4 pt-32" onMouseDown={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-modal rounded-container border border-border bg-surface"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!bare && title && (
          <div className="flex items-center justify-between px-6 pt-6">
            <h2 className="text-section font-semibold text-text">{title}</h2>
            <button type="button" onClick={onClose} className="text-text-muted hover:text-text" aria-label="Close">
              <X size={22} strokeWidth={ICON_STROKE} />
            </button>
          </div>
        )}
        <div className={bare ? "" : "px-6 py-5"}>{children}</div>
        {footer && <div className="flex justify-end gap-4 px-6 pb-6">{footer}</div>}
      </div>
    </div>
  );
}

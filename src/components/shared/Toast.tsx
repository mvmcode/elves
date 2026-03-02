/* Toast notification components — ToastItem renders a single toast, ToastContainer manages the stack. */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToastStore, type Toast, type ToastVariant } from "@/stores/toast";

/** Maps toast variant to its left accent bar color. */
function variantAccentColor(variant: ToastVariant): string {
  switch (variant) {
    case "info": return "#4D96FF";
    case "success": return "#6BCB77";
    case "warning": return "#FF8B3D";
    case "error": return "#FF6B6B";
  }
}

/** Single toast notification with auto-dismiss, close button, and optional action. */
function ToastItem({ toast }: { readonly toast: Toast }): React.JSX.Element {
  const dismissToast = useToastStore((s) => s.dismissToast);

  /* Auto-dismiss after duration (0 = no auto-dismiss) */
  useEffect(() => {
    if (toast.duration <= 0) return;
    const timer = setTimeout(() => dismissToast(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dismissToast]);

  return (
    <motion.div
      layout
      initial={{ x: -320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -320, opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="relative w-80 border-[3px] border-border bg-white shadow-[4px_4px_0px_0px_#000]"
      data-testid="toast-item"
    >
      {/* Accent left bar */}
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ backgroundColor: variantAccentColor(toast.variant) }}
      />

      <div className="py-2 pl-4 pr-8">
        <p className="font-body text-sm font-bold text-text-light">{toast.message}</p>

        {/* Optional action button */}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              dismissToast(toast.id);
            }}
            className="mt-1.5 w-full cursor-pointer border-[2px] border-border bg-surface-elevated px-2 py-1 font-display text-[10px] font-bold uppercase tracking-widest transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            data-testid="toast-action"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => dismissToast(toast.id)}
        className="absolute right-1 top-1 cursor-pointer border-none bg-transparent p-1 font-mono text-xs font-bold text-text-light/30 hover:text-text-light"
        data-testid="toast-close"
      >
        &#10005;
      </button>
    </motion.div>
  );
}

/** Fixed-position container that renders all active toasts at bottom-left. */
export function ToastContainer(): React.JSX.Element | null {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2" data-testid="toast-container">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

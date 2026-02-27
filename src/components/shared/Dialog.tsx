/* Reusable neo-brutalist modal dialog with overlay, Escape key, and click-outside close. */

import { useEffect, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
}

/**
 * Modal dialog with dark overlay, centered card, and Framer Motion slide-up entrance.
 * Closes on Escape key press or overlay click. Uses neo-brutalist styling:
 * 3px border, hard drop shadow, solid white background.
 */
export function Dialog({
  isOpen,
  onClose,
  title,
  children,
}: DialogProps): React.JSX.Element {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          data-testid="dialog-overlay"
        >
          <motion.div
            className="w-full max-w-md border-[3px] border-border bg-white p-6 shadow-brutal-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            data-testid="dialog-content"
          >
            <h2 className="mb-4 font-display text-xl font-black uppercase tracking-tight">
              {title}
            </h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

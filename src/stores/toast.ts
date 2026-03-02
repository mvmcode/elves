/* Toast notification store — manages a stack of ephemeral toast notifications. */

import { create } from "zustand";

/** Visual variant determining the toast's accent color. */
export type ToastVariant = "info" | "success" | "warning" | "error";

/** A single toast notification. */
export interface Toast {
  readonly id: string;
  readonly message: string;
  readonly variant: ToastVariant;
  readonly duration: number;
  readonly action?: { readonly label: string; readonly onClick: () => void };
  readonly createdAt: number;
}

/** Maximum number of visible toasts — oldest are evicted FIFO when exceeded. */
const MAX_VISIBLE = 5;

interface ToastState {
  readonly toasts: readonly Toast[];
  /** Add a toast and return its generated ID. Evicts oldest if over MAX_VISIBLE. */
  addToast: (toast: Omit<Toast, "id" | "createdAt">) => string;
  /** Remove a single toast by ID. */
  dismissToast: (id: string) => void;
  /** Remove all toasts. */
  clearAll: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: Toast = { ...toast, id, createdAt: Date.now() };

    set((state) => {
      const updated = [...state.toasts, newToast];
      /* FIFO eviction: keep only the most recent MAX_VISIBLE */
      const trimmed = updated.length > MAX_VISIBLE ? updated.slice(-MAX_VISIBLE) : updated;
      return { toasts: trimmed };
    });

    return id;
  },

  dismissToast: (id): void => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAll: (): void => {
    set({ toasts: [] });
  },
}));

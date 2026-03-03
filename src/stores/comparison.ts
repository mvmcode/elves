/* Comparison store — holds the left/right sessions selected for side-by-side comparison. */

import { create } from "zustand";
import type { ComparisonSession } from "@/types/comparison";

interface ComparisonState {
  /** Left-side session and events (null when not yet selected). */
  readonly left: ComparisonSession | null;
  /** Right-side session and events (null when not yet selected). */
  readonly right: ComparisonSession | null;

  setLeft: (session: ComparisonSession) => void;
  setRight: (session: ComparisonSession) => void;
  clearComparison: () => void;
}

export const useComparisonStore = create<ComparisonState>((set) => ({
  left: null,
  right: null,

  setLeft: (session: ComparisonSession) => set({ left: session }),
  setRight: (session: ComparisonSession) => set({ right: session }),
  clearComparison: () => set({ left: null, right: null }),
}));

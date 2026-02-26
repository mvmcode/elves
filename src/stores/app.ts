/* Global app state — runtime detection results and app-wide UI state. */

import { create } from "zustand";
import type { RuntimeInfo } from "@/types/runtime";

interface AppState {
  /** Detected runtimes on the system (null = not yet checked) */
  readonly runtimes: RuntimeInfo | null;
  /** Whether the app is still initializing */
  readonly isLoading: boolean;

  /** Set runtime detection results after initial scan */
  setRuntimes: (runtimes: RuntimeInfo) => void;
  /** Mark app initialization as complete */
  setLoaded: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  runtimes: null,
  isLoading: true,

  setRuntimes: (runtimes: RuntimeInfo) => set({ runtimes }),
  setLoaded: () => set({ isLoading: false }),
}));

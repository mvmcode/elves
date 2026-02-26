/* Global app state — runtime detection results and app-wide UI state. */

import { create } from "zustand";
import type { RuntimeInfo } from "@/types/runtime";
import type { Runtime } from "@/types/elf";

interface AppState {
  /** Detected runtimes on the system (null = not yet checked) */
  readonly runtimes: RuntimeInfo | null;
  /** Whether the app is still initializing */
  readonly isLoading: boolean;
  /** User-selected default runtime for new tasks */
  readonly defaultRuntime: Runtime;

  /** Set runtime detection results after initial scan */
  setRuntimes: (runtimes: RuntimeInfo) => void;
  /** Mark app initialization as complete */
  setLoaded: () => void;
  /** Set the default runtime for new tasks */
  setDefaultRuntime: (runtime: Runtime) => void;
}

export const useAppStore = create<AppState>((set) => ({
  runtimes: null,
  isLoading: true,
  defaultRuntime: "claude-code",

  setRuntimes: (runtimes: RuntimeInfo) => set({ runtimes }),
  setLoaded: () => set({ isLoading: false }),
  setDefaultRuntime: (defaultRuntime: Runtime) => set({ defaultRuntime }),
}));

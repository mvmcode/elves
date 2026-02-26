/* UI state — tracks panel visibility, modals, and transient UI concerns. */

import { create } from "zustand";

/** Top-level views the shell can render in the main content area. */
export type AppView = "session" | "memory" | "skills" | "mcp" | "history" | "settings";

interface UiState {
  /** Whether the task bar (Cmd+K) is focused/expanded */
  readonly isTaskBarFocused: boolean;
  /** Whether the settings panel is open */
  readonly isSettingsOpen: boolean;
  /** The active view in the main content area */
  readonly activeView: AppView;

  setTaskBarFocused: (focused: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveView: (view: AppView) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isTaskBarFocused: false,
  isSettingsOpen: false,
  activeView: "session",

  setTaskBarFocused: (focused: boolean) => set({ isTaskBarFocused: focused }),
  setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),
  setActiveView: (view: AppView) => set({ activeView: view }),
}));

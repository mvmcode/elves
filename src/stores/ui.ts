/* UI state — tracks panel visibility, modals, and transient UI concerns. */

import { create } from "zustand";

interface UiState {
  /** Whether the task bar (Cmd+K) is focused/expanded */
  readonly isTaskBarFocused: boolean;
  /** Whether the settings panel is open */
  readonly isSettingsOpen: boolean;

  setTaskBarFocused: (focused: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isTaskBarFocused: false,
  isSettingsOpen: false,

  setTaskBarFocused: (focused: boolean) => set({ isTaskBarFocused: focused }),
  setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),
}));

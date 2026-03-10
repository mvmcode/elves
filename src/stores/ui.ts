/* UI state — tracks panel visibility, modals, and transient UI concerns. */

import { create } from "zustand";

/** Top-level views the shell can render in the main content area. */
export type AppView = "workspace" | "files" | "memory" | "skills" | "mcp" | "history" | "settings" | "comparison";

/** Split pane mode when in files view — which panels are visible. */
export type SplitPaneMode = "split" | "files-only" | "workspace-only";

/** Panel width constraints for resizable layout. */
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 400;
const ACTIVITY_FEED_MIN = 280;
const ACTIVITY_FEED_MAX = 600;

/** Clamps a value between min and max (inclusive). */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface UiState {
  /** Whether the task bar (Cmd+K) is focused/expanded */
  readonly isTaskBarFocused: boolean;
  /** Whether the settings panel is open */
  readonly isSettingsOpen: boolean;
  /** The active view in the main content area */
  readonly activeView: AppView;
  /** Whether the new project dialog is visible */
  readonly isNewProjectDialogOpen: boolean;
  /** Sidebar width in pixels, resizable between 200-400. */
  readonly sidebarWidth: number;
  /** Activity feed width in pixels, resizable between 280-600. */
  readonly activityFeedWidth: number;
  /** Whether the activity feed panel is visible. */
  readonly isActivityFeedVisible: boolean;
  /** Session ID to auto-expand in SessionHistory after navigating from completion card. */
  readonly highlightedSessionId: string | null;
  /** Whether the bottom terminal panel is open. */
  readonly isTerminalPanelOpen: boolean;
  /** Height of the bottom terminal panel in pixels. */
  readonly terminalPanelHeight: number;
  /** Whether the sidebar is collapsed to icon-only mode. */
  readonly isSidebarCollapsed: boolean;
  /** Path of the file currently open in the FileViewer, or null. */
  readonly selectedFilePath: string | null;
  /** Whether focus mode is active (hides all chrome, terminal fills screen). */
  readonly isFocusMode: boolean;
  /** Whether the file editor is in edit mode (vs read-only). */
  readonly isFileEditing: boolean;
  /** Whether the file has unsaved changes. */
  readonly isFileDirty: boolean;
  /** Split pane mode when in files view. */
  readonly splitPaneMode: SplitPaneMode;
  /** Split ratio (0-1) — proportion of width allocated to left panel. */
  readonly splitPaneRatio: number;

  setTaskBarFocused: (focused: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveView: (view: AppView) => void;
  setNewProjectDialogOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setActivityFeedWidth: (width: number) => void;
  toggleActivityFeed: () => void;
  setHighlightedSessionId: (id: string | null) => void;
  toggleTerminalPanel: () => void;
  /** One-shot open — sets isTerminalPanelOpen to true only if currently false. */
  openTerminalPanel: () => void;
  setTerminalPanelHeight: (height: number) => void;
  toggleSidebarCollapsed: () => void;
  setSelectedFilePath: (path: string | null) => void;
  toggleFocusMode: () => void;
  setFileEditing: (editing: boolean) => void;
  setFileDirty: (dirty: boolean) => void;
  setSplitPaneMode: (mode: SplitPaneMode) => void;
  setSplitPaneRatio: (ratio: number) => void;
  cycleSplitPaneMode: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isTaskBarFocused: false,
  isSettingsOpen: false,
  activeView: "workspace",
  isNewProjectDialogOpen: false,
  sidebarWidth: 256,
  activityFeedWidth: 384,
  isActivityFeedVisible: false,
  highlightedSessionId: null,
  isTerminalPanelOpen: false,
  terminalPanelHeight: 300,
  isSidebarCollapsed: false,
  selectedFilePath: null,
  isFocusMode: false,
  isFileEditing: false,
  isFileDirty: false,
  splitPaneMode: "split",
  splitPaneRatio: 0.5,

  setTaskBarFocused: (focused: boolean) => set({ isTaskBarFocused: focused }),
  setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),
  setActiveView: (view: AppView) => set({ activeView: view }),
  setNewProjectDialogOpen: (open: boolean) => set({ isNewProjectDialogOpen: open }),
  setSidebarWidth: (width: number) => set({ sidebarWidth: clamp(width, SIDEBAR_MIN, SIDEBAR_MAX) }),
  setActivityFeedWidth: (width: number) => set({ activityFeedWidth: clamp(width, ACTIVITY_FEED_MIN, ACTIVITY_FEED_MAX) }),
  toggleActivityFeed: () => set((state) => ({ isActivityFeedVisible: !state.isActivityFeedVisible })),
  setHighlightedSessionId: (id: string | null) => set({ highlightedSessionId: id }),
  toggleTerminalPanel: () => set((state) => ({ isTerminalPanelOpen: !state.isTerminalPanelOpen })),
  openTerminalPanel: () => set((state) => state.isTerminalPanelOpen ? state : { isTerminalPanelOpen: true }),
  setTerminalPanelHeight: (height: number) => set({ terminalPanelHeight: clamp(height, 150, 800) }),
  toggleSidebarCollapsed: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSelectedFilePath: (path: string | null) => set({ selectedFilePath: path, isFileEditing: false, isFileDirty: false }),
  toggleFocusMode: () => set((state) => ({
    isFocusMode: !state.isFocusMode,
    ...(!state.isFocusMode ? { isTerminalPanelOpen: true } : {}),
  })),
  setFileEditing: (editing: boolean) => set({ isFileEditing: editing }),
  setFileDirty: (dirty: boolean) => set({ isFileDirty: dirty }),
  setSplitPaneMode: (mode: SplitPaneMode) => set({ splitPaneMode: mode }),
  /** Safety bounds — the drag handler enforces tighter pixel-based limits. */
  setSplitPaneRatio: (ratio: number) => set({ splitPaneRatio: clamp(ratio, 0.1, 0.9) }),
  cycleSplitPaneMode: () => set((state) => {
    const order: SplitPaneMode[] = ["split", "files-only", "workspace-only"];
    const idx = order.indexOf(state.splitPaneMode);
    return { splitPaneMode: order[(idx + 1) % order.length] };
  }),
}));

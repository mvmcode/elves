/* UI state — tracks panel visibility, modals, and transient UI concerns. */

import { create } from "zustand";
import type { WorkshopViewMode } from "@/types/workshop";

/** Top-level views the shell can render in the main content area. */
export type AppView = "session" | "files" | "memory" | "skills" | "mcp" | "history" | "settings";

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
  /** Workshop view mode — toggle between pixel art workshop and card grid. */
  readonly workshopViewMode: WorkshopViewMode;
  /** ID of the elf currently selected in the workshop scene. */
  readonly selectedWorkshopElfId: string | null;
  /** Whether the sidebar is collapsed to icon-only mode. */
  readonly isSidebarCollapsed: boolean;

  setTaskBarFocused: (focused: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveView: (view: AppView) => void;
  setNewProjectDialogOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setActivityFeedWidth: (width: number) => void;
  toggleActivityFeed: () => void;
  setHighlightedSessionId: (id: string | null) => void;
  toggleTerminalPanel: () => void;
  setTerminalPanelHeight: (height: number) => void;
  setWorkshopViewMode: (mode: WorkshopViewMode) => void;
  toggleWorkshopViewMode: () => void;
  setSelectedWorkshopElfId: (id: string | null) => void;
  toggleSidebarCollapsed: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isTaskBarFocused: false,
  isSettingsOpen: false,
  activeView: "session",
  isNewProjectDialogOpen: false,
  sidebarWidth: 256,
  activityFeedWidth: 384,
  isActivityFeedVisible: false,
  highlightedSessionId: null,
  isTerminalPanelOpen: false,
  terminalPanelHeight: 300,
  workshopViewMode: "workshop" as WorkshopViewMode,
  selectedWorkshopElfId: null,
  isSidebarCollapsed: false,

  setTaskBarFocused: (focused: boolean) => set({ isTaskBarFocused: focused }),
  setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),
  setActiveView: (view: AppView) => set({ activeView: view }),
  setNewProjectDialogOpen: (open: boolean) => set({ isNewProjectDialogOpen: open }),
  setSidebarWidth: (width: number) => set({ sidebarWidth: clamp(width, SIDEBAR_MIN, SIDEBAR_MAX) }),
  setActivityFeedWidth: (width: number) => set({ activityFeedWidth: clamp(width, ACTIVITY_FEED_MIN, ACTIVITY_FEED_MAX) }),
  toggleActivityFeed: () => set((state) => ({ isActivityFeedVisible: !state.isActivityFeedVisible })),
  setHighlightedSessionId: (id: string | null) => set({ highlightedSessionId: id }),
  toggleTerminalPanel: () => set((state) => ({ isTerminalPanelOpen: !state.isTerminalPanelOpen })),
  setTerminalPanelHeight: (height: number) => set({ terminalPanelHeight: clamp(height, 150, 800) }),
  setWorkshopViewMode: (mode: WorkshopViewMode) => set({ workshopViewMode: mode }),
  toggleWorkshopViewMode: () => set((state) => ({
    workshopViewMode: state.workshopViewMode === "workshop" ? "cards" : "workshop",
  })),
  setSelectedWorkshopElfId: (id: string | null) => set({ selectedWorkshopElfId: id }),
  toggleSidebarCollapsed: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));

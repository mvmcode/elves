/* Global app state — runtime detection, Claude discovery, and task option selections. */

import { create } from "zustand";
import type { RuntimeInfo } from "@/types/runtime";
import type { Runtime } from "@/types/elf";
import type { ClaudeDiscovery, ClaudeAgent } from "@/types/claude";

interface AppState {
  /** Detected runtimes on the system (null = not yet checked) */
  readonly runtimes: RuntimeInfo | null;
  /** Whether the app is still initializing */
  readonly isLoading: boolean;
  /** User-selected default runtime for new tasks */
  readonly defaultRuntime: Runtime;

  /** Discovered Claude Code world: agents, settings, existence flags */
  readonly claudeDiscovery: ClaudeDiscovery | null;
  /** Currently selected custom agent for the next task (null = default) */
  readonly selectedAgent: ClaudeAgent | null;
  /** Currently selected model override for the next task (null = use agent/settings default). Runtime-generic string. */
  readonly selectedModel: string | null;
  /** Currently selected approval/permission mode override (null = use default). Runtime-generic string. */
  readonly selectedApprovalMode: string | null;
  /** Per-session spending cap in USD (null = no cap) */
  readonly budgetCap: number | null;
  /** Whether to force team mode regardless of task analyzer classification */
  readonly forceTeamMode: boolean;
  /** Whether the options row is expanded in the TaskBar */
  readonly isOptionsExpanded: boolean;

  /** Set runtime detection results after initial scan */
  setRuntimes: (runtimes: RuntimeInfo) => void;
  /** Mark app initialization as complete */
  setLoaded: () => void;
  /** Set the default runtime for new tasks */
  setDefaultRuntime: (runtime: Runtime) => void;
  /** Set Claude discovery results from startup scan */
  setClaudeDiscovery: (discovery: ClaudeDiscovery) => void;
  /** Select a custom agent for the next task */
  setSelectedAgent: (agent: ClaudeAgent | null) => void;
  /** Select a model override for the next task */
  setSelectedModel: (model: string | null) => void;
  /** Select an approval/permission mode override for the next task */
  setSelectedApprovalMode: (mode: string | null) => void;
  /** Set a per-session spending cap */
  setBudgetCap: (cap: number | null) => void;
  /** Toggle forced team mode for the next task */
  setForceTeamMode: (forced: boolean) => void;
  /** Toggle the options row visibility */
  setOptionsExpanded: (expanded: boolean) => void;
  /** Clear all task options after a task starts */
  resetTaskOptions: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  runtimes: null,
  isLoading: true,
  defaultRuntime: "claude-code",
  claudeDiscovery: null,
  selectedAgent: null,
  selectedModel: null,
  selectedApprovalMode: null,
  budgetCap: null,
  forceTeamMode: false,
  isOptionsExpanded: false,

  setRuntimes: (runtimes: RuntimeInfo) => set({ runtimes }),
  setLoaded: () => set({ isLoading: false }),
  setDefaultRuntime: (defaultRuntime: Runtime) =>
    set({
      defaultRuntime,
      /* Clear stale selections when switching runtimes — model/mode IDs differ between runtimes */
      selectedAgent: null,
      selectedModel: null,
      selectedApprovalMode: null,
      budgetCap: null,
      forceTeamMode: false,
    }),
  setClaudeDiscovery: (claudeDiscovery: ClaudeDiscovery) =>
    set({
      claudeDiscovery,
      // Auto-expand options row when agents are discovered (first-time delight)
      isOptionsExpanded: claudeDiscovery.hasAgents,
    }),
  setSelectedAgent: (selectedAgent: ClaudeAgent | null) => set({ selectedAgent }),
  setSelectedModel: (selectedModel: string | null) => set({ selectedModel }),
  setSelectedApprovalMode: (selectedApprovalMode: string | null) => set({ selectedApprovalMode }),
  setBudgetCap: (budgetCap: number | null) => set({ budgetCap }),
  setForceTeamMode: (forceTeamMode: boolean) => set({ forceTeamMode }),
  setOptionsExpanded: (isOptionsExpanded: boolean) => set({ isOptionsExpanded }),
  resetTaskOptions: () =>
    set({
      selectedAgent: null,
      selectedModel: null,
      selectedApprovalMode: null,
      budgetCap: null,
      forceTeamMode: false,
    }),
}));

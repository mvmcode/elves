/* Global app state — runtime detection, Claude discovery, task option selections, and file attachments. */

import { create } from "zustand";
import type { RuntimeInfo } from "@/types/runtime";
import type { Runtime } from "@/types/elf";
import type { ClaudeDiscovery, ClaudeAgent } from "@/types/claude";
import type { FileAttachment } from "@/types/attachment";
import { MAX_ATTACHED_FILES, MAX_TOTAL_ATTACHMENT_SIZE } from "@/types/attachment";

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
  /** Selected effort/thinking level override (null = use default). Claude Code only. */
  readonly selectedEffort: string | null;
  /** Whether to force team mode regardless of task analyzer classification */
  readonly forceTeamMode: boolean;
  /** Whether the options row is expanded in the TaskBar */
  readonly isOptionsExpanded: boolean;

  /** Files attached to the current task prompt, pending deployment */
  readonly attachedFiles: readonly FileAttachment[];

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
  /** Select an effort/thinking level override for the next task */
  setSelectedEffort: (effort: string | null) => void;
  /** Toggle forced team mode for the next task */
  setForceTeamMode: (forced: boolean) => void;
  /** Toggle the options row visibility */
  setOptionsExpanded: (expanded: boolean) => void;
  /** Clear all task options after a task starts */
  resetTaskOptions: () => void;

  /** Add a file attachment. Returns an error message string if validation fails, or null on success. */
  addAttachedFile: (file: FileAttachment) => string | null;
  /** Remove a file attachment by path. */
  removeAttachedFile: (path: string) => void;
  /** Clear all file attachments (called after deploy). */
  clearAttachedFiles: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  runtimes: null,
  isLoading: true,
  defaultRuntime: "claude-code",
  claudeDiscovery: null,
  selectedAgent: null,
  selectedModel: null,
  selectedApprovalMode: null,
  budgetCap: null,
  selectedEffort: null,
  forceTeamMode: true,
  isOptionsExpanded: false,
  attachedFiles: [],

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
      selectedEffort: null,
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
  setSelectedEffort: (selectedEffort: string | null) => set({ selectedEffort }),
  setForceTeamMode: (forceTeamMode: boolean) => set({ forceTeamMode }),
  setOptionsExpanded: (isOptionsExpanded: boolean) => set({ isOptionsExpanded }),
  resetTaskOptions: () =>
    set({
      selectedAgent: null,
      selectedModel: null,
      selectedApprovalMode: null,
      budgetCap: null,
      selectedEffort: null,
      forceTeamMode: false,
    }),

  addAttachedFile: (file: FileAttachment): string | null => {
    const { attachedFiles } = get();

    if (attachedFiles.length >= MAX_ATTACHED_FILES) {
      return `Maximum ${MAX_ATTACHED_FILES} files allowed`;
    }

    if (attachedFiles.some((existing) => existing.path === file.path)) {
      return "File already attached";
    }

    const currentTotalSize = attachedFiles.reduce((sum, f) => sum + f.size, 0);
    if (currentTotalSize + file.size > MAX_TOTAL_ATTACHMENT_SIZE) {
      return "Total attachment size exceeds 500KB limit";
    }

    set({ attachedFiles: [...attachedFiles, file] });
    return null;
  },

  removeAttachedFile: (path: string): void => {
    set((state) => ({
      attachedFiles: state.attachedFiles.filter((f) => f.path !== path),
    }));
  },

  clearAttachedFiles: (): void => {
    set({ attachedFiles: [] });
  },
}));

/* Session state — tracks the active task session, its elves, and the unified event stream. */

import { create } from "zustand";
import { useAppStore } from "@/stores/app";
import type { Elf, ElfEvent, ElfStatus, Runtime } from "@/types/elf";
import type { TaskPlan, TaskNodeStatus } from "@/types/session";

/** Spawn options that were applied when the session started */
export interface AppliedOptions {
  readonly agent?: string;
  readonly model?: string;
  readonly permissionMode?: string;
}

/** Parameters for starting a new session */
interface StartSessionParams {
  readonly id: string;
  readonly projectId: string;
  readonly task: string;
  readonly runtime: Runtime;
  readonly plan?: TaskPlan;
  readonly appliedOptions?: AppliedOptions;
}

/** The active session snapshot displayed in the UI */
export interface ActiveSession {
  readonly id: string;
  readonly projectId: string;
  readonly task: string;
  readonly runtime: Runtime;
  readonly status: string;
  readonly startedAt: number;
  readonly plan: TaskPlan | null;
  readonly appliedOptions?: AppliedOptions;
  readonly claudeSessionId?: string;
}

interface SessionState {
  /** The currently active session (null when idle) */
  readonly activeSession: ActiveSession | null;
  /** Unified event stream for the active session */
  readonly events: readonly ElfEvent[];
  /** Elf instances spawned in the active session */
  readonly elves: readonly Elf[];
  /** Lead agent's thinking/reasoning text fragments */
  readonly thinkingStream: readonly string[];
  /** Whether the session is in the plan preview phase (before deployment) */
  readonly isPlanPreview: boolean;
  /** The pending plan awaiting user approval (set during plan preview phase) */
  readonly pendingPlan: TaskPlan | null;

  /** Start a new task session */
  startSession: (session: StartSessionParams) => void;
  /** End the current session with a status ("completed", "cancelled", or "ended") */
  endSession: (status?: string) => void;
  /** Append an event to the stream */
  addEvent: (event: ElfEvent) => void;
  /** Register a newly spawned elf */
  addElf: (elf: Elf) => void;
  /** Update an elf's operational status */
  updateElfStatus: (elfId: string, status: ElfStatus) => void;
  /** Update all elves to a given status (used for completion/sleep transitions) */
  updateAllElfStatus: (status: ElfStatus) => void;
  /** Append a fragment to the lead agent's thinking stream */
  addThinkingFragment: (fragment: string) => void;
  /** Set the plan preview phase with a pending plan */
  showPlanPreview: (plan: TaskPlan) => void;
  /** Accept the plan and exit the preview phase */
  acceptPlan: () => void;
  /** Update a task node's status in the active plan's task graph */
  updateTaskNodeStatus: (nodeId: string, status: TaskNodeStatus) => void;
  /** Store the Claude Code session ID received from the backend */
  setClaudeSessionId: (claudeSessionId: string) => void;
  /** Clear all session state (reset to idle) */
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  events: [],
  elves: [],
  thinkingStream: [],
  isPlanPreview: false,
  pendingPlan: null,

  startSession: (session: StartSessionParams) =>
    set({
      activeSession: {
        id: session.id,
        projectId: session.projectId,
        task: session.task,
        runtime: session.runtime,
        status: "active",
        startedAt: Date.now(),
        plan: session.plan ?? null,
        appliedOptions: session.appliedOptions,
      },
      events: [],
      elves: [],
      thinkingStream: [],
      isPlanPreview: false,
      pendingPlan: null,
    }),

  endSession: (status?: string) =>
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, status: status ?? "ended" }
        : null,
    })),

  addEvent: (event: ElfEvent) =>
    set((state) => ({
      events: [...state.events, event],
    })),

  addElf: (elf: Elf) =>
    set((state) => ({
      elves: [...state.elves, elf],
    })),

  updateElfStatus: (elfId: string, status: ElfStatus) =>
    set((state) => ({
      elves: state.elves.map((elf) =>
        elf.id === elfId ? { ...elf, status } : elf
      ),
    })),

  updateAllElfStatus: (status: ElfStatus) =>
    set((state) => ({
      elves: state.elves.map((elf) => ({ ...elf, status })),
    })),

  addThinkingFragment: (fragment: string) =>
    set((state) => ({
      thinkingStream: [...state.thinkingStream, fragment],
    })),

  showPlanPreview: (plan: TaskPlan) =>
    set({
      isPlanPreview: true,
      pendingPlan: plan,
    }),

  acceptPlan: () =>
    set({
      isPlanPreview: false,
    }),

  updateTaskNodeStatus: (nodeId: string, status: TaskNodeStatus) =>
    set((state) => {
      if (!state.activeSession?.plan) return state;
      return {
        activeSession: {
          ...state.activeSession,
          plan: {
            ...state.activeSession.plan,
            taskGraph: state.activeSession.plan.taskGraph.map((node) =>
              node.id === nodeId ? { ...node, status } : node
            ),
          },
        },
      };
    }),

  setClaudeSessionId: (claudeSessionId: string) =>
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, claudeSessionId }
        : null,
    })),

  clearSession: () => {
    useAppStore.getState().resetTaskOptions();
    set({
      activeSession: null,
      events: [],
      elves: [],
      thinkingStream: [],
      isPlanPreview: false,
      pendingPlan: null,
    });
  },
}));

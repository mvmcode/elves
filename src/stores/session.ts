/* Session state — multi-floor workspace with backward-compatible snapshot fields.
 * Each floor is an independent workspace tab with its own session, events, and elves.
 * Top-level "snapshot" fields mirror the active floor so existing components work unchanged. */

import { create } from "zustand";
import { useAppStore } from "@/stores/app";
import type { Elf, ElfEvent, ElfStatus, Runtime } from "@/types/elf";
import type { TaskPlan, TaskNodeStatus } from "@/types/session";
import type { FloorId, FloorSession } from "@/types/floor";
import { createEmptyFloor } from "@/types/floor";

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

/** Generate a unique floor ID */
function generateFloorId(): FloorId {
  return `floor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface SessionState {
  /* ── Floor state ────────────────────────────────────────────── */
  /** Map of all floor tabs keyed by FloorId */
  readonly floors: Record<FloorId, FloorSession>;
  /** Currently active floor tab */
  readonly activeFloorId: FloorId | null;
  /** Counter for ordering new floors */
  readonly nextOrder: number;

  /* ── Snapshot fields (mirror the active floor for backward compatibility) ── */
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
  /** Whether the session transitioned to interactive PTY terminal mode */
  readonly isInteractiveMode: boolean;
  /** Timestamp of the last event received — used for stall detection */
  readonly lastEventAt: number;

  /* ── Floor actions ──────────────────────────────────────────── */
  /** Create a new empty floor and switch to it. Returns the floor ID. */
  createFloor: (label?: string) => FloorId;
  /** Close a floor by ID. If closing active, switch to adjacent. */
  closeFloor: (floorId: FloorId) => void;
  /** Switch the active floor. Updates snapshot fields. */
  switchFloor: (floorId: FloorId) => void;
  /** Add an event to a specific floor (for non-focused running sessions). */
  addEventToFloor: (floorId: FloorId, event: ElfEvent) => void;
  /** Update an elf's status on a specific floor. */
  updateElfStatusOnFloor: (floorId: FloorId, elfId: string, status: ElfStatus) => void;
  /** Update all elves to a given status on a specific floor. */
  updateAllElfStatusOnFloor: (floorId: FloorId, status: ElfStatus) => void;
  /** End the session on a specific floor. */
  endSessionOnFloor: (floorId: FloorId, status?: string) => void;
  /** Open a historical session as a read-only floor. Returns the floor ID. */
  openHistoricalFloor: (session: ActiveSession, events: readonly ElfEvent[]) => FloorId;
  /** Reverse lookup: find floor ID by session ID. */
  getFloorBySessionId: (sessionId: string) => FloorId | null;
  /** Reset a floor to idle state (keep the tab). */
  clearFloorSession: (floorId: FloorId) => void;
  /** Get ordered list of floors for tab rendering. */
  getOrderedFloors: () => readonly FloorSession[];

  /* ── Session actions (operate on active floor, sync snapshot) ── */
  /** Start a new task session on the active floor */
  startSession: (session: StartSessionParams) => void;
  /** End the current session with a status */
  endSession: (status?: string) => void;
  /** Append an event to the active floor's stream */
  addEvent: (event: ElfEvent) => void;
  /** Register a newly spawned elf on the active floor */
  addElf: (elf: Elf) => void;
  /** Update an elf's operational status on the active floor */
  updateElfStatus: (elfId: string, status: ElfStatus) => void;
  /** Update all elves to a given status on the active floor */
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
  /** Set the Claude Code session ID on a specific floor */
  setClaudeSessionIdOnFloor: (floorId: FloorId, claudeSessionId: string) => void;
  /** Mark the session as having transitioned to interactive terminal mode */
  setInteractiveMode: (interactive: boolean) => void;
  /** Set interactive mode on a specific floor */
  setInteractiveModeOnFloor: (floorId: FloorId, interactive: boolean) => void;
  /** Reactivate a completed session for a follow-up turn */
  reactivateSession: () => void;
  /** Reactivate a session on a specific floor */
  reactivateSessionOnFloor: (floorId: FloorId) => void;
  /** Clear all session state (reset active floor to idle) */
  clearSession: () => void;
  /** Add a thinking fragment to a specific floor */
  addThinkingFragmentToFloor: (floorId: FloorId, fragment: string) => void;
  /** Show plan preview on a specific floor */
  showPlanPreviewOnFloor: (floorId: FloorId, plan: TaskPlan) => void;
  /** Accept plan on a specific floor */
  acceptPlanOnFloor: (floorId: FloorId) => void;
  /** Start session on a specific floor */
  startSessionOnFloor: (floorId: FloorId, session: StartSessionParams) => void;
  /** Add an elf to a specific floor */
  addElfToFloor: (floorId: FloorId, elf: Elf) => void;
}

/** Extract snapshot fields from a floor for syncing to top-level state. */
function snapshotFromFloor(floor: FloorSession): {
  activeSession: ActiveSession | null;
  events: readonly ElfEvent[];
  elves: readonly Elf[];
  thinkingStream: readonly string[];
  isPlanPreview: boolean;
  pendingPlan: TaskPlan | null;
  isInteractiveMode: boolean;
  lastEventAt: number;
} {
  return {
    activeSession: floor.session,
    events: floor.events,
    elves: floor.elves,
    thinkingStream: floor.thinkingStream,
    isPlanPreview: floor.isPlanPreview,
    pendingPlan: floor.pendingPlan,
    isInteractiveMode: floor.isInteractiveMode,
    lastEventAt: floor.lastEventAt,
  };
}

/** Empty snapshot for when no floor is active. */
const EMPTY_SNAPSHOT = {
  activeSession: null,
  events: [] as readonly ElfEvent[],
  elves: [] as readonly Elf[],
  thinkingStream: [] as readonly string[],
  isPlanPreview: false,
  pendingPlan: null,
  isInteractiveMode: false,
  lastEventAt: 0,
} as const;

/** Create the initial default floor. */
function createInitialState(): {
  floors: Record<FloorId, FloorSession>;
  activeFloorId: FloorId;
  nextOrder: number;
} & typeof EMPTY_SNAPSHOT {
  const floorId = generateFloorId();
  const floor = createEmptyFloor(floorId, 0);
  return {
    floors: { [floorId]: floor },
    activeFloorId: floorId,
    nextOrder: 1,
    ...EMPTY_SNAPSHOT,
  };
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ...createInitialState(),

  /* ── Floor actions ──────────────────────────────────────────── */

  createFloor: (label?: string): FloorId => {
    const floorId = generateFloorId();
    const { nextOrder } = get();
    const floor = createEmptyFloor(floorId, nextOrder, label);
    set((state) => ({
      floors: { ...state.floors, [floorId]: floor },
      activeFloorId: floorId,
      nextOrder: state.nextOrder + 1,
      ...snapshotFromFloor(floor),
    }));
    return floorId;
  },

  closeFloor: (floorId: FloorId): void => {
    set((state) => {
      const { [floorId]: removed, ...remaining } = state.floors;
      if (!removed) return state;

      const orderedFloors = Object.values(remaining).sort((a, b) => a.order - b.order);

      /* If no floors left, create a default one */
      if (orderedFloors.length === 0) {
        const newId = generateFloorId();
        const newFloor = createEmptyFloor(newId, 0);
        return {
          floors: { [newId]: newFloor },
          activeFloorId: newId,
          nextOrder: 1,
          ...snapshotFromFloor(newFloor),
        };
      }

      /* If closing the active floor, switch to adjacent */
      if (state.activeFloorId === floorId) {
        const removedOrder = removed.order;
        const next =
          orderedFloors.find((f) => f.order > removedOrder) ??
          orderedFloors[orderedFloors.length - 1]!;
        return {
          floors: remaining,
          activeFloorId: next.id,
          ...snapshotFromFloor(next),
        };
      }

      return { floors: remaining };
    });
  },

  switchFloor: (floorId: FloorId): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor) return state;
      return {
        activeFloorId: floorId,
        ...snapshotFromFloor(floor),
      };
    });
  },

  addEventToFloor: (floorId: FloorId, event: ElfEvent): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        events: [...floor.events, event],
        lastEventAt: Date.now(),
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  updateElfStatusOnFloor: (floorId: FloorId, elfId: string, status: ElfStatus): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        elves: floor.elves.map((elf) =>
          elf.id === elfId ? { ...elf, status } : elf
        ),
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  updateAllElfStatusOnFloor: (floorId: FloorId, status: ElfStatus): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        elves: floor.elves.map((elf) => ({ ...elf, status })),
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  endSessionOnFloor: (floorId: FloorId, status?: string): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor || !floor.session) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        session: { ...floor.session, status: status ?? "ended" },
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  openHistoricalFloor: (session: ActiveSession, events: readonly ElfEvent[]): FloorId => {
    const floorId = generateFloorId();
    const { nextOrder } = get();
    const label = session.task.slice(0, 20) || "History";

    const floor: FloorSession = {
      id: floorId,
      label,
      session,
      events,
      elves: [],
      thinkingStream: [],
      isPlanPreview: false,
      pendingPlan: null,
      isInteractiveMode: false,
      lastEventAt: session.startedAt,
      order: nextOrder,
      isHistorical: true,
    };

    set((state) => ({
      floors: { ...state.floors, [floorId]: floor },
      activeFloorId: floorId,
      nextOrder: state.nextOrder + 1,
      ...snapshotFromFloor(floor),
    }));

    return floorId;
  },

  getFloorBySessionId: (sessionId: string): FloorId | null => {
    const { floors } = get();
    for (const floor of Object.values(floors)) {
      if (floor.session?.id === sessionId) return floor.id;
    }
    return null;
  },

  clearFloorSession: (floorId: FloorId): void => {
    useAppStore.getState().resetTaskOptions();
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        session: null,
        events: [],
        elves: [],
        thinkingStream: [],
        isPlanPreview: false,
        pendingPlan: null,
        isInteractiveMode: false,
        lastEventAt: 0,
        label: "New Floor",
        isHistorical: false,
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  getOrderedFloors: (): readonly FloorSession[] => {
    const { floors } = get();
    return Object.values(floors).sort((a, b) => a.order - b.order);
  },

  /* ── Session actions (operate on active floor) ──────────────── */

  startSession: (session: StartSessionParams): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor) return state;

      const activeSession: ActiveSession = {
        id: session.id,
        projectId: session.projectId,
        task: session.task,
        runtime: session.runtime,
        status: "active",
        startedAt: Date.now(),
        plan: session.plan ?? null,
        appliedOptions: session.appliedOptions,
      };

      const updatedFloor: FloorSession = {
        ...floor,
        label: session.task.slice(0, 20) || "Task",
        session: activeSession,
        events: [],
        elves: [],
        thinkingStream: [],
        isPlanPreview: false,
        pendingPlan: null,
        isInteractiveMode: false,
        lastEventAt: Date.now(),
        isHistorical: false,
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  startSessionOnFloor: (floorId: FloorId, session: StartSessionParams): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor) return state;

      const activeSession: ActiveSession = {
        id: session.id,
        projectId: session.projectId,
        task: session.task,
        runtime: session.runtime,
        status: "active",
        startedAt: Date.now(),
        plan: session.plan ?? null,
        appliedOptions: session.appliedOptions,
      };

      const updatedFloor: FloorSession = {
        ...floor,
        label: session.task.slice(0, 20) || "Task",
        session: activeSession,
        events: [],
        elves: [],
        thinkingStream: [],
        isPlanPreview: false,
        pendingPlan: null,
        isInteractiveMode: false,
        lastEventAt: Date.now(),
        isHistorical: false,
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  endSession: (status?: string): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor?.session) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        session: { ...floor.session, status: status ?? "ended" },
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  addEvent: (event: ElfEvent): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        events: [...floor.events, event],
        lastEventAt: Date.now(),
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  addElf: (elf: Elf): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        elves: [...floor.elves, elf],
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  addElfToFloor: (floorId: FloorId, elf: Elf): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        elves: [...floor.elves, elf],
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  updateElfStatus: (elfId: string, status: ElfStatus): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        elves: floor.elves.map((elf) =>
          elf.id === elfId ? { ...elf, status } : elf
        ),
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  updateAllElfStatus: (status: ElfStatus): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        elves: floor.elves.map((elf) => ({ ...elf, status })),
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  addThinkingFragment: (fragment: string): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        thinkingStream: [...floor.thinkingStream, fragment],
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  addThinkingFragmentToFloor: (floorId: FloorId, fragment: string): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        thinkingStream: [...floor.thinkingStream, fragment],
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  showPlanPreview: (plan: TaskPlan): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        isPlanPreview: true,
        pendingPlan: plan,
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  showPlanPreviewOnFloor: (floorId: FloorId, plan: TaskPlan): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        isPlanPreview: true,
        pendingPlan: plan,
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  acceptPlan: (): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        isPlanPreview: false,
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  acceptPlanOnFloor: (floorId: FloorId): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        isPlanPreview: false,
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  updateTaskNodeStatus: (nodeId: string, status: TaskNodeStatus): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor?.session?.plan) return state;

      const updatedSession: ActiveSession = {
        ...floor.session,
        plan: {
          ...floor.session.plan,
          taskGraph: floor.session.plan.taskGraph.map((node) =>
            node.id === nodeId ? { ...node, status } : node
          ),
        },
      };

      const updatedFloor: FloorSession = {
        ...floor,
        session: updatedSession,
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  setClaudeSessionId: (claudeSessionId: string): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor?.session) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        session: { ...floor.session, claudeSessionId },
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  setClaudeSessionIdOnFloor: (floorId: FloorId, claudeSessionId: string): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor?.session) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        session: { ...floor.session, claudeSessionId },
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  setInteractiveMode: (interactive: boolean): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        isInteractiveMode: interactive,
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  setInteractiveModeOnFloor: (floorId: FloorId, interactive: boolean): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        isInteractiveMode: interactive,
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  reactivateSession: (): void => {
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor?.session) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        session: { ...floor.session, status: "active" },
        isInteractiveMode: false,
        lastEventAt: Date.now(),
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },

  reactivateSessionOnFloor: (floorId: FloorId): void => {
    set((state) => {
      const floor = state.floors[floorId];
      if (!floor?.session) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        session: { ...floor.session, status: "active" },
        isInteractiveMode: false,
        lastEventAt: Date.now(),
      };

      const newFloors = { ...state.floors, [floorId]: updatedFloor };
      const isActive = state.activeFloorId === floorId;
      return {
        floors: newFloors,
        ...(isActive ? snapshotFromFloor(updatedFloor) : {}),
      };
    });
  },

  clearSession: (): void => {
    useAppStore.getState().resetTaskOptions();
    set((state) => {
      const floorId = state.activeFloorId;
      if (!floorId) return state;
      const floor = state.floors[floorId];
      if (!floor) return state;

      const updatedFloor: FloorSession = {
        ...floor,
        session: null,
        events: [],
        elves: [],
        thinkingStream: [],
        isPlanPreview: false,
        pendingPlan: null,
        isInteractiveMode: false,
        lastEventAt: 0,
        label: "New Floor",
        isHistorical: false,
      };

      return {
        floors: { ...state.floors, [floorId]: updatedFloor },
        ...snapshotFromFloor(updatedFloor),
      };
    });
  },
}));

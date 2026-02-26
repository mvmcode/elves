/* Session state — tracks the active task session, its minions, and the unified event stream. */

import { create } from "zustand";
import type { Minion, MinionEvent, MinionStatus, Runtime } from "@/types/minion";

/** Parameters for starting a new session */
interface StartSessionParams {
  readonly id: string;
  readonly projectId: string;
  readonly task: string;
  readonly runtime: Runtime;
}

/** The active session snapshot displayed in the UI */
interface ActiveSession {
  readonly id: string;
  readonly projectId: string;
  readonly task: string;
  readonly runtime: Runtime;
  readonly status: string;
  readonly startedAt: number;
}

interface SessionState {
  /** The currently active session (null when idle) */
  readonly activeSession: ActiveSession | null;
  /** Unified event stream for the active session */
  readonly events: readonly MinionEvent[];
  /** Minion instances spawned in the active session */
  readonly minions: readonly Minion[];

  /** Start a new task session */
  startSession: (session: StartSessionParams) => void;
  /** End the current session with an optional summary */
  endSession: (summary?: string) => void;
  /** Append an event to the stream */
  addEvent: (event: MinionEvent) => void;
  /** Register a newly spawned minion */
  addMinion: (minion: Minion) => void;
  /** Update a minion's operational status */
  updateMinionStatus: (minionId: string, status: MinionStatus) => void;
  /** Clear all session state (reset to idle) */
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  events: [],
  minions: [],

  startSession: (session: StartSessionParams) =>
    set({
      activeSession: {
        id: session.id,
        projectId: session.projectId,
        task: session.task,
        runtime: session.runtime,
        status: "active",
        startedAt: Date.now(),
      },
      events: [],
      minions: [],
    }),

  endSession: (summary?: string) =>
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, status: summary ? "completed" : "ended" }
        : null,
    })),

  addEvent: (event: MinionEvent) =>
    set((state) => ({
      events: [...state.events, event],
    })),

  addMinion: (minion: Minion) =>
    set((state) => ({
      minions: [...state.minions, minion],
    })),

  updateMinionStatus: (minionId: string, status: MinionStatus) =>
    set((state) => ({
      minions: state.minions.map((minion) =>
        minion.id === minionId ? { ...minion, status } : minion
      ),
    })),

  clearSession: () =>
    set({
      activeSession: null,
      events: [],
      minions: [],
    }),
}));

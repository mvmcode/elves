/* Session state — tracks the active task session, its elves, and the unified event stream. */

import { create } from "zustand";
import type { Elf, ElfEvent, ElfStatus, Runtime } from "@/types/elf";

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
  readonly events: readonly ElfEvent[];
  /** Elf instances spawned in the active session */
  readonly elves: readonly Elf[];

  /** Start a new task session */
  startSession: (session: StartSessionParams) => void;
  /** End the current session with an optional summary */
  endSession: (summary?: string) => void;
  /** Append an event to the stream */
  addEvent: (event: ElfEvent) => void;
  /** Register a newly spawned elf */
  addElf: (elf: Elf) => void;
  /** Update an elf's operational status */
  updateElfStatus: (elfId: string, status: ElfStatus) => void;
  /** Clear all session state (reset to idle) */
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  activeSession: null,
  events: [],
  elves: [],

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
      elves: [],
    }),

  endSession: (summary?: string) =>
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, status: summary ? "completed" : "ended" }
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

  clearSession: () =>
    set({
      activeSession: null,
      events: [],
      elves: [],
    }),
}));

/* Floor types — represents a single workspace tab with its own session lifecycle. */

import type { ActiveSession } from "@/stores/session";
import type { ElfEvent, Elf } from "./elf";
import type { TaskPlan } from "./session";

/** Unique identifier for a floor tab. */
export type FloorId = string;

/** A single floor (workspace tab) with its own session, events, and elves. */
export interface FloorSession {
  readonly id: FloorId;
  readonly label: string;
  readonly session: ActiveSession | null;
  readonly events: readonly ElfEvent[];
  readonly elves: readonly Elf[];
  readonly thinkingStream: readonly string[];
  readonly isPlanPreview: boolean;
  readonly pendingPlan: TaskPlan | null;
  readonly isInteractiveMode: boolean;
  readonly lastEventAt: number;
  readonly order: number;
  readonly isHistorical: boolean;
}

/** Creates a new empty floor with default values. */
export function createEmptyFloor(id: FloorId, order: number, label?: string): FloorSession {
  return {
    id,
    label: label ?? "New Floor",
    session: null,
    events: [],
    elves: [],
    thinkingStream: [],
    isPlanPreview: false,
    pendingPlan: null,
    isInteractiveMode: false,
    lastEventAt: 0,
    order,
    isHistorical: false,
  };
}

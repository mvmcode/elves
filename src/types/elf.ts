/* Core elf types — defines the unified agent protocol event stream and elf state. */

/** Supported agent runtimes */
export type Runtime = "claude-code" | "codex";

/** All possible elf operational states */
export type ElfStatus =
  | "spawning"
  | "working"
  | "thinking"
  | "waiting"
  | "chatting"
  | "done"
  | "error"
  | "sleeping";

/** Event types emitted by the unified agent protocol */
export type ElfEventType =
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "output"
  | "spawn"
  | "chat"
  | "task_update"
  | "error"
  | "permission_request"
  | "file_change";

/** A single event from the unified agent protocol stream */
export interface ElfEvent {
  readonly id: string;
  readonly timestamp: number;
  readonly elfId: string;
  readonly elfName: string;
  readonly runtime: Runtime;
  readonly type: ElfEventType;
  readonly payload: Record<string, unknown>;
  readonly funnyStatus?: string;
}

/** Personality profile assigned to each elf on spawn */
export interface ElfPersonality {
  readonly name: string;
  readonly avatar: string;
  readonly color: string;
  readonly quirk: string;
}

/** Status messages keyed by ElfStatus — the funny text shown on cards */
export type StatusMessageMap = Record<ElfStatus, readonly string[]>;

/** An elf agent instance */
export interface Elf {
  readonly id: string;
  readonly sessionId: string;
  readonly name: string;
  readonly role: string | null;
  readonly avatar: string;
  readonly color: string;
  readonly quirk: string | null;
  readonly runtime: Runtime;
  readonly status: ElfStatus;
  readonly spawnedAt: number;
  readonly finishedAt: number | null;
  readonly parentElfId: string | null;
  readonly toolsUsed: readonly string[];
}

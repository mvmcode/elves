/* Core minion types — defines the unified agent protocol event stream and minion state. */

/** Supported agent runtimes */
export type Runtime = "claude-code" | "codex";

/** All possible minion operational states */
export type MinionStatus =
  | "spawning"
  | "working"
  | "thinking"
  | "waiting"
  | "chatting"
  | "done"
  | "error"
  | "sleeping";

/** Event types emitted by the unified agent protocol */
export type MinionEventType =
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
export interface MinionEvent {
  readonly id: string;
  readonly timestamp: number;
  readonly minionId: string;
  readonly minionName: string;
  readonly runtime: Runtime;
  readonly type: MinionEventType;
  readonly payload: Record<string, unknown>;
  readonly funnyStatus?: string;
}

/** Personality profile assigned to each minion on spawn */
export interface MinionPersonality {
  readonly name: string;
  readonly avatar: string;
  readonly color: string;
  readonly quirk: string;
}

/** Status messages keyed by MinionStatus — the funny text shown on cards */
export type StatusMessageMap = Record<MinionStatus, readonly string[]>;

/** A minion agent instance */
export interface Minion {
  readonly id: string;
  readonly sessionId: string;
  readonly name: string;
  readonly role: string | null;
  readonly avatar: string;
  readonly color: string;
  readonly quirk: string | null;
  readonly runtime: Runtime;
  readonly status: MinionStatus;
  readonly spawnedAt: number;
  readonly finishedAt: number | null;
  readonly parentMinionId: string | null;
  readonly toolsUsed: readonly string[];
}

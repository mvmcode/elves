/* Types for the session comparison feature — side-by-side session analysis. */

import type { Session } from "@/types/session";
import type { SessionEvent } from "@/lib/tauri";

/** A session paired with its fetched events, used as one side of the comparison. */
export interface ComparisonSession {
  readonly session: Session;
  readonly events: SessionEvent[];
}

/** Computed metrics derived from a session and its events. */
export interface ComparisonMetrics {
  /** Total number of events in the session. */
  readonly eventCount: number;
  /** Total tokens used (from session record). */
  readonly tokenCount: number;
  /** Estimated cost in USD (from session record). */
  readonly cost: number;
  /** Session duration in milliseconds (endedAt - startedAt, or elapsed if active). */
  readonly duration: number;
  /** Number of tool_use / tool_call events. */
  readonly toolCallCount: number;
  /** Number of error events. */
  readonly errorCount: number;
}

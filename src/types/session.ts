/* Session types — represents a single task execution with its plan and results. */

import type { Runtime } from "./minion";

/** Status of a task session */
export type SessionStatus = "active" | "completed" | "failed" | "cancelled";

/** A single task execution session */
export interface Session {
  readonly id: string;
  readonly projectId: string;
  readonly task: string;
  readonly runtime: Runtime;
  readonly status: SessionStatus;
  readonly plan: SessionPlan | null;
  readonly agentCount: number;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly tokensUsed: number;
  readonly costEstimate: number;
  readonly summary: string | null;
}

/** A decomposed task plan with agent roles */
export interface SessionPlan {
  readonly roles: readonly PlanRole[];
  readonly taskGraph: readonly PlanTask[];
}

/** A role in the task plan assigned to a minion */
export interface PlanRole {
  readonly name: string;
  readonly focus: string;
  readonly runtime: Runtime;
}

/** A task node in the dependency graph */
export interface PlanTask {
  readonly id: string;
  readonly label: string;
  readonly assignee: string;
  readonly dependsOn: readonly string[];
  readonly status: "pending" | "active" | "done" | "error";
}

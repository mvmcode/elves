/* Session types — represents a single task execution with its plan and results. */

import type { Runtime } from "./elf";

/** Status of a task session */
export type SessionStatus = "active" | "completed" | "failed" | "cancelled";

/** Task complexity classification from the analyzer */
export type TaskComplexity = "solo" | "team";

/** Status of a single task node in the dependency graph */
export type TaskNodeStatus = "pending" | "active" | "done" | "error";

/** A recommended role for an agent in a team deployment */
export interface RoleDef {
  readonly name: string;
  readonly focus: string;
  readonly runtime: Runtime | string;
}

/** A node in the task dependency graph */
export interface TaskNode {
  readonly id: string;
  readonly label: string;
  readonly assignee: string;
  readonly dependsOn: readonly string[];
  readonly status: TaskNodeStatus;
}

/**
 * Output of the task analyzer: a full deployment plan.
 * Contains complexity classification, recommended agent count and roles,
 * a task dependency graph, runtime recommendation, and time estimate.
 * Must match the Rust TaskPlan struct in agents/analyzer.rs exactly.
 */
export interface TaskPlan {
  readonly complexity: TaskComplexity;
  readonly agentCount: number;
  readonly roles: readonly RoleDef[];
  readonly taskGraph: readonly TaskNode[];
  readonly runtimeRecommendation: string;
  readonly estimatedDuration: string;
}

/** A single task execution session */
export interface Session {
  readonly id: string;
  readonly projectId: string;
  readonly task: string;
  readonly runtime: Runtime;
  readonly status: SessionStatus;
  readonly plan: TaskPlan | null;
  readonly agentCount: number;
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly tokensUsed: number;
  readonly costEstimate: number;
  readonly summary: string | null;
}

/**
 * Legacy plan types — kept for backward compatibility with Phase 2 code.
 * New code should use TaskPlan, RoleDef, and TaskNode instead.
 */

/** A decomposed task plan with agent roles */
export interface SessionPlan {
  readonly roles: readonly PlanRole[];
  readonly taskGraph: readonly PlanTask[];
}

/** A role in the task plan assigned to an elf */
export interface PlanRole {
  readonly name: string;
  readonly focus: string;
  readonly runtime: Runtime;
}

/** A task node in the dependency graph (legacy — use TaskNode for new code) */
export interface PlanTask {
  readonly id: string;
  readonly label: string;
  readonly assignee: string;
  readonly dependsOn: readonly string[];
  readonly status: TaskNodeStatus;
}

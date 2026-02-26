/* Tauri IPC wrappers — typed invoke helpers for calling Rust backend commands. */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { RuntimeInfo } from "@/types/runtime";
import type { Project } from "@/types/project";
import type { Session, TaskPlan } from "@/types/session";

/** Detect available AI runtimes (Claude Code, Codex) on the system */
export async function detectRuntimes(): Promise<RuntimeInfo> {
  return invoke<RuntimeInfo>("detect_runtimes");
}

/** Get all projects from the local database */
export async function listProjects(): Promise<Project[]> {
  return invoke<Project[]>("list_projects");
}

/** Create a new project */
export async function createProject(
  name: string,
  path: string,
): Promise<Project> {
  return invoke<Project>("create_project", { name, path });
}

/** List all sessions for a project */
export async function listSessions(projectId: string): Promise<Session[]> {
  return invoke<Session[]>("list_sessions", { projectId });
}

/** Start a task — creates session, spawns elf, starts agent process. Returns session ID. */
export async function startTask(
  projectId: string,
  task: string,
  runtime: string,
): Promise<string> {
  return invoke<string>("start_task", { projectId, task, runtime });
}

/** Stop a running task. Returns true if a process was killed. */
export async function stopTask(sessionId: string): Promise<boolean> {
  return invoke<boolean>("stop_task", { sessionId });
}

/** Analyze a task to determine complexity and generate a deployment plan. */
export async function analyzeTask(
  task: string,
  projectId: string,
): Promise<TaskPlan> {
  return invoke<TaskPlan>("analyze_task", { task, projectId });
}

/** Start a team task — creates session, spawns multiple elves per plan. Returns session ID. */
export async function startTeamTask(
  projectId: string,
  task: string,
  plan: TaskPlan,
): Promise<string> {
  return invoke<string>("start_team_task", { projectId, task, plan: JSON.stringify(plan) });
}

/** Stop a team task. Kills all agent processes for the session. */
export async function stopTeamTask(sessionId: string): Promise<boolean> {
  return invoke<boolean>("stop_team_task", { sessionId });
}

/** Subscribe to a Tauri event. Returns an unsubscribe function. */
export async function onEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  return listen<T>(eventName, (event) => handler(event.payload));
}

/* Tauri IPC wrappers — typed invoke helpers for calling Rust backend commands. */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { RuntimeInfo } from "@/types/runtime";
import type { Project } from "@/types/project";
import type { Session, TaskPlan } from "@/types/session";
import type { MemoryEntry, ExtractionResult } from "@/types/memory";

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

/* ── Memory commands ───────────────────────────────────────────── */

/** List memories for a project with optional filtering. */
export async function listMemories(
  projectId: string,
  category?: string,
  sortBy?: string,
): Promise<MemoryEntry[]> {
  return invoke<MemoryEntry[]>("list_memories", { projectId, category, sortBy });
}

/** Create a new memory entry. */
export async function createMemory(
  projectId: string,
  category: string,
  content: string,
  source?: string,
  tags?: string,
): Promise<MemoryEntry> {
  return invoke<MemoryEntry>("create_memory", { projectId, category, content, source, tags });
}

/** Update a memory entry's content. */
export async function updateMemory(id: number, content: string): Promise<boolean> {
  return invoke<boolean>("update_memory", { id, content });
}

/** Delete a memory entry. */
export async function deleteMemory(id: number): Promise<boolean> {
  return invoke<boolean>("delete_memory", { id });
}

/** Pin a memory (sets relevance to 1.0, never decays). */
export async function pinMemory(id: number): Promise<boolean> {
  return invoke<boolean>("pin_memory", { id });
}

/** Unpin a memory. */
export async function unpinMemory(id: number): Promise<boolean> {
  return invoke<boolean>("unpin_memory", { id });
}

/** Full-text search memories. */
export async function searchMemories(projectId: string, query: string): Promise<MemoryEntry[]> {
  return invoke<MemoryEntry[]>("search_memories", { projectId, query });
}

/** Run relevance decay on all non-pinned memories. Returns count decayed. */
export async function decayMemories(): Promise<number> {
  return invoke<number>("decay_memories");
}

/** Build a markdown context block from relevant memories for a project. */
export async function buildProjectContext(projectId: string): Promise<string> {
  return invoke<string>("build_project_context", { projectId });
}

/** Extract memories from a completed session. Returns extraction result with memories and summary. */
export async function extractSessionMemories(sessionId: string): Promise<ExtractionResult> {
  return invoke<ExtractionResult>("extract_session_memories", { sessionId });
}

/** Get memory count for a project. */
export async function getMemoryCount(projectId: string): Promise<number> {
  return invoke<number>("get_memory_count", { projectId });
}

/** Subscribe to a Tauri event. Returns an unsubscribe function. */
export async function onEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  return listen<T>(eventName, (event) => handler(event.payload));
}

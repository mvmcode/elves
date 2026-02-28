/* Tauri IPC wrappers — typed invoke helpers for calling Rust backend commands. */

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { RuntimeInfo } from "@/types/runtime";
import type { Project } from "@/types/project";
import type { Session, TaskPlan } from "@/types/session";
import type { MemoryEntry, ExtractionResult } from "@/types/memory";
import type { Skill } from "@/types/skill";
import type { McpServer } from "@/types/mcp";
import type { Template } from "@/types/template";
import type { ClaudeDiscovery, ClaudeSpawnOptions } from "@/types/claude";

/** Detect available AI runtimes (Claude Code, Codex) on the system */
export async function detectRuntimes(): Promise<RuntimeInfo> {
  return invoke<RuntimeInfo>("detect_runtimes");
}

/** Discover the user's Claude Code world: custom agents and settings from ~/.claude/ */
export async function discoverClaude(): Promise<ClaudeDiscovery> {
  return invoke<ClaudeDiscovery>("discover_claude");
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

/** Event row from the database, used for session history detail view. */
export interface SessionEvent {
  readonly id: number;
  readonly sessionId: string;
  readonly elfId: string | null;
  readonly eventType: string;
  readonly payload: string;
  readonly funnyStatus: string | null;
  readonly timestamp: number;
}

/** List all events for a session, ordered chronologically. */
export async function listSessionEvents(sessionId: string): Promise<SessionEvent[]> {
  return invoke<SessionEvent[]>("list_session_events", { sessionId });
}

/** Start a task — creates session, spawns elf, starts agent process. Returns session ID. */
export async function startTask(
  projectId: string,
  task: string,
  runtime: string,
  spawnOptions?: ClaudeSpawnOptions,
): Promise<string> {
  const options = spawnOptions ? JSON.stringify(spawnOptions) : undefined;
  return invoke<string>("start_task", { projectId, task, runtime, options });
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
  spawnOptions?: ClaudeSpawnOptions,
): Promise<string> {
  const options = spawnOptions ? JSON.stringify(spawnOptions) : undefined;
  return invoke<string>("start_team_task", { projectId, task, plan, options });
}

/** Stop a team task. Kills all agent processes for the session. */
export async function stopTeamTask(sessionId: string): Promise<boolean> {
  return invoke<boolean>("stop_team_task", { sessionId });
}

/** Continue a completed session with a follow-up message.
 * Resumes the Claude session via `--print --resume` with the new message.
 * The session transitions back to "active" and events stream into the same feed. */
export async function continueTask(
  sessionId: string,
  message: string,
  spawnOptions?: ClaudeSpawnOptions,
): Promise<boolean> {
  const options = spawnOptions ? JSON.stringify(spawnOptions) : undefined;
  return invoke<boolean>("continue_task", { sessionId, message, options });
}

/** Transition a session from non-interactive print mode to interactive terminal.
 * Kills the --print process and marks the session so the backend suppresses
 * the false session:completed event. The frontend then spawns a PTY terminal
 * via `claude --resume` for direct user interaction. */
export async function transitionToInteractive(sessionId: string): Promise<boolean> {
  return invoke<boolean>("transition_to_interactive", { sessionId });
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

/** Write a string to a file at the given path. */
export async function writeTextToFile(filePath: string, content: string): Promise<void> {
  return invoke<void>("write_text_to_file", { filePath, content });
}

/** Read a file as a string from the given path. */
export async function readTextFromFile(filePath: string): Promise<string> {
  return invoke<string>("read_text_from_file", { filePath });
}

/* ── Terminal commands ────────────────────────────────────────── */

/** Open Terminal.app cd'd into the given project directory (macOS).
 * When claudeSessionId is provided, runs `claude --resume <id>` in the terminal. */
export async function openProjectTerminal(path: string, claudeSessionId?: string): Promise<void> {
  await invoke<void>("open_project_terminal", { path, claudeSessionId: claudeSessionId ?? null });
}

/* ── Skills commands ──────────────────────────────────────────── */

/** List skills for a project (includes global skills). */
export async function listSkills(projectId?: string): Promise<Skill[]> {
  return invoke<Skill[]>("list_skills", { projectId });
}

/** Create a new skill. Generates a UUID for the skill ID. */
export async function createSkill(
  name: string,
  content: string,
  projectId?: string,
  description?: string,
  triggerPattern?: string,
): Promise<Skill> {
  const id = `skill-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return invoke<Skill>("create_skill", { id, name, content, projectId, description, triggerPattern });
}

/** Update an existing skill. */
export async function updateSkill(
  id: string,
  name: string,
  content: string,
  description?: string,
  triggerPattern?: string,
): Promise<boolean> {
  return invoke<boolean>("update_skill", { id, name, content, description, triggerPattern });
}

/** Delete a skill by ID. */
export async function deleteSkill(id: string): Promise<boolean> {
  return invoke<boolean>("delete_skill", { id });
}

/** A skill discovered from Claude Code command files. */
export interface DiscoveredSkill {
  readonly name: string;
  readonly description: string;
  readonly content: string;
  readonly triggerPattern: string;
  readonly filePath: string;
  readonly scope: string;
}

/** Discover skills from ~/.claude/commands/ and optionally project-level commands. */
export async function discoverSkillsFromClaude(projectPath?: string): Promise<DiscoveredSkill[]> {
  return invoke<DiscoveredSkill[]>("discover_skills_from_claude", { projectPath: projectPath ?? null });
}

/* ── MCP commands ────────────────────────────────────────────── */

/** List all configured MCP servers. */
export async function listMcpServers(): Promise<McpServer[]> {
  return invoke<McpServer[]>("list_mcp_servers");
}

/** Add a new MCP server configuration. */
export async function addMcpServer(
  name: string,
  command: string,
  args?: string,
  env?: string,
  scope?: string,
): Promise<McpServer> {
  return invoke<McpServer>("add_mcp_server", { name, command, args, env, scope });
}

/** Toggle an MCP server enabled/disabled. */
export async function toggleMcpServer(id: string, enabled: boolean): Promise<boolean> {
  return invoke<boolean>("toggle_mcp_server", { id, enabled });
}

/** Run a health check on an MCP server. Returns true if healthy. */
export async function healthCheckMcp(id: string): Promise<boolean> {
  return invoke<boolean>("health_check_mcp", { id });
}

/** Import MCP servers from Claude Code config files. Returns count imported. */
export async function importMcpFromClaude(): Promise<number> {
  return invoke<number>("import_mcp_from_claude");
}

/** Delete an MCP server. */
export async function deleteMcpServer(id: string): Promise<boolean> {
  return invoke<boolean>("delete_mcp_server", { id });
}

/* ── Template commands ───────────────────────────────────────── */

/** List all templates (built-in + custom). */
export async function listTemplates(): Promise<Template[]> {
  return invoke<Template[]>("list_templates");
}

/** Save a plan as a template. */
export async function saveTemplate(
  name: string,
  plan: string,
  description?: string,
): Promise<Template> {
  return invoke<Template>("save_template", { name, plan, description });
}

/** Delete a custom template. */
export async function deleteTemplate(id: string): Promise<boolean> {
  return invoke<boolean>("delete_template", { id });
}

/** Load a template by ID. Returns the template with its plan. */
export async function loadTemplate(id: string): Promise<Template> {
  return invoke<Template>("load_template", { id });
}

/* ── Export commands ──────────────────────────────────────────── */

/** Export a session as a self-contained HTML replay file. Returns the HTML string. */
export async function exportSessionHtml(sessionId: string): Promise<string> {
  return invoke<string>("export_session_html", { sessionId });
}

/** Save a session replay to disk via native save dialog. Returns true if saved, false if cancelled. */
export async function saveSessionReplay(sessionId: string): Promise<boolean> {
  return invoke<boolean>("save_session_replay", { sessionId });
}

/* ── Event subscription ──────────────────────────────────────── */

/** Subscribe to a Tauri event. Returns an unsubscribe function. */
export async function onEvent<T>(
  eventName: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  return listen<T>(eventName, (event) => handler(event.payload));
}

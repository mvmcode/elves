/* Claude Code discovery types — mirrors the Rust ClaudeDiscovery structs from claude_discovery.rs. */

/** A custom agent definition discovered from ~/.claude/agents/<slug>.md */
export interface ClaudeAgent {
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly model: string | null;
  readonly color: string | null;
  readonly systemPrompt: string;
  readonly filePath: string;
}

/** User-level Claude Code settings from ~/.claude/settings.json */
export interface ClaudeSettings {
  readonly defaultModel: string | null;
  readonly defaultPermissionMode: string | null;
}

/** Everything ELVES discovers about the user's Claude Code installation */
export interface ClaudeDiscovery {
  readonly agents: readonly ClaudeAgent[];
  readonly settings: ClaudeSettings;
  readonly claudeDirExists: boolean;
  readonly hasAgents: boolean;
}

/** Options for customizing a Claude Code CLI invocation */
export interface ClaudeSpawnOptions {
  readonly agent?: string;
  readonly model?: string;
  readonly permissionMode?: string;
  readonly maxBudgetUsd?: number;
  readonly appendSystemPrompt?: string;
  readonly effort?: string;
  readonly resumeSessionId?: string;
  readonly continueSession?: boolean;
}

/** Available Claude models */
export type ClaudeModel = "opus" | "sonnet" | "haiku";

/** Permission modes supported by Claude Code */
export type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "dontAsk" | "plan";

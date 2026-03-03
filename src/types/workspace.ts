/* Workspace types — worktree-based workspace model for the ELVES redesign. */

/** A workspace represents a git worktree with an associated elf session. */
export interface WorkspaceInfo {
  readonly slug: string;
  readonly path: string;
  readonly branch: string;
  readonly status: WorkspaceStatus;
  readonly filesChanged: number;
  readonly lastModified: string | null;
  /** Name of the elf assigned to this workspace, if any. */
  readonly elfName?: string;
  /** Latest status message from the elf. */
  readonly elfStatus?: string;
  /** Runtime used in this workspace. */
  readonly runtime?: string;
}

export type WorkspaceStatus = "active" | "idle" | "paused" | "stale";

/** Diff summary for a workspace vs its base branch. */
export interface WorkspaceDiff {
  readonly filesChanged: number;
  readonly insertions: number;
  readonly deletions: number;
  readonly files: readonly DiffFile[];
}

export interface DiffFile {
  readonly path: string;
  readonly insertions: number;
  readonly deletions: number;
  readonly status: "added" | "modified" | "deleted";
}

/** Per-project config stored in .elves/config.json. */
export interface ProjectConfig {
  readonly defaultRuntime: string;
  readonly mcpServers: readonly McpServerEntry[];
  readonly memoryEnabled: boolean;
}

export interface McpServerEntry {
  readonly name: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Record<string, string>;
  readonly enabled: boolean;
}

/** Merge strategy for completing a workspace. */
export type MergeStrategy = "merge" | "rebase" | "squash";

/** Recently shipped workspace entry. */
export interface ShippedWorkspace {
  readonly slug: string;
  readonly branch: string;
  readonly elfName: string;
  readonly mergedAt: number;
  readonly memoriesExtracted: number;
}

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

/** Information about a single git repository discovered in the project directory. */
export interface GitRepoInfo {
  readonly path: string;
  readonly name: string;
  readonly currentBranch: string;
  readonly isDirty: boolean;
}

/** Describes the git topology of a project directory. */
export interface ProjectTopology {
  readonly kind: "single_repo" | "multi_repo" | "no_git";
  readonly repos: readonly GitRepoInfo[];
}

/** A workspace entry scoped to a specific repo within a multi-repo project. */
export interface RepoWorkspaceEntry {
  readonly repoPath: string;
  readonly repoName: string;
  readonly workspace: WorkspaceInfo;
}

/** A workspace spanning multiple repositories, grouped by slug. */
export interface MultiRepoWorkspace {
  readonly slug: string;
  readonly repos: readonly RepoWorkspaceEntry[];
  readonly status: string;
  readonly totalFilesChanged: number;
}

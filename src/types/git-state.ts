/* Git state types — full git context for a project, used by the git store and project context hook. */

/** Full git state for a project, refreshed on demand. */
export interface GitState {
  readonly currentBranch: string;
  readonly branches: readonly BranchSummary[];
  readonly worktrees: readonly WorktreeInfo[];
  readonly isDirty: boolean;
  readonly aheadBehind: { ahead: number; behind: number } | null;
}

/** Summary info for a single branch. */
export interface BranchSummary {
  readonly name: string;
  readonly isCurrent: boolean;
  readonly isRemote: boolean;
  readonly lastCommitHash: string;
  readonly lastCommitMessage: string;
}

/** Information about a single git worktree. */
export interface WorktreeInfo {
  readonly path: string;
  readonly branch: string;
  readonly commitHash: string;
  readonly isMain: boolean;
  readonly isLocked: boolean;
}

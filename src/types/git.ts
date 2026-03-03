/* Git types — branch info, commits, and status for the git awareness panel. */

/** Branch information returned by the `git_branch` command. */
export interface GitBranchInfo {
  readonly current: string;
  readonly local: readonly string[];
  readonly remote: readonly string[];
}

/** A single commit from `git log`. */
export interface GitCommit {
  readonly hash: string;
  readonly shortHash: string;
  readonly message: string;
  readonly author: string;
  readonly date: string;
}

/** A file change entry derived from `git status --porcelain`. */
export interface GitFileChange {
  readonly path: string;
  readonly status: string;
  readonly staged: boolean;
}

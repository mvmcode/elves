/* Git state — tracks branch info, commit history, file changes, and diff text. */

import { create } from "zustand";
import type { GitBranchInfo, GitCommit, GitFileChange } from "@/types/git";
import * as tauri from "@/lib/tauri";

interface GitState {
  /** Current branch information. */
  readonly branch: GitBranchInfo | null;
  /** Recent commit history. */
  readonly commits: readonly GitCommit[];
  /** Files with staged changes. */
  readonly stagedFiles: readonly GitFileChange[];
  /** Files with unstaged changes. */
  readonly unstagedFiles: readonly GitFileChange[];
  /** Currently displayed diff text. */
  readonly diffText: string;
  /** Whether a git operation is in flight. */
  readonly loading: boolean;
  /** Last error from a git operation. */
  readonly error: string | null;

  refreshBranch: (projectPath: string) => Promise<void>;
  refreshLog: (projectPath: string, maxCount?: number) => Promise<void>;
  refreshStatus: (projectPath: string) => Promise<void>;
  refreshAll: (projectPath: string) => Promise<void>;
  stageFiles: (projectPath: string, filePaths: string[]) => Promise<void>;
  unstageFiles: (projectPath: string, filePaths: string[]) => Promise<void>;
  viewDiff: (projectPath: string, filePath?: string) => Promise<void>;
  viewStagedDiff: (projectPath: string) => Promise<void>;
  commit: (projectPath: string, message: string) => Promise<void>;
  push: (projectPath: string) => Promise<string>;
  pull: (projectPath: string) => Promise<string>;
  switchBranch: (projectPath: string, branchName: string) => Promise<void>;
  clearDiff: () => void;
  clearError: () => void;
}

/** Parse `git status --porcelain` output into staged and unstaged file change lists. */
function parseStatusMap(statusMap: Record<string, string>): {
  staged: GitFileChange[];
  unstaged: GitFileChange[];
} {
  const staged: GitFileChange[] = [];
  const unstaged: GitFileChange[] = [];

  for (const [path, code] of Object.entries(statusMap)) {
    const indexStatus = code[0] ?? " ";
    const workStatus = code[1] ?? " ";

    // Index (staged) changes: anything other than space or ?
    if (indexStatus !== " " && indexStatus !== "?") {
      staged.push({ path, status: indexStatus, staged: true });
    }

    // Worktree (unstaged) changes: anything other than space
    if (workStatus !== " ") {
      unstaged.push({
        path,
        status: workStatus === "?" ? "?" : workStatus,
        staged: false,
      });
    }
  }

  staged.sort((a, b) => a.path.localeCompare(b.path));
  unstaged.sort((a, b) => a.path.localeCompare(b.path));

  return { staged, unstaged };
}

export const useGitStore = create<GitState>((set) => ({
  branch: null,
  commits: [],
  stagedFiles: [],
  unstagedFiles: [],
  diffText: "",
  loading: false,
  error: null,

  refreshBranch: async (projectPath: string): Promise<void> => {
    try {
      const branch = await tauri.gitBranch(projectPath);
      set({ branch, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  refreshLog: async (projectPath: string, maxCount?: number): Promise<void> => {
    try {
      const commits = await tauri.gitLog(projectPath, maxCount);
      set({ commits, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  refreshStatus: async (projectPath: string): Promise<void> => {
    try {
      const statusMap = await tauri.gitStatus(projectPath);
      const { staged, unstaged } = parseStatusMap(statusMap);
      set({ stagedFiles: staged, unstagedFiles: unstaged, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  refreshAll: async (projectPath: string): Promise<void> => {
    set({ loading: true });
    try {
      const [branch, commits, statusMap] = await Promise.all([
        tauri.gitBranch(projectPath),
        tauri.gitLog(projectPath),
        tauri.gitStatus(projectPath),
      ]);
      const { staged, unstaged } = parseStatusMap(statusMap);
      set({ branch, commits, stagedFiles: staged, unstagedFiles: unstaged, error: null, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  stageFiles: async (projectPath: string, filePaths: string[]): Promise<void> => {
    try {
      await tauri.gitStage(projectPath, filePaths);
      const statusMap = await tauri.gitStatus(projectPath);
      const { staged, unstaged } = parseStatusMap(statusMap);
      set({ stagedFiles: staged, unstagedFiles: unstaged, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  unstageFiles: async (projectPath: string, filePaths: string[]): Promise<void> => {
    try {
      await tauri.gitUnstage(projectPath, filePaths);
      const statusMap = await tauri.gitStatus(projectPath);
      const { staged, unstaged } = parseStatusMap(statusMap);
      set({ stagedFiles: staged, unstagedFiles: unstaged, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  viewDiff: async (projectPath: string, filePath?: string): Promise<void> => {
    try {
      const diffText = await tauri.gitDiff(projectPath, filePath);
      set({ diffText, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  viewStagedDiff: async (projectPath: string): Promise<void> => {
    try {
      const diffText = await tauri.gitDiffStaged(projectPath);
      set({ diffText, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  commit: async (projectPath: string, message: string): Promise<void> => {
    try {
      await tauri.gitCommit(projectPath, message);
      // Refresh status and log after commit
      const [commits, statusMap] = await Promise.all([
        tauri.gitLog(projectPath),
        tauri.gitStatus(projectPath),
      ]);
      const { staged, unstaged } = parseStatusMap(statusMap);
      set({ commits, stagedFiles: staged, unstagedFiles: unstaged, diffText: "", error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  push: async (projectPath: string): Promise<string> => {
    try {
      const result = await tauri.gitPush(projectPath);
      set({ error: null });
      return result;
    } catch (e) {
      const msg = String(e);
      set({ error: msg });
      return msg;
    }
  },

  pull: async (projectPath: string): Promise<string> => {
    try {
      const result = await tauri.gitPull(projectPath);
      // Refresh everything after pull
      const store = useGitStore.getState();
      await store.refreshAll(projectPath);
      return result;
    } catch (e) {
      const msg = String(e);
      set({ error: msg });
      return msg;
    }
  },

  switchBranch: async (projectPath: string, branchName: string): Promise<void> => {
    try {
      await tauri.gitSwitchBranch(projectPath, branchName);
      // Refresh everything after branch switch
      const store = useGitStore.getState();
      await store.refreshAll(projectPath);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  clearDiff: () => set({ diffText: "" }),
  clearError: () => set({ error: null }),
}));

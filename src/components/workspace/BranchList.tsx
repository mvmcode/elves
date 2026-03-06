/* BranchList — branch viewer for the git dashboard with switch, worktree, and delete actions. */

import { useCallback } from "react";
import type { BranchSummary } from "@/types/git-state";

interface BranchListProps {
  readonly branches: readonly BranchSummary[];
  readonly onSwitch: (branchName: string) => void;
  readonly onCreateWorktree: (branchName: string) => void;
  readonly onDelete: (branchName: string) => void;
}

/**
 * Lists all branches with current-branch indicator, last commit message,
 * and per-branch actions: switch, create worktree, delete.
 * Remote branches are shown but cannot be switched to directly.
 */
export function BranchList({
  branches,
  onSwitch,
  onCreateWorktree,
  onDelete,
}: BranchListProps): React.JSX.Element {
  const handleSwitch = useCallback(
    (name: string) => onSwitch(name),
    [onSwitch],
  );

  const handleCreateWorktree = useCallback(
    (name: string) => onCreateWorktree(name),
    [onCreateWorktree],
  );

  const handleDelete = useCallback(
    (name: string) => {
      if (window.confirm(`Delete branch "${name}"? This cannot be undone.`)) {
        onDelete(name);
      }
    },
    [onDelete],
  );

  if (branches.length === 0) {
    return (
      <div className="border-token-normal border-border bg-surface-elevated p-4 shadow-brutal-sm">
        <p className="font-body text-sm text-text-muted">No branches found.</p>
      </div>
    );
  }

  return (
    <div
      className="border-token-normal border-border bg-surface-elevated shadow-brutal-sm"
      data-testid="branch-list"
    >
      <div className="border-b-[2px] border-border/30 px-4 py-3">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-text-muted">
          Branches ({branches.length})
        </h3>
      </div>

      <div className="flex flex-col">
        {branches.map((branch) => (
          <div
            key={branch.name}
            className={[
              "flex items-center gap-3 border-b border-border/10 px-4 py-2.5 last:border-b-0",
              branch.isCurrent ? "bg-elf-gold/10" : "",
            ].join(" ")}
          >
            {/* Current branch indicator */}
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {branch.isCurrent && (
                <span className="inline-block h-2.5 w-2.5 border-[2px] border-border bg-success" />
              )}
            </span>

            {/* Branch name and last commit */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold">{branch.name}</span>
                {branch.isRemote && (
                  <span className="border-[2px] border-border/30 bg-text-light/5 px-1 py-0.5 font-mono text-[10px] text-text-muted">
                    remote
                  </span>
                )}
                {branch.isCurrent && (
                  <span className="border-[2px] border-border/30 bg-success/10 px-1 py-0.5 font-mono text-[10px] text-success">
                    current
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate font-body text-xs text-text-muted">
                {branch.lastCommitMessage}
              </p>
            </div>

            {/* Actions — hidden for current branch and remote branches */}
            {!branch.isCurrent && !branch.isRemote && (
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => handleSwitch(branch.name)}
                  className="cursor-pointer border-[2px] border-border bg-surface-elevated px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-text-muted shadow-brutal-xs transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                  title={`Switch to ${branch.name}`}
                >
                  Switch
                </button>
                <button
                  onClick={() => handleCreateWorktree(branch.name)}
                  className="cursor-pointer border-[2px] border-border bg-info/10 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-info shadow-brutal-xs transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                  title={`Create worktree from ${branch.name}`}
                >
                  Worktree
                </button>
                <button
                  onClick={() => handleDelete(branch.name)}
                  className="cursor-pointer border-[2px] border-border bg-error/10 px-2 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-error shadow-brutal-xs transition-all duration-100 hover:bg-error hover:text-white hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                  title={`Delete ${branch.name}`}
                >
                  Del
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

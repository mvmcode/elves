/* NewWorkspaceDialog — modal for creating a new worktree-based workspace with slug, base branch, and runtime. */

import { useState, useCallback } from "react";
import { Dialog } from "@/components/shared/Dialog";
import type { GitRepoInfo } from "@/types/workspace";

interface NewWorkspaceDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (slug: string, baseBranch?: string, runtime?: string, selectedRepoPaths?: string[]) => void;
  /** Available branches to use as a base. */
  readonly branches?: readonly string[];
  /** For multi-repo projects: list of discovered repos. */
  readonly repos?: readonly GitRepoInfo[];
  /** Topology kind — affects what the dialog shows. */
  readonly topologyKind?: string;
}

/** Validates that a workspace slug is lowercase alphanumeric with hyphens only. */
function isValidSlug(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(value) || /^[a-z0-9]$/.test(value);
}

/**
 * Dialog for creating a new workspace. Validates the slug format (lowercase, hyphens),
 * allows optional base branch selection and runtime choice. Uses the shared Dialog shell
 * for consistent modal behavior (Escape to close, overlay click, Framer Motion entrance).
 */
export function NewWorkspaceDialog({
  isOpen,
  onClose,
  onSubmit,
  branches = [],
  repos,
  topologyKind,
}: NewWorkspaceDialogProps): React.JSX.Element {
  const [slug, setSlug] = useState("");
  const [baseBranch, setBaseBranch] = useState("");
  const [runtime, setRuntime] = useState("claude");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<string[]>(repos?.map((r) => r.path) ?? []);

  const handleSlugChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setSlug(value);
    if (value && !isValidSlug(value)) {
      setSlugError("Slug must be lowercase letters, numbers, and hyphens. Cannot start or end with hyphen.");
    } else {
      setSlugError(null);
    }
  }, []);

  const handleSubmit = useCallback((): void => {
    if (!slug || !isValidSlug(slug)) {
      setSlugError("A valid workspace slug is required.");
      return;
    }
    const repoPaths = topologyKind === "multi_repo" ? selectedRepos : undefined;
    onSubmit(slug, baseBranch || undefined, runtime, repoPaths);
    setSlug("");
    setBaseBranch("");
    setRuntime("claude");
    setSlugError(null);
    setSelectedRepos(repos?.map((r) => r.path) ?? []);
    onClose();
  }, [slug, baseBranch, runtime, onSubmit, onClose]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      if (event.key === "Enter" && slug && !slugError) {
        handleSubmit();
      }
    },
    [slug, slugError, handleSubmit],
  );

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="New Workspace">
      <div className="flex flex-col gap-4">
        {/* Slug input */}
        <div>
          <label className="mb-1 block font-display text-xs font-bold uppercase tracking-wider text-text-muted">
            Workspace Name
          </label>
          <input
            type="text"
            value={slug}
            onChange={handleSlugChange}
            onKeyDown={handleKeyDown}
            placeholder="feat-auth-flow"
            className="w-full border-token-normal border-border bg-white px-3 py-2 font-mono text-sm outline-none focus:shadow-brutal-xs focus:shadow-elf-gold"
            autoFocus
            data-testid="workspace-slug-input"
          />
          {slugError && (
            <p className="mt-1 font-body text-xs text-error">{slugError}</p>
          )}
        </div>

        {/* Base branch selector */}
        <div>
          <label className="mb-1 block font-display text-xs font-bold uppercase tracking-wider text-text-muted">
            Base Branch (optional)
          </label>
          <select
            value={baseBranch}
            onChange={(event) => setBaseBranch(event.target.value)}
            className="w-full border-token-normal border-border bg-white px-3 py-2 font-mono text-sm outline-none focus:shadow-brutal-xs focus:shadow-elf-gold"
            data-testid="workspace-base-branch"
          >
            <option value="">Current branch</option>
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </div>

        {/* Multi-repo: repo selection checkboxes */}
        {topologyKind === "multi_repo" && repos && repos.length > 0 && (
          <div>
            <label className="mb-1 block font-display text-xs font-bold uppercase tracking-wider text-text-muted">
              Repositories
            </label>
            <div className="flex flex-col gap-1">
              {repos.map((repo) => {
                const isChecked = selectedRepos.includes(repo.path);
                return (
                  <label
                    key={repo.path}
                    className="flex cursor-pointer items-center gap-2 border-[2px] border-border/30 bg-white px-3 py-2 transition-colors hover:bg-surface-elevated"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedRepos((prev) =>
                          isChecked
                            ? prev.filter((p) => p !== repo.path)
                            : [...prev, repo.path],
                        );
                      }}
                      className="h-4 w-4 accent-elf-gold"
                    />
                    <span className="font-display text-xs font-bold">{repo.name}</span>
                    <span className="font-mono text-[10px] text-text-muted">{repo.currentBranch}</span>
                    {repo.isDirty && (
                      <span className="h-2 w-2 rounded-full bg-elf-gold" title="Uncommitted changes" />
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Runtime picker */}
        <div>
          <label className="mb-1 block font-display text-xs font-bold uppercase tracking-wider text-text-muted">
            Runtime
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setRuntime("claude")}
              className={[
                "flex-1 cursor-pointer border-[2px] border-border px-3 py-2 font-display text-xs font-bold uppercase tracking-wider transition-all duration-100",
                runtime === "claude"
                  ? "bg-elf-gold text-text-light shadow-brutal-xs"
                  : "bg-surface-elevated text-text-muted hover:bg-white",
              ].join(" ")}
              data-testid="runtime-claude"
            >
              Claude Code
            </button>
            <button
              onClick={() => setRuntime("codex")}
              className={[
                "flex-1 cursor-pointer border-[2px] border-border px-3 py-2 font-display text-xs font-bold uppercase tracking-wider transition-all duration-100",
                runtime === "codex"
                  ? "bg-elf-gold text-text-light shadow-brutal-xs"
                  : "bg-surface-elevated text-text-muted hover:bg-white",
              ].join(" ")}
              data-testid="runtime-codex"
            >
              Codex
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="cursor-pointer border-[2px] border-border bg-surface-elevated px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-text-muted shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!slug || !!slugError}
            className={[
              "cursor-pointer border-[2px] border-border px-4 py-2 font-display text-xs font-bold uppercase tracking-wider shadow-brutal-xs transition-all duration-100",
              slug && !slugError
                ? "bg-elf-gold text-text-light hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                : "cursor-not-allowed bg-text-light/10 text-text-light/30",
            ].join(" ")}
            data-testid="create-workspace-btn"
          >
            Create Workspace
          </button>
        </div>
      </div>
    </Dialog>
  );
}

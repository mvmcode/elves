/* MultiRepoWorkspaceCard — displays a multi-repo workspace spanning multiple repositories. */

import { useState, useCallback } from "react";
import type { MultiRepoWorkspace } from "@/types/workspace";

interface MultiRepoWorkspaceCardProps {
  readonly workspace: MultiRepoWorkspace;
  readonly onFocus: (slug: string) => void;
  readonly onDiff: (slug: string) => void;
  readonly onShipIt: (slug: string) => void;
  readonly onRemove: (slug: string) => void;
}

export function MultiRepoWorkspaceCard({
  workspace,
  onFocus,
  onDiff,
  onShipIt,
  onRemove,
}: MultiRepoWorkspaceCardProps): React.JSX.Element {
  const [isExpanded, setExpanded] = useState(false);

  const handleFocus = useCallback(() => onFocus(workspace.slug), [onFocus, workspace.slug]);
  const handleDiff = useCallback(() => onDiff(workspace.slug), [onDiff, workspace.slug]);
  const handleShipIt = useCallback(() => onShipIt(workspace.slug), [onShipIt, workspace.slug]);
  const handleRemove = useCallback(() => {
    if (window.confirm(`Remove workspace "${workspace.slug}" from all repos?`)) {
      onRemove(workspace.slug);
    }
  }, [onRemove, workspace.slug]);

  return (
    <div
      className="border-token-normal border-border bg-surface-elevated p-5 shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-brutal-xs"
      data-testid={`multi-workspace-card-${workspace.slug}`}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="font-display text-base font-bold tracking-tight">{workspace.slug}</span>
        <span className="border-[2px] border-border bg-accent-blue px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
          {workspace.repos.length} repo{workspace.repos.length !== 1 ? "s" : ""}
        </span>
        {workspace.totalFilesChanged > 0 && (
          <span className="font-mono text-xs text-text-muted">
            {workspace.totalFilesChanged} file{workspace.totalFilesChanged !== 1 ? "s" : ""} changed
          </span>
        )}
      </div>

      {/* Expandable repo list */}
      <button
        onClick={() => setExpanded(!isExpanded)}
        className="mb-2 cursor-pointer border-none bg-transparent font-display text-[11px] font-bold uppercase tracking-wider text-text-muted hover:text-text-light"
      >
        {isExpanded ? "▾ Hide repos" : "▸ Show repos"}
      </button>

      {isExpanded && (
        <div className="mb-3 flex flex-col gap-1">
          {workspace.repos.map((entry) => (
            <div
              key={entry.repoPath}
              className="flex items-center gap-2 border-[2px] border-border/30 bg-surface px-3 py-1.5"
            >
              <span className="font-display text-xs font-bold">{entry.repoName}</span>
              <span className="font-mono text-[10px] text-text-muted">{entry.workspace.branch}</span>
              {entry.workspace.filesChanged > 0 && (
                <span className="font-mono text-[10px] text-elf-gold">
                  {entry.workspace.filesChanged} changed
                </span>
              )}
              <span
                className={`ml-auto inline-block h-2 w-2 rounded-full ${
                  entry.workspace.status === "active" ? "bg-success" : "bg-elf-gold"
                }`}
              />
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleFocus}
          className="cursor-pointer border-[2px] border-border bg-elf-gold px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-text-light shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          Focus
        </button>
        <button
          onClick={handleDiff}
          className="cursor-pointer border-[2px] border-border bg-surface-elevated px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-text-light shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          Diff
        </button>
        <button
          onClick={handleShipIt}
          className="cursor-pointer border-[2px] border-border bg-success px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-white shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          Ship It
        </button>
        <button
          onClick={handleRemove}
          className="ml-auto cursor-pointer border-[2px] border-border bg-error/10 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-error shadow-brutal-xs transition-all duration-100 hover:bg-error hover:text-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

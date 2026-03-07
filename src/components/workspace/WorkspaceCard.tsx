/* WorkspaceCard — displays a single worktree-based workspace with its elf, status, diff summary, and actions. */

import { useCallback } from "react";
import type { WorkspaceInfo } from "@/types/workspace";

/** Lightweight session info passed to WorkspaceCard for resume support. */
export interface LastSessionInfo {
  readonly id: string;
  readonly task: string;
  readonly claudeSessionId: string | null;
  readonly status: string;
  readonly runtime: string;
}

interface WorkspaceCardProps {
  readonly workspace: WorkspaceInfo;
  readonly lastSession?: LastSessionInfo | null;
  /** When true, hides git-specific actions (Diff, Ship It, Remove worktree). */
  readonly hideGitActions?: boolean;
  readonly onOpen: (slug: string) => void;
  readonly onResume: (slug: string) => void;
  readonly onDiff: (slug: string) => void;
  readonly onShipIt: (slug: string) => void;
  readonly onRemove: (slug: string) => void;
}

/** Maps workspace status to a colored dot indicator. */
function StatusDot({ status }: { readonly status: WorkspaceInfo["status"] }): React.JSX.Element {
  const colorClass =
    status === "active"
      ? "bg-success"
      : status === "idle" || status === "paused"
        ? "bg-elf-gold"
        : "bg-text-light/30";

  return <span className={`inline-block h-3 w-3 shrink-0 border-[2px] border-border ${colorClass}`} />;
}

/** Runtime badge — shows which agent runtime is powering the workspace. */
function RuntimeBadge({ runtime }: { readonly runtime?: string }): React.JSX.Element | null {
  if (!runtime) return null;
  return (
    <span className="border-[2px] border-border bg-info px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
      {runtime}
    </span>
  );
}

/**
 * Card showing a single workspace with its elf assignment, current status,
 * diff summary, and action buttons for open, diff, ship, and remove.
 */
export function WorkspaceCard({
  workspace,
  lastSession,
  hideGitActions,
  onOpen,
  onResume,
  onDiff,
  onShipIt,
  onRemove,
}: WorkspaceCardProps): React.JSX.Element {
  const handleOpen = useCallback(() => onOpen(workspace.slug), [onOpen, workspace.slug]);
  const handleResume = useCallback(() => onResume(workspace.slug), [onResume, workspace.slug]);
  const handleDiff = useCallback(() => onDiff(workspace.slug), [onDiff, workspace.slug]);
  const handleShipIt = useCallback(() => onShipIt(workspace.slug), [onShipIt, workspace.slug]);
  const handleRemove = useCallback(() => {
    if (hideGitActions) {
      onRemove(workspace.slug);
    } else if (window.confirm(`Remove workspace "${workspace.slug}"? This will delete the worktree and branch.`)) {
      onRemove(workspace.slug);
    }
  }, [onRemove, workspace.slug, hideGitActions]);

  /** True when the workspace can resume a previous Claude session via --resume. */
  const canResume = workspace.status !== "active" && !!(
    workspace.status === "paused" || (
      lastSession?.claudeSessionId &&
      ["completed", "cancelled", "error", "failed"].includes(lastSession.status)
    )
  );

  const diffSummary = workspace.filesChanged > 0
    ? `${workspace.filesChanged} file${workspace.filesChanged !== 1 ? "s" : ""} changed`
    : null;

  return (
    <div
      className="border-token-normal border-border bg-surface-elevated p-5 shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-brutal-xs"
      data-testid={`workspace-card-${workspace.slug}`}
    >
      {/* Header row — status dot, slug, elf name, runtime badge */}
      <div className="mb-3 flex items-center gap-2">
        <StatusDot status={workspace.status} />
        <span className="font-display text-base font-bold tracking-tight">{workspace.slug}</span>
        {workspace.elfName && (
          <span className="font-body text-sm text-text-muted">{workspace.elfName}</span>
        )}
        <div className="ml-auto">
          <RuntimeBadge runtime={workspace.runtime} />
        </div>
      </div>

      {/* Branch and file change info */}
      {!hideGitActions && (
        <div className="mb-2 font-mono text-xs text-text-muted">
          <span>{workspace.branch}</span>
          {diffSummary && (
            <span className="ml-2">{diffSummary}</span>
          )}
        </div>
      )}

      {/* Last task subtitle from session history */}
      {lastSession?.task && (
        <p className="mb-1 truncate font-body text-xs text-text-muted">
          Last: {lastSession.task.slice(0, 80)}{lastSession.task.length > 80 ? "..." : ""}
        </p>
      )}

      {/* Elf status message */}
      {workspace.elfStatus && (
        <p className="mb-3 truncate font-body text-sm italic text-text-muted">
          &ldquo;{workspace.elfStatus}&rdquo;
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={canResume ? handleResume : handleOpen}
          className="cursor-pointer border-[2px] border-border bg-info px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-white shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          data-testid={canResume ? "workspace-resume-btn" : "workspace-open-btn"}
        >
          {canResume ? "Resume" : "Open"}
        </button>

        {!hideGitActions && (
          <button
            onClick={handleDiff}
            className="cursor-pointer border-[2px] border-border bg-surface-elevated px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-text-light shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            data-testid="workspace-diff-btn"
          >
            Diff
          </button>
        )}

        {!hideGitActions && workspace.status === "idle" && (
          <button
            onClick={handleShipIt}
            className="cursor-pointer border-[2px] border-border bg-success px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-white shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            data-testid="workspace-shipit-btn"
          >
            Ship It
          </button>
        )}

        <button
          onClick={handleRemove}
          className="ml-auto cursor-pointer border-[2px] border-border bg-error/10 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-error shadow-brutal-xs transition-all duration-100 hover:bg-error hover:text-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          data-testid="workspace-remove-btn"
        >
          {hideGitActions ? "Close" : "Remove"}
        </button>
      </div>
    </div>
  );
}

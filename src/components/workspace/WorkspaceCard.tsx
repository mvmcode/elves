/* WorkspaceCard — displays a single worktree-based workspace with its elf, status, diff summary, and actions. */

import { useCallback } from "react";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";
import type { WorkspaceInfo } from "@/types/workspace";

interface WorkspaceCardProps {
  readonly workspace: WorkspaceInfo;
  readonly onFocus: (slug: string) => void;
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
    <span className="border-[2px] border-border bg-accent-blue px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
      {runtime}
    </span>
  );
}

/**
 * Card showing a single workspace with its elf assignment, current status,
 * diff summary, and action buttons for focus, diff, ship, and remove.
 */
export function WorkspaceCard({
  workspace,
  onFocus,
  onResume,
  onDiff,
  onShipIt,
  onRemove,
}: WorkspaceCardProps): React.JSX.Element {
  const handleFocus = useCallback(() => onFocus(workspace.slug), [onFocus, workspace.slug]);
  const handleResume = useCallback(() => onResume(workspace.slug), [onResume, workspace.slug]);

  /** Navigate to the floor tab linked to this workspace's worktree slug. */
  const handleGoToFloor = useCallback((): void => {
    const { floors, switchFloor, createFloor } = useSessionStore.getState();
    const matchingFloor = Object.values(floors).find(
      (floor) => floor.worktreeSlug === workspace.slug,
    );
    if (matchingFloor) {
      switchFloor(matchingFloor.id);
    } else {
      /* No matching floor — create one linked to this worktree */
      const floorId = createFloor(workspace.slug);
      useSessionStore.getState().setFloorWorktree(floorId, workspace.slug, workspace.path);
    }
    useUiStore.getState().setActiveView("session");
  }, [workspace.slug, workspace.path]);
  const handleDiff = useCallback(() => onDiff(workspace.slug), [onDiff, workspace.slug]);
  const handleShipIt = useCallback(() => onShipIt(workspace.slug), [onShipIt, workspace.slug]);
  const handleRemove = useCallback(() => {
    if (window.confirm(`Remove workspace "${workspace.slug}"? This will delete the worktree and branch.`)) {
      onRemove(workspace.slug);
    }
  }, [onRemove, workspace.slug]);

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
      <div className="mb-2 font-mono text-xs text-text-muted">
        <span>{workspace.branch}</span>
        {workspace.filesChanged > 0 && (
          <span className="ml-2">
            {workspace.filesChanged} file{workspace.filesChanged !== 1 ? "s" : ""} changed
          </span>
        )}
      </div>

      {/* Elf status message */}
      {workspace.elfStatus && (
        <p className="mb-3 truncate font-body text-sm italic text-text-muted">
          &ldquo;{workspace.elfStatus}&rdquo;
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleGoToFloor}
          className="cursor-pointer border-[2px] border-border bg-info px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-white shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          data-testid="workspace-goto-floor-btn"
        >
          Go to Floor
        </button>

        <button
          onClick={handleFocus}
          className="cursor-pointer border-[2px] border-border bg-elf-gold px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-text-light shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          data-testid="workspace-focus-btn"
        >
          Focus
        </button>

        <button
          onClick={handleDiff}
          className="cursor-pointer border-[2px] border-border bg-surface-elevated px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-text-light shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          data-testid="workspace-diff-btn"
        >
          Diff
        </button>

        {workspace.status === "paused" && (
          <button
            onClick={handleResume}
            className="cursor-pointer border-[2px] border-border bg-accent-blue px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-white shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            data-testid="workspace-resume-btn"
          >
            Resume
          </button>
        )}

        {workspace.status === "idle" && (
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
          Remove
        </button>
      </div>
    </div>
  );
}

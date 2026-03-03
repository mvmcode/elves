/* ProjectWorkspace — main workspace view showing all worktree-based workspaces for the active project. */

import { useState, useEffect, useCallback } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { useProjectStore } from "@/stores/project";
import { useGitStore } from "@/stores/git";
import { WorkspaceCard } from "./WorkspaceCard";
import { NewWorkspaceDialog } from "./NewWorkspaceDialog";
import { ShipItDialog } from "./ShipItDialog";
import { DiffViewer } from "./DiffViewer";
import { RecentlyShipped } from "./RecentlyShipped";
import * as tauri from "@/lib/tauri";
import type { WorkspaceInfo, MergeStrategy } from "@/types/workspace";

/**
 * Primary workspace view — displayed when activeView === "workspace".
 * Shows all worktree-based workspaces for the current project, a "recently shipped" section,
 * and controls for creating, focusing, diffing, shipping, and removing workspaces.
 */
export function ProjectWorkspace(): React.JSX.Element {
  const activeProject = useProjectStore((state) =>
    state.projects.find((p) => p.id === state.activeProjectId),
  );
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const diffs = useWorkspaceStore((state) => state.diffs);
  const recentlyShipped = useWorkspaceStore((state) => state.recentlyShipped);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const error = useWorkspaceStore((state) => state.error);
  const setWorkspaces = useWorkspaceStore((state) => state.setWorkspaces);
  const setDiff = useWorkspaceStore((state) => state.setDiff);
  const setLoading = useWorkspaceStore((state) => state.setLoading);
  const setError = useWorkspaceStore((state) => state.setError);
  const removeWorkspaceFromStore = useWorkspaceStore((state) => state.removeWorkspace);
  const addShipped = useWorkspaceStore((state) => state.addShipped);

  const gitState = useGitStore((state) => state.gitState);

  const [isNewDialogOpen, setNewDialogOpen] = useState(false);
  const [shipItWorkspace, setShipItWorkspace] = useState<WorkspaceInfo | null>(null);
  const [viewingDiffSlug, setViewingDiffSlug] = useState<string | null>(null);

  /** Load workspaces when the project changes. */
  useEffect(() => {
    if (!activeProject?.path) return;
    setLoading(true);
    tauri
      .listWorkspaces(activeProject.path)
      .then((result) => {
        setWorkspaces(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(String(err));
        setLoading(false);
      });
  }, [activeProject?.path, setWorkspaces, setLoading, setError]);

  /** Create a new workspace. */
  const handleCreateWorkspace = useCallback(
    (slug: string, baseBranch?: string, _runtime?: string): void => {
      if (!activeProject?.path) return;
      setLoading(true);
      tauri
        .createWorkspace(activeProject.path, slug, baseBranch)
        .then(() => tauri.listWorkspaces(activeProject.path))
        .then((result) => {
          setWorkspaces(result);
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(String(err));
          setLoading(false);
        });
    },
    [activeProject?.path, setWorkspaces, setLoading, setError],
  );

  /** Focus on a workspace — for now, sets it as active. */
  const handleFocus = useCallback(
    (slug: string): void => {
      useWorkspaceStore.getState().setActiveWorkspace(slug);
    },
    [],
  );

  /** Resume a paused workspace. */
  const handleResume = useCallback(
    (_slug: string): void => {
      // Resume logic will be wired when the agent runtime integration is complete.
    },
    [],
  );

  /** Load and display diff for a workspace. */
  const handleDiff = useCallback(
    (slug: string): void => {
      if (!activeProject?.path) return;
      if (viewingDiffSlug === slug) {
        setViewingDiffSlug(null);
        return;
      }
      setViewingDiffSlug(slug);
      tauri
        .getWorkspaceDiff(activeProject.path, slug)
        .then((diff) => setDiff(slug, diff))
        .catch((err: unknown) => setError(String(err)));
    },
    [activeProject?.path, viewingDiffSlug, setDiff, setError],
  );

  /** Open Ship It dialog for a workspace. */
  const handleShipItOpen = useCallback(
    (slug: string): void => {
      const workspace = workspaces.find((w) => w.slug === slug);
      if (workspace) setShipItWorkspace(workspace);
    },
    [workspaces],
  );

  /** Execute the ship-it flow. */
  const handleShipItConfirm = useCallback(
    (strategy: MergeStrategy, extractMemory: boolean): void => {
      if (!activeProject?.path || !shipItWorkspace) return;
      setLoading(true);
      tauri
        .completeWorkspace(activeProject.path, shipItWorkspace.slug, strategy, extractMemory)
        .then(() => {
          addShipped({
            slug: shipItWorkspace.slug,
            branch: shipItWorkspace.branch,
            elfName: shipItWorkspace.elfName ?? "Unknown",
            mergedAt: Date.now(),
            memoriesExtracted: extractMemory ? 1 : 0,
          });
          removeWorkspaceFromStore(shipItWorkspace.slug);
          setShipItWorkspace(null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(String(err));
          setLoading(false);
        });
    },
    [activeProject?.path, shipItWorkspace, addShipped, removeWorkspaceFromStore, setLoading, setError],
  );

  /** Remove a workspace (worktree + branch). */
  const handleRemove = useCallback(
    (slug: string): void => {
      if (!activeProject?.path) return;
      setLoading(true);
      tauri
        .removeWorkspace(activeProject.path, slug, false)
        .then(() => {
          removeWorkspaceFromStore(slug);
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(String(err));
          setLoading(false);
        });
    },
    [activeProject?.path, removeWorkspaceFromStore, setLoading, setError],
  );

  /** Refresh git state. */
  const handleRefreshGit = useCallback((): void => {
    if (!activeProject?.path) return;
    useGitStore.getState().refreshGitState(activeProject.path).catch(() => {
      /* errors handled in the git store */
    });
  }, [activeProject?.path]);

  /** Available local branches for the new workspace dialog. */
  const localBranches = gitState
    ? gitState.branches.filter((b) => !b.isRemote).map((b) => b.name)
    : [];

  if (!activeProject) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="font-display text-lg text-text-muted">
          Select or create a project to manage workspaces.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6" data-testid="project-workspace">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold tracking-tight">Workspaces</h2>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshGit}
            className="cursor-pointer border-[2px] border-border bg-surface-elevated px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-text-muted shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Git Status
          </button>
          <button
            onClick={() => setNewDialogOpen(true)}
            className="cursor-pointer border-[2px] border-border bg-elf-gold px-4 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-text-light shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            data-testid="new-workspace-btn"
          >
            + New Workspace
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 border-[2px] border-border bg-error/10 px-4 py-3 font-body text-sm text-error">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 cursor-pointer border-none bg-transparent font-bold text-error underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="mb-4 border-[2px] border-border bg-elf-gold/10 px-4 py-3 font-display text-xs font-bold uppercase tracking-wider text-text-muted">
          Loading workspaces...
        </div>
      )}

      {/* Workspace grid */}
      {workspaces.length > 0 ? (
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {workspaces.map((workspace) => (
            <div key={workspace.slug} className="flex flex-col gap-2">
              <WorkspaceCard
                workspace={workspace}
                onFocus={handleFocus}
                onResume={handleResume}
                onDiff={handleDiff}
                onShipIt={handleShipItOpen}
                onRemove={handleRemove}
              />
              {viewingDiffSlug === workspace.slug && (
                <DiffViewer
                  diff={diffs[workspace.slug] ?? null}
                  workspaceSlug={workspace.slug}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        !isLoading && (
          <div className="mb-8 border-[2px] border-border/30 bg-white p-8 text-center">
            <p className="font-display text-lg font-bold text-text-muted">
              No workspaces yet.
            </p>
            <p className="mt-1 font-body text-sm text-text-muted">
              Create one to start working. Each workspace is a git worktree with its own elf.
            </p>
          </div>
        )
      )}

      {/* Recently shipped section */}
      <RecentlyShipped items={recentlyShipped} />

      {/* New workspace dialog */}
      <NewWorkspaceDialog
        isOpen={isNewDialogOpen}
        onClose={() => setNewDialogOpen(false)}
        onSubmit={handleCreateWorkspace}
        branches={localBranches}
      />

      {/* Ship It confirmation dialog */}
      {shipItWorkspace && (
        <ShipItDialog
          isOpen={!!shipItWorkspace}
          workspace={shipItWorkspace}
          onClose={() => setShipItWorkspace(null)}
          onConfirm={handleShipItConfirm}
        />
      )}
    </div>
  );
}

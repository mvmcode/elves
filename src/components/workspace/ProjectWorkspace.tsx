/* ProjectWorkspace — main workspace view showing all worktree-based workspaces for the active project. */

import { useState, useEffect, useCallback } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { useProjectStore } from "@/stores/project";
import { useGitStore } from "@/stores/git";
import { WorkspaceCard } from "./WorkspaceCard";
import { MultiRepoWorkspaceCard } from "./MultiRepoWorkspaceCard";
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
  const topology = useWorkspaceStore((state) => state.topology);
  const setTopology = useWorkspaceStore((state) => state.setTopology);
  const multiRepoWorkspaces = useWorkspaceStore((state) => state.multiRepoWorkspaces);
  const setMultiRepoWorkspaces = useWorkspaceStore((state) => state.setMultiRepoWorkspaces);

  const gitState = useGitStore((state) => state.gitState);

  const [isNewDialogOpen, setNewDialogOpen] = useState(false);
  const [shipItWorkspace, setShipItWorkspace] = useState<WorkspaceInfo | null>(null);
  const [viewingDiffSlug, setViewingDiffSlug] = useState<string | null>(null);

  /** Discover project topology on mount. */
  useEffect(() => {
    if (!activeProject?.path) return;
    tauri.discoverGitRepos(activeProject.path)
      .then((topo) => setTopology(topo))
      .catch(() => setTopology(null));
  }, [activeProject?.path, setTopology]);

  /** Load workspaces when the project or topology changes. */
  useEffect(() => {
    if (!activeProject?.path) return;
    setLoading(true);
    if (topology?.kind === "multi_repo") {
      const repoPaths = topology.repos.map((r) => r.path);
      tauri
        .listMultiRepoWorkspaces(activeProject.path, repoPaths)
        .then((result) => {
          setMultiRepoWorkspaces(result);
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(String(err));
          setLoading(false);
        });
    } else {
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
    }
  }, [activeProject?.path, topology, setWorkspaces, setMultiRepoWorkspaces, setLoading, setError]);

  /** Helper to get repo paths from topology. */
  const getRepoPaths = useCallback((): string[] => {
    return topology?.repos.map((r) => r.path) ?? [];
  }, [topology]);

  /** Create a new workspace. */
  const handleCreateWorkspace = useCallback(
    (slug: string, baseBranch?: string, _runtime?: string, selectedRepoPaths?: string[]): void => {
      if (!activeProject?.path) return;
      setLoading(true);
      if (topology?.kind === "multi_repo" && selectedRepoPaths && selectedRepoPaths.length > 0) {
        tauri
          .createMultiRepoWorkspace(activeProject.path, slug, selectedRepoPaths, baseBranch)
          .then(() => tauri.listMultiRepoWorkspaces(activeProject.path, getRepoPaths()))
          .then((result) => {
            setMultiRepoWorkspaces(result);
            setLoading(false);
          })
          .catch((err: unknown) => {
            setError(String(err));
            setLoading(false);
          });
      } else {
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
      }
    },
    [activeProject?.path, topology, getRepoPaths, setWorkspaces, setMultiRepoWorkspaces, setLoading, setError],
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

  /** Load and display diff for a multi-repo workspace. */
  const handleMultiRepoDiff = useCallback(
    (slug: string): void => {
      if (!activeProject?.path) return;
      if (viewingDiffSlug === slug) {
        setViewingDiffSlug(null);
        return;
      }
      setViewingDiffSlug(slug);
      tauri
        .getMultiRepoWorkspaceDiff(activeProject.path, slug, getRepoPaths())
        .then((diff) => setDiff(slug, diff))
        .catch((err: unknown) => setError(String(err)));
    },
    [activeProject?.path, viewingDiffSlug, getRepoPaths, setDiff, setError],
  );

  /** Open Ship It dialog for a multi-repo workspace. */
  const handleMultiRepoShipItOpen = useCallback(
    (slug: string): void => {
      const mrWorkspace = multiRepoWorkspaces.find((w) => w.slug === slug);
      const firstRepo = mrWorkspace?.repos[0];
      if (firstRepo) {
        setShipItWorkspace(firstRepo.workspace);
      }
    },
    [multiRepoWorkspaces],
  );

  /** Execute the multi-repo ship-it flow. */
  const handleMultiRepoShipItConfirm = useCallback(
    (strategy: MergeStrategy, extractMemory: boolean): void => {
      if (!activeProject?.path || !shipItWorkspace) return;
      setLoading(true);
      tauri
        .completeMultiRepoWorkspace(activeProject.path, shipItWorkspace.slug, getRepoPaths(), strategy, extractMemory)
        .then(() => {
          addShipped({
            slug: shipItWorkspace.slug,
            branch: shipItWorkspace.branch,
            elfName: shipItWorkspace.elfName ?? "Unknown",
            mergedAt: Date.now(),
            memoriesExtracted: extractMemory ? 1 : 0,
          });
          return tauri.listMultiRepoWorkspaces(activeProject.path, getRepoPaths());
        })
        .then((result) => {
          setMultiRepoWorkspaces(result);
          setShipItWorkspace(null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(String(err));
          setLoading(false);
        });
    },
    [activeProject?.path, shipItWorkspace, getRepoPaths, addShipped, setMultiRepoWorkspaces, setLoading, setError],
  );

  /** Remove a multi-repo workspace from all repos. */
  const handleMultiRepoRemove = useCallback(
    (slug: string): void => {
      if (!activeProject?.path) return;
      setLoading(true);
      tauri
        .removeMultiRepoWorkspace(activeProject.path, slug, getRepoPaths())
        .then(() => tauri.listMultiRepoWorkspaces(activeProject.path, getRepoPaths()))
        .then((result) => {
          setMultiRepoWorkspaces(result);
          setLoading(false);
        })
        .catch((err: unknown) => {
          setError(String(err));
          setLoading(false);
        });
    },
    [activeProject?.path, getRepoPaths, setMultiRepoWorkspaces, setLoading, setError],
  );

  /** Focus on a multi-repo workspace. */
  const handleMultiRepoFocus = useCallback(
    (slug: string): void => {
      useWorkspaceStore.getState().setActiveWorkspace(slug);
    },
    [],
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
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl font-bold tracking-tight">Workspaces</h2>
          {topology?.kind === "multi_repo" && (
            <span className="border-[2px] border-border bg-accent-blue px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
              Multi-repo: {topology.repos.length} repos
            </span>
          )}
        </div>
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

      {/* No-git message */}
      {topology?.kind === "no_git" && (
        <div className="mb-8 border-[2px] border-border/30 bg-surface-elevated p-8 text-center">
          <p className="font-display text-lg font-bold text-text-muted">
            This project directory has no git repositories.
          </p>
          <p className="mt-1 font-body text-sm text-text-muted">
            Initialize a git repository to use workspaces.
          </p>
        </div>
      )}

      {/* Multi-repo workspace grid */}
      {topology?.kind === "multi_repo" && (
        multiRepoWorkspaces.length > 0 ? (
          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {multiRepoWorkspaces.map((mrWorkspace) => (
              <div key={mrWorkspace.slug} className="flex flex-col gap-2">
                <MultiRepoWorkspaceCard
                  workspace={mrWorkspace}
                  onFocus={handleMultiRepoFocus}
                  onDiff={handleMultiRepoDiff}
                  onShipIt={handleMultiRepoShipItOpen}
                  onRemove={handleMultiRepoRemove}
                />
                {viewingDiffSlug === mrWorkspace.slug && (
                  <DiffViewer
                    diff={diffs[mrWorkspace.slug] ?? null}
                    workspaceSlug={mrWorkspace.slug}
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          !isLoading && (
            <div className="mb-8 border-[2px] border-border/30 bg-surface-elevated p-8 text-center">
              <p className="font-display text-lg font-bold text-text-muted">
                No workspaces yet.
              </p>
              <p className="mt-1 font-body text-sm text-text-muted">
                Create one to start working across {topology.repos.length} repositories.
              </p>
            </div>
          )
        )
      )}

      {/* Single-repo workspace grid (existing flow) */}
      {(topology?.kind === "single_repo" || !topology) && (
        workspaces.length > 0 ? (
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
            <div className="mb-8 border-[2px] border-border/30 bg-surface-elevated p-8 text-center">
              <p className="font-display text-lg font-bold text-text-muted">
                No workspaces yet.
              </p>
              <p className="mt-1 font-body text-sm text-text-muted">
                Create one to start working. Each workspace is a git worktree with its own elf.
              </p>
            </div>
          )
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
        repos={topology?.kind === "multi_repo" ? topology.repos : undefined}
        topologyKind={topology?.kind}
      />

      {/* Ship It confirmation dialog */}
      {shipItWorkspace && (
        <ShipItDialog
          isOpen={!!shipItWorkspace}
          workspace={shipItWorkspace}
          onClose={() => setShipItWorkspace(null)}
          onConfirm={topology?.kind === "multi_repo" ? handleMultiRepoShipItConfirm : handleShipItConfirm}
          repos={topology?.kind === "multi_repo" ? topology.repos.map((r) => r.name) : undefined}
        />
      )}
    </div>
  );
}

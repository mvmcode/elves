/* ProjectWorkspace — main workspace view showing all worktree-based workspaces for the active project.
 * Switches between workspace grid (with inline task bar) and WorkspaceTerminalView when a workspace is open. */

import { useState, useEffect, useCallback, useRef } from "react";
import { useWorkspaceStore } from "@/stores/workspace";
import { useProjectStore } from "@/stores/project";
import { useSessionStore } from "@/stores/session";
import { useGitStore } from "@/stores/git";
import { useAppStore } from "@/stores/app";
import { WorkspaceCard, type LastSessionInfo } from "./WorkspaceCard";
import { MultiRepoWorkspaceCard } from "./MultiRepoWorkspaceCard";
import { NewWorkspaceDialog } from "./NewWorkspaceDialog";
import { ShipItDialog } from "./ShipItDialog";
import { DiffViewer } from "./DiffViewer";
import { RecentlyShipped } from "./RecentlyShipped";
import { WorkspaceTerminalView } from "./WorkspaceTerminalView";
import { WorkspaceTabBar } from "./WorkspaceTabBar";
import { Input } from "@/components/shared/Input";
import { DeployButton } from "@/components/shared/DeployButton";
import { useTeamSession } from "@/hooks/useTeamSession";
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
  const sessionMode = useWorkspaceStore((state) => state.sessionMode);
  const setSessionMode = useWorkspaceStore((state) => state.setSessionMode);

  const activeWorkspaceSlug = useWorkspaceStore((state) => state.activeWorkspaceSlug);
  const openWorkspaceSlugs = useWorkspaceStore((state) => state.openWorkspaceSlugs);
  const openWorkspaceAction = useWorkspaceStore((state) => state.openWorkspace);
  const gitState = useGitStore((state) => state.gitState);
  const defaultRuntime = useAppStore((state) => state.defaultRuntime);
  const { analyzeAndDeploy } = useTeamSession();
  const setFloorWorktree = useSessionStore((s) => s.setFloorWorktree);
  const setFloorPtyId = useSessionStore((s) => s.setFloorPtyId);

  const [isNewDialogOpen, setNewDialogOpen] = useState(false);
  const [shipItWorkspace, setShipItWorkspace] = useState<WorkspaceInfo | null>(null);
  const [viewingDiffSlug, setViewingDiffSlug] = useState<string | null>(null);
  const [taskText, setTaskText] = useState("");
  const taskInputRef = useRef<HTMLInputElement>(null);
  const [lastSessions, setLastSessions] = useState<Record<string, LastSessionInfo | null>>({});

  /** Discover project topology on mount. */
  useEffect(() => {
    if (!activeProject?.path) return;
    tauri.discoverGitRepos(activeProject.path)
      .then((topo) => setTopology(topo))
      .catch(() => setTopology({ kind: "no_git", repos: [] }));
  }, [activeProject?.path, setTopology]);

  /** Load workspaces when the project or topology changes. Skip git listing in direct mode.
   * IMPORTANT: Wait for topology discovery to complete (topology !== null) before running any
   * git commands. On mount, topology starts null and sessionMode defaults to "worktree". Without
   * this guard, listWorkspaces would run `git worktree list` on a multi-repo root that isn't a
   * git repo, causing a fatal error. */
  useEffect(() => {
    if (!activeProject?.path) return;
    if (sessionMode === "direct") {
      /* Direct mode — workspace list is managed in-memory only, no git queries. */
      setLoading(false);
      return;
    }
    /* Topology not yet discovered — wait for it before attempting any git operations. */
    if (!topology) return;
    setLoading(true);
    if (topology.kind === "multi_repo") {
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
  }, [activeProject?.path, topology, sessionMode, setWorkspaces, setMultiRepoWorkspaces, setLoading, setError]);

  /** Fetch last session for each workspace to enable resume buttons. */
  useEffect(() => {
    if (!activeProject?.id || workspaces.length === 0) return;
    const projectId = activeProject.id;
    const promises = workspaces.map((ws) =>
      tauri.getLastWorkspaceSession(projectId, ws.slug)
        .then((session): [string, LastSessionInfo | null] => {
          if (!session) return [ws.slug, null];
          return [ws.slug, {
            id: session.id,
            task: session.task,
            claudeSessionId: session.claudeSessionId ?? null,
            status: session.status,
            runtime: session.runtime,
          }];
        })
        .catch((): [string, null] => [ws.slug, null]),
    );
    Promise.all(promises).then((entries) => {
      const map: Record<string, LastSessionInfo | null> = {};
      for (const [slug, info] of entries) {
        map[slug] = info;
      }
      setLastSessions(map);
    });
  }, [activeProject?.id, workspaces]);

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

  /** Open a workspace — add tab and switch to terminal view. */
  const handleOpen = useCallback(
    (slug: string): void => {
      openWorkspaceAction(slug);
    },
    [openWorkspaceAction],
  );

  /** Resume a workspace session using Claude's --resume flag. */
  const handleResume = useCallback(
    async (slug: string): Promise<void> => {
      if (!activeProject?.id) return;

      const session = lastSessions[slug];
      if (!session?.claudeSessionId) {
        console.warn("Cannot resume: no claudeSessionId for workspace", slug);
        return;
      }

      /* Open the workspace tab */
      openWorkspaceAction(slug);

      /* Find workspace path */
      const workspace = workspaces.find((w) => w.slug === slug);
      const workingDir = workspace?.path;

      try {
        const runtime = session.runtime ?? defaultRuntime;
        const spawnOptions: tauri.StartTaskPtyResult = await tauri.startTaskPty(
          activeProject.id,
          "Resuming session...",
          runtime,
          workingDir,
          { resumeSessionId: session.claudeSessionId } as import("@/types/claude").ClaudeSpawnOptions,
          slug,
        );

        /* Wire PTY to workspace store */
        const wsStore = useWorkspaceStore.getState();
        wsStore.setPtyId(slug, spawnOptions.ptyId);
        wsStore.updateWorkspaceStatus(slug, "active");

        /* Store PTY on the active floor */
        const state = useSessionStore.getState();
        const floorId = state.activeFloorId;
        if (floorId) {
          setFloorPtyId(floorId, spawnOptions.ptyId);
          if (workspace?.path) {
            setFloorWorktree(floorId, slug, workspace.path);
          }
        }
      } catch (error) {
        console.error("Failed to resume workspace session:", error);
        setError(String(error));
      }
    },
    [activeProject?.id, lastSessions, workspaces, defaultRuntime, openWorkspaceAction, setFloorPtyId, setFloorWorktree, setError],
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

  /** Remove a workspace. Direct-mode workspaces are removed from store only (no git worktree). */
  const handleRemove = useCallback(
    (slug: string): void => {
      const workspace = workspaces.find((w) => w.slug === slug);
      if (workspace && !workspace.branch) {
        /* Direct mode — just remove from in-memory store. */
        removeWorkspaceFromStore(slug);
        return;
      }
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
    [activeProject?.path, workspaces, removeWorkspaceFromStore, setLoading, setError],
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

  /** Open a multi-repo workspace — add tab and switch to terminal view. */
  const handleMultiRepoOpen = useCallback(
    (slug: string): void => {
      openWorkspaceAction(slug);
    },
    [openWorkspaceAction],
  );

  /** Handle task submit — create workspace and deploy agent. */
  const handleSummon = useCallback(async (): Promise<void> => {
    const task = taskText.trim();
    if (!task || !activeProject?.path) return;
    setTaskText("");
    taskInputRef.current?.blur();
    await analyzeAndDeploy(task);
  }, [taskText, activeProject?.path, analyzeAndDeploy]);

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

  const canSummon = taskText.trim().length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="project-workspace">
      {/* Tab bar — only when tabs exist */}
      {openWorkspaceSlugs.length > 0 && <WorkspaceTabBar />}

      {/* Terminal views for ALL open workspaces — hidden via display:none to preserve xterm buffers */}
      {openWorkspaceSlugs.map((slug) => {
        const ws =
          workspaces.find((w) => w.slug === slug) ??
          multiRepoWorkspaces.find((m) => m.slug === slug)?.repos[0]?.workspace ??
          null;
        if (!ws) return null;
        return (
          <div
            key={slug}
            className="flex flex-1 flex-col overflow-hidden"
            style={{ display: slug === activeWorkspaceSlug ? "flex" : "none" }}
          >
            <WorkspaceTerminalView workspace={ws} />
          </div>
        );
      })}

      {/* Workspace grid with inline task bar — visible when no tab is active */}
      {!activeWorkspaceSlug && (
      <div className="flex-1 overflow-y-auto">
      {/* Task bar — only visible on the grid home screen */}
      <div className="shrink-0 border-b-[2px] border-border/30 bg-surface-elevated px-6 py-3">
        <div className="mx-auto flex max-w-[800px] items-center gap-2">
          <span className="shrink-0 text-sm text-text-light/30">{"\u2692"}</span>
          <Input
            ref={taskInputRef}
            value={taskText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskText(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
              if (e.key === "Enter" && canSummon) {
                e.preventDefault();
                void handleSummon();
              }
            }}
            placeholder="What do you want the elves to do?"

          />
          <span className="shrink-0 border-[2px] border-border bg-[#4D96FF] px-2 py-1 font-mono text-[10px] font-bold uppercase text-white shadow-[2px_2px_0px_0px_#000]">
            {defaultRuntime === "codex" ? "CX" : "CC"}
          </span>
          <DeployButton onClick={() => void handleSummon()} disabled={!canSummon} />
        </div>
      </div>

      <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl font-bold tracking-tight">Workspaces</h2>
            {topology?.kind === "multi_repo" && (
              <span className="border-[2px] border-border bg-info px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                Multi-repo: {topology.repos.length} repos
              </span>
            )}
          </div>
          <p className="font-body text-xs text-text-muted">
            Workspaces are created automatically when you deploy a task.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Session mode toggle */}
          <div className="flex border-[2px] border-border">
            <button
              onClick={() => setSessionMode("worktree")}
              disabled={topology?.kind === "no_git"}
              className={[
                "cursor-pointer px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider transition-all duration-100",
                sessionMode === "worktree"
                  ? "bg-info text-white"
                  : "bg-surface-elevated text-text-muted hover:bg-surface-elevated/80",
                topology?.kind === "no_git" ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
              title={topology?.kind === "no_git" ? "No git repository — worktree mode unavailable" : "Create isolated git worktrees for each task"}
            >
              Worktree
            </button>
            <button
              onClick={() => setSessionMode("direct")}
              className={[
                "cursor-pointer border-l-[2px] border-border px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider transition-all duration-100",
                sessionMode === "direct"
                  ? "bg-info text-white"
                  : "bg-surface-elevated text-text-muted hover:bg-surface-elevated/80",
              ].join(" ")}
              title="Run agents directly in the project folder"
            >
              Direct
            </button>
          </div>

          {sessionMode !== "direct" && (
            <>
              <button
                onClick={handleRefreshGit}
                className="cursor-pointer border-[2px] border-border bg-surface-elevated px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-text-muted shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
              >
                Git Status
              </button>
              <button
                onClick={() => setNewDialogOpen(true)}
                className="cursor-pointer border-[2px] border-border/50 bg-surface-elevated px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-text-muted shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                data-testid="new-workspace-btn"
                title="Manually create a workspace (optional)"
              >
                +
              </button>
            </>
          )}
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

      {/* No-git info — sessions run directly in the project folder */}
      {topology?.kind === "no_git" && workspaces.length === 0 && (
        <div className="mb-8 border-[2px] border-border/30 bg-surface-elevated p-8 text-center">
          <p className="font-display text-lg font-bold text-text-muted">
            No git detected — sessions run directly in the project folder.
          </p>
          <p className="mt-1 font-body text-sm text-text-muted">
            Deploy a task from the bar above and an elf will work right here.
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
                  onFocus={handleMultiRepoOpen}
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
                Deploy a task from the chat bar and a workspace will be created automatically.
              </p>
            </div>
          )
        )
      )}

      {/* Single-repo workspace grid (worktree mode) */}
      {sessionMode === "worktree" && (topology?.kind === "single_repo" || !topology) && (
        workspaces.length > 0 ? (
          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {workspaces.map((workspace) => (
              <div key={workspace.slug} className="flex flex-col gap-2">
                <WorkspaceCard
                  workspace={workspace}
                  lastSession={lastSessions[workspace.slug]}
                  onOpen={handleOpen}
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
                Deploy a task from the chat bar and a workspace will be created automatically.
              </p>
            </div>
          )
        )
      )}

      {/* Direct-mode workspace grid */}
      {sessionMode === "direct" && (
        workspaces.length > 0 ? (
          <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {workspaces.map((workspace) => (
              <div key={workspace.slug} className="flex flex-col gap-2">
                <WorkspaceCard
                  workspace={workspace}
                  lastSession={lastSessions[workspace.slug]}
                  hideGitActions
                  onOpen={handleOpen}
                  onResume={handleResume}
                  onDiff={handleDiff}
                  onShipIt={handleShipItOpen}
                  onRemove={handleRemove}
                />
              </div>
            ))}
          </div>
        ) : (
          !isLoading && topology?.kind !== "no_git" && (
            <div className="mb-8 border-[2px] border-border/30 bg-surface-elevated p-8 text-center">
              <p className="font-display text-lg font-bold text-text-muted">
                No sessions yet.
              </p>
              <p className="mt-1 font-body text-sm text-text-muted">
                Deploy a task from the bar above — agents run directly in the project folder.
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
      </div>
      )}
    </div>
  );
}

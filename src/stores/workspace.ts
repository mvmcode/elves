/* Workspace store — manages worktree-based workspaces for the active project. */

import { create } from "zustand";
import type { WorkspaceInfo, WorkspaceDiff, ShippedWorkspace, ProjectTopology, MultiRepoWorkspace, TeamPtyEntry } from "@/types/workspace";

interface WorkspaceState {
  /** All workspaces for the current project. */
  readonly workspaces: readonly WorkspaceInfo[];
  /** Currently focused workspace slug, or null (null = grid view). */
  readonly activeWorkspaceSlug: string | null;
  /** Ordered list of workspace slugs that have open tabs. */
  readonly openWorkspaceSlugs: readonly string[];
  /** Cached diffs keyed by workspace slug. */
  readonly diffs: Readonly<Record<string, WorkspaceDiff>>;
  /** Recently shipped workspaces (persisted in session for display). */
  readonly recentlyShipped: readonly ShippedWorkspace[];
  /** Whether workspace list is currently loading. */
  readonly isLoading: boolean;
  /** Error message from last operation, if any. */
  readonly error: string | null;
  /** Discovered project topology. */
  readonly topology: ProjectTopology | null;
  /** Multi-repo workspaces (only populated when topology is multi_repo). */
  readonly multiRepoWorkspaces: readonly MultiRepoWorkspace[];
  /** Maps workspace slug to its active PTY ID for terminal connections. */
  readonly ptyIds: Readonly<Record<string, string>>;
  /** Maps workspace slug to team PTY entries (one per role). Presence signals split view. */
  readonly teamPtyEntries: Readonly<Record<string, readonly TeamPtyEntry[]>>;
  /** Session launch mode — "worktree" creates git worktrees, "direct" runs in the project folder. */
  readonly sessionMode: "worktree" | "direct";

  setWorkspaces: (workspaces: WorkspaceInfo[]) => void;
  setActiveWorkspace: (slug: string | null) => void;
  /** Open a workspace tab — adds to openWorkspaceSlugs (if not present) and activates it. */
  openWorkspace: (slug: string) => void;
  /** Close a workspace tab — removes from openWorkspaceSlugs, switches to adjacent tab or null. */
  closeWorkspaceTab: (slug: string) => void;
  setDiff: (slug: string, diff: WorkspaceDiff) => void;
  addShipped: (shipped: ShippedWorkspace) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTopology: (topology: ProjectTopology | null) => void;
  setMultiRepoWorkspaces: (workspaces: MultiRepoWorkspace[]) => void;
  /** Set the PTY ID for a workspace. */
  setPtyId: (slug: string, ptyId: string) => void;
  /** Remove a PTY ID for a workspace. */
  removePtyId: (slug: string) => void;
  /** Add a workspace to the list eagerly (idempotent — skips if slug already exists). */
  addWorkspace: (workspace: WorkspaceInfo) => void;
  /** Update a single workspace's status in the list. */
  updateWorkspaceStatus: (slug: string, status: WorkspaceInfo["status"]) => void;
  /** Remove a workspace from the list (after deletion/completion). */
  removeWorkspace: (slug: string) => void;
  /** Set team PTY entries for a workspace (triggers split terminal view). */
  setTeamPtyEntries: (slug: string, entries: TeamPtyEntry[]) => void;
  /** Clear team PTY entries for a workspace. */
  clearTeamPtyEntries: (slug: string) => void;
  /** Set the session launch mode. */
  setSessionMode: (mode: "worktree" | "direct") => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspaceSlug: null,
  openWorkspaceSlugs: [],
  diffs: {},
  recentlyShipped: [],
  isLoading: false,
  error: null,
  topology: null,
  multiRepoWorkspaces: [],
  ptyIds: {},
  teamPtyEntries: {},
  sessionMode: "worktree",

  setWorkspaces: (workspaces: WorkspaceInfo[]) => set({ workspaces, error: null }),
  setActiveWorkspace: (slug: string | null) => set({ activeWorkspaceSlug: slug }),
  openWorkspace: (slug: string) =>
    set((state) => ({
      activeWorkspaceSlug: slug,
      openWorkspaceSlugs: state.openWorkspaceSlugs.includes(slug)
        ? state.openWorkspaceSlugs
        : [...state.openWorkspaceSlugs, slug],
    })),
  closeWorkspaceTab: (slug: string) =>
    set((state) => {
      const tabs = state.openWorkspaceSlugs.filter((s) => s !== slug);
      let nextActive: string | null = null;
      if (state.activeWorkspaceSlug === slug) {
        const closedIndex = state.openWorkspaceSlugs.indexOf(slug);
        nextActive = tabs[Math.min(closedIndex, tabs.length - 1)] ?? null;
      } else {
        nextActive = state.activeWorkspaceSlug;
      }
      return { openWorkspaceSlugs: tabs, activeWorkspaceSlug: nextActive };
    }),
  setDiff: (slug: string, diff: WorkspaceDiff) =>
    set((state) => ({ diffs: { ...state.diffs, [slug]: diff } })),
  addShipped: (shipped: ShippedWorkspace) =>
    set((state) => ({ recentlyShipped: [shipped, ...state.recentlyShipped].slice(0, 10) })),
  setTopology: (topology: ProjectTopology | null) => set({
    topology,
    sessionMode:
      topology === null ? "worktree"
        : topology.kind === "multi_repo" || topology.kind === "no_git" ? "direct"
        : "worktree",
  }),
  setMultiRepoWorkspaces: (workspaces: MultiRepoWorkspace[]) => set({ multiRepoWorkspaces: workspaces }),
  setPtyId: (slug: string, ptyId: string) =>
    set((state) => ({ ptyIds: { ...state.ptyIds, [slug]: ptyId } })),
  removePtyId: (slug: string) =>
    set((state) => {
      const { [slug]: _, ...rest } = state.ptyIds;
      return { ptyIds: rest };
    }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),
  addWorkspace: (workspace: WorkspaceInfo) =>
    set((state) => ({
      workspaces: state.workspaces.some((w) => w.slug === workspace.slug)
        ? state.workspaces
        : [...state.workspaces, workspace],
    })),
  updateWorkspaceStatus: (slug: string, status: WorkspaceInfo["status"]) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.slug === slug ? { ...w, status } : w,
      ),
    })),
  removeWorkspace: (slug: string) =>
    set((state) => {
      const tabs = state.openWorkspaceSlugs.filter((s) => s !== slug);
      let nextActive = state.activeWorkspaceSlug;
      if (nextActive === slug) {
        const closedIndex = state.openWorkspaceSlugs.indexOf(slug);
        nextActive = tabs[Math.min(closedIndex, tabs.length - 1)] ?? null;
      }
      return {
        workspaces: state.workspaces.filter((w) => w.slug !== slug),
        activeWorkspaceSlug: nextActive,
        openWorkspaceSlugs: tabs,
      };
    }),
  setTeamPtyEntries: (slug: string, entries: TeamPtyEntry[]) =>
    set((state) => ({ teamPtyEntries: { ...state.teamPtyEntries, [slug]: entries } })),
  clearTeamPtyEntries: (slug: string) =>
    set((state) => {
      const { [slug]: _, ...rest } = state.teamPtyEntries;
      return { teamPtyEntries: rest };
    }),
  setSessionMode: (mode: "worktree" | "direct") => set({ sessionMode: mode }),
}));

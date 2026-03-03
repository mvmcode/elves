/* Workspace store — manages worktree-based workspaces for the active project. */

import { create } from "zustand";
import type { WorkspaceInfo, WorkspaceDiff, ShippedWorkspace } from "@/types/workspace";

interface WorkspaceState {
  /** All workspaces for the current project. */
  readonly workspaces: readonly WorkspaceInfo[];
  /** Currently focused workspace slug, or null. */
  readonly activeWorkspaceSlug: string | null;
  /** Cached diffs keyed by workspace slug. */
  readonly diffs: Readonly<Record<string, WorkspaceDiff>>;
  /** Recently shipped workspaces (persisted in session for display). */
  readonly recentlyShipped: readonly ShippedWorkspace[];
  /** Whether workspace list is currently loading. */
  readonly isLoading: boolean;
  /** Error message from last operation, if any. */
  readonly error: string | null;

  setWorkspaces: (workspaces: WorkspaceInfo[]) => void;
  setActiveWorkspace: (slug: string | null) => void;
  setDiff: (slug: string, diff: WorkspaceDiff) => void;
  addShipped: (shipped: ShippedWorkspace) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  /** Update a single workspace's status in the list. */
  updateWorkspaceStatus: (slug: string, status: WorkspaceInfo["status"]) => void;
  /** Remove a workspace from the list (after deletion/completion). */
  removeWorkspace: (slug: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspaceSlug: null,
  diffs: {},
  recentlyShipped: [],
  isLoading: false,
  error: null,

  setWorkspaces: (workspaces: WorkspaceInfo[]) => set({ workspaces, error: null }),
  setActiveWorkspace: (slug: string | null) => set({ activeWorkspaceSlug: slug }),
  setDiff: (slug: string, diff: WorkspaceDiff) =>
    set((state) => ({ diffs: { ...state.diffs, [slug]: diff } })),
  addShipped: (shipped: ShippedWorkspace) =>
    set((state) => ({ recentlyShipped: [shipped, ...state.recentlyShipped].slice(0, 10) })),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setError: (error: string | null) => set({ error }),
  updateWorkspaceStatus: (slug: string, status: WorkspaceInfo["status"]) =>
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.slug === slug ? { ...w, status } : w,
      ),
    })),
  removeWorkspace: (slug: string) =>
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.slug !== slug),
      activeWorkspaceSlug: state.activeWorkspaceSlug === slug ? null : state.activeWorkspaceSlug,
    })),
}));

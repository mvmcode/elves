/* File explorer state — tracks expanded directories, cached listings, and git status. */

import { create } from "zustand";
import type { FileEntry } from "@/types/filesystem";

interface FileExplorerState {
  /** Set of expanded directory paths */
  readonly expandedDirs: ReadonlySet<string>;
  /** Cached directory listings: path -> entries */
  readonly dirCache: ReadonlyMap<string, readonly FileEntry[]>;
  /** Git status map: relative_path -> status_code */
  readonly gitStatusMap: Readonly<Record<string, string>>;
  /** Loading state for individual directories */
  readonly loadingDirs: ReadonlySet<string>;

  toggleDir: (path: string) => void;
  setDirEntries: (path: string, entries: readonly FileEntry[]) => void;
  setGitStatus: (statusMap: Record<string, string>) => void;
  setDirLoading: (path: string, loading: boolean) => void;
  collapseAll: () => void;
  invalidateCache: () => void;
}

export const useFileExplorerStore = create<FileExplorerState>((set) => ({
  expandedDirs: new Set<string>(),
  dirCache: new Map<string, readonly FileEntry[]>(),
  gitStatusMap: {},
  loadingDirs: new Set<string>(),

  toggleDir: (path: string) =>
    set((state) => {
      const next = new Set(state.expandedDirs);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { expandedDirs: next };
    }),

  setDirEntries: (path: string, entries: readonly FileEntry[]) =>
    set((state) => {
      const next = new Map(state.dirCache);
      next.set(path, entries);
      return { dirCache: next };
    }),

  setGitStatus: (statusMap: Record<string, string>) =>
    set({ gitStatusMap: statusMap }),

  setDirLoading: (path: string, loading: boolean) =>
    set((state) => {
      const next = new Set(state.loadingDirs);
      if (loading) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return { loadingDirs: next };
    }),

  collapseAll: () =>
    set({ expandedDirs: new Set<string>() }),

  invalidateCache: () =>
    set({ dirCache: new Map<string, readonly FileEntry[]>(), expandedDirs: new Set<string>() }),
}));

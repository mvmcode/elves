/* FileExplorer — file tree content with git status indicators.
 * Embedded inside FileTreePanel. Shows the active project's directory structure with lazy-loaded children. */

import { useEffect, useCallback, useMemo } from "react";
import { useProjectStore } from "@/stores/project";
import { useFileExplorerStore } from "@/stores/fileExplorer";
import { listDirectory, gitStatus } from "@/lib/tauri";
import { FileTreeNode } from "./FileTreeNode";
import type { FileEntry } from "@/types/filesystem";

interface FileExplorerProps {
  /** Optional search query to filter visible nodes by name (case-insensitive substring). */
  readonly searchQuery?: string;
}

/** Recursively checks if an entry or any descendant matches the search query. */
function entryMatchesSearch(
  entry: FileEntry,
  query: string,
  dirCache: ReadonlyMap<string, readonly FileEntry[]>,
): boolean {
  const lowerQuery = query.toLowerCase();
  if (entry.name.toLowerCase().includes(lowerQuery)) return true;
  if (entry.isDir) {
    const children = dirCache.get(entry.path);
    if (children) {
      return children.some((child) => entryMatchesSearch(child, query, dirCache));
    }
  }
  return false;
}

export function FileExplorer({ searchQuery }: FileExplorerProps): React.JSX.Element {
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const dirCache = useFileExplorerStore((s) => s.dirCache);
  const gitStatusMap = useFileExplorerStore((s) => s.gitStatusMap);
  const setDirEntries = useFileExplorerStore((s) => s.setDirEntries);
  const setGitStatus = useFileExplorerStore((s) => s.setGitStatus);
  const collapseAll = useFileExplorerStore((s) => s.collapseAll);
  const invalidateCache = useFileExplorerStore((s) => s.invalidateCache);

  const projectPath = activeProject?.path ?? null;
  const rootEntries = projectPath ? dirCache.get(projectPath) : undefined;

  /** Load root directory and git status when project changes. */
  useEffect(() => {
    if (!projectPath) return;

    let cancelled = false;

    async function loadRoot(): Promise<void> {
      if (!projectPath) return;
      try {
        const [entries, status] = await Promise.all([
          listDirectory(projectPath),
          gitStatus(projectPath),
        ]);
        if (cancelled) return;
        setDirEntries(projectPath, entries);
        setGitStatus(status);
      } catch (error) {
        console.error("Failed to load file explorer root:", error);
      }
    }

    void loadRoot();
    return () => { cancelled = true; };
  }, [projectPath, setDirEntries, setGitStatus]);

  /** Refresh: clear cache and reload everything. */
  const handleRefresh = useCallback(async (): Promise<void> => {
    if (!projectPath) return;
    invalidateCache();
    try {
      const [entries, status] = await Promise.all([
        listDirectory(projectPath),
        gitStatus(projectPath),
      ]);
      setDirEntries(projectPath, entries);
      setGitStatus(status);
    } catch (error) {
      console.error("Failed to refresh file explorer:", error);
    }
  }, [projectPath, invalidateCache, setDirEntries, setGitStatus]);

  /** Filter entries by search query if provided. */
  const filteredEntries = useMemo(() => {
    if (!rootEntries || !searchQuery?.trim()) return rootEntries;
    return rootEntries.filter((entry) => entryMatchesSearch(entry, searchQuery, dirCache));
  }, [rootEntries, searchQuery, dirCache]);

  if (!activeProject) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="font-display text-[10px] font-bold uppercase tracking-wider text-[#555]">
          No project selected
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar row — collapse all + refresh */}
      <div className="flex items-center justify-between border-b border-[#2a2a40] px-3 py-1">
        <p className="truncate font-mono text-[10px] text-[#555]" title={activeProject.path}>
          {activeProject.name}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={collapseAll}
            className="flex h-5 w-5 cursor-pointer items-center justify-center border-none bg-transparent text-[#555] transition-colors hover:text-[#ccc]"
            title="Collapse all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          <button
            onClick={handleRefresh}
            className="flex h-5 w-5 cursor-pointer items-center justify-center border-none bg-transparent text-[#555] transition-colors hover:text-[#ccc]"
            title="Refresh"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto py-1">
        {filteredEntries ? (
          filteredEntries.length > 0 ? (
            filteredEntries.map((entry) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                projectPath={activeProject.path}
                gitStatusMap={gitStatusMap}
                searchQuery={searchQuery}
              />
            ))
          ) : (
            <p className="px-3 py-4 font-mono text-xs text-[#555]">
              {searchQuery?.trim() ? "No matching files" : "Empty directory"}
            </p>
          )
        ) : (
          <p className="px-3 py-4 font-mono text-xs text-[#555]">Loading...</p>
        )}
      </div>
    </div>
  );
}

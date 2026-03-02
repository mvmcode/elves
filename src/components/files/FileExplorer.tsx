/* FileExplorer — top-level collapsible file tree with git status indicators.
 * Shows the active project's directory structure with lazy-loaded children. */

import { useEffect, useCallback } from "react";
import { useProjectStore } from "@/stores/project";
import { useFileExplorerStore } from "@/stores/fileExplorer";
import { listDirectory, gitStatus } from "@/lib/tauri";
import { FileTreeNode } from "./FileTreeNode";

export function FileExplorer(): React.JSX.Element {
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

  if (!activeProject) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <p className="font-display text-sm font-bold uppercase tracking-wider text-[#666]">
            No Project Selected
          </p>
          <p className="mt-2 font-body text-xs text-[#555]">
            Select or create a project to browse files.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#1A1A2E]">
      {/* Header */}
      <div className="flex items-center justify-between border-b-[2px] border-[#333] px-3 py-2">
        <h3 className="font-display text-xs font-bold uppercase tracking-wider text-[#888]">
          Project Files
        </h3>
        <div className="flex items-center gap-1">
          {/* Collapse all */}
          <button
            onClick={collapseAll}
            className="flex h-6 w-6 cursor-pointer items-center justify-center border-none bg-transparent text-[#666] transition-colors hover:text-[#ccc]"
            title="Collapse all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="flex h-6 w-6 cursor-pointer items-center justify-center border-none bg-transparent text-[#666] transition-colors hover:text-[#ccc]"
            title="Refresh"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Project path breadcrumb */}
      <div className="border-b border-[#2a2a40] px-3 py-1.5">
        <p className="truncate font-mono text-[10px] text-[#555]" title={activeProject.path}>
          {activeProject.path}
        </p>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto py-1">
        {rootEntries ? (
          rootEntries.length > 0 ? (
            rootEntries.map((entry) => (
              <FileTreeNode
                key={entry.path}
                entry={entry}
                depth={0}
                projectPath={activeProject.path}
                gitStatusMap={gitStatusMap}
              />
            ))
          ) : (
            <p className="px-3 py-4 font-mono text-xs text-[#555]">Empty directory</p>
          )
        ) : (
          <p className="px-3 py-4 font-mono text-xs text-[#555]">Loading...</p>
        )}
      </div>
    </div>
  );
}

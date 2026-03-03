/* useProjectContext — orchestrates side effects when the active project changes.
 * Resets and reloads git state, file explorer root, skills, MCP servers, and memories. */

import { useEffect, useState, useRef } from "react";
import { useProjectStore } from "@/stores/project";
import { useGitStore } from "@/stores/git";

/**
 * Watches for project changes and reloads project-scoped state.
 *
 * When the active project changes:
 * 1. Resets git store and refreshes git state for the new project path
 * 2. (Future) Reloads file explorer root, skills, MCP servers, memories
 *
 * Returns loading and error state for the orchestration.
 */
export function useProjectContext(): {
  readonly isLoading: boolean;
  readonly error: string | null;
} {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    /* Skip if no project is selected or if it hasn't changed */
    if (!activeProjectId || activeProjectId === prevProjectIdRef.current) return;
    prevProjectIdRef.current = activeProjectId;

    const project = projects.find((p) => p.id === activeProjectId);
    if (!project) return;

    setIsLoading(true);
    setError(null);

    const gitStore = useGitStore.getState();

    /* 1. Reset git state for the old project */
    gitStore.resetGitState();

    /* 2. Refresh git state for the new project */
    gitStore
      .refreshGitState(project.path)
      .catch((e: unknown) => {
        /* Git state refresh is best-effort — project may not be a git repo */
        console.warn("Failed to refresh git state:", e);
      })
      .finally(() => {
        setIsLoading(false);
      });

    /* Future hooks:
     * 3. Reload file explorer root to project.path
     * 4. Reload skills for project.id
     * 5. Reload MCP servers scoped to project
     * 6. Reload memories for project.id */
  }, [activeProjectId, projects]);

  return { isLoading, error };
}

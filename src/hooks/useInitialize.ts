/* App initialization hook — detects runtimes, discovers Claude world, loads projects, and runs memory decay on first mount. */

import { useEffect } from "react";
import { useAppStore } from "@/stores/app";
import { useProjectStore } from "@/stores/project";
import { detectRuntimes, listProjects, decayMemories, discoverClaude } from "@/lib/tauri";

/**
 * Runs once on app mount to detect runtimes, discover the user's Claude Code
 * installation (custom agents, settings), load projects from the database,
 * and apply memory relevance decay. Sets loading state while initialization is in progress.
 */
export function useInitialize(): void {
  const setRuntimes = useAppStore((s) => s.setRuntimes);
  const setClaudeDiscovery = useAppStore((s) => s.setClaudeDiscovery);
  const setLoaded = useAppStore((s) => s.setLoaded);
  const setProjects = useProjectStore((s) => s.setProjects);

  useEffect(() => {
    async function initialize(): Promise<void> {
      try {
        const [runtimes, projects, claudeWorld] = await Promise.all([
          detectRuntimes(),
          listProjects(),
          discoverClaude(),
        ]);
        setRuntimes(runtimes);
        setProjects(projects);
        setClaudeDiscovery(claudeWorld);

        /* Run memory relevance decay on startup — fades old unused memories */
        decayMemories().catch((error: unknown) => {
          console.error("Memory decay failed:", error);
        });
      } catch (error) {
        console.error("Initialization failed:", error);
      } finally {
        setLoaded();
      }
    }

    void initialize();
    // Run once on mount — store setters are stable references
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

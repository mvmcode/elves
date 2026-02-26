/* App initialization hook — detects runtimes and loads projects on first mount. */

import { useEffect } from "react";
import { useAppStore } from "@/stores/app";
import { useProjectStore } from "@/stores/project";
import { detectRuntimes, listProjects } from "@/lib/tauri";

/**
 * Runs once on app mount to detect runtimes and load projects from the database.
 * Sets loading state while initialization is in progress.
 */
export function useInitialize(): void {
  const setRuntimes = useAppStore((s) => s.setRuntimes);
  const setLoaded = useAppStore((s) => s.setLoaded);
  const setProjects = useProjectStore((s) => s.setProjects);

  useEffect(() => {
    async function initialize(): Promise<void> {
      try {
        const [runtimes, projects] = await Promise.all([
          detectRuntimes(),
          listProjects(),
        ]);
        setRuntimes(runtimes);
        setProjects(projects);
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

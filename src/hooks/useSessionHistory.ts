/* Session history hook — loads past sessions for the active project from IPC. */

import { useCallback, useEffect, useState } from "react";
import { useProjectStore } from "@/stores/project";
import { listSessions } from "@/lib/tauri";
import type { Session } from "@/types/session";

interface UseSessionHistoryResult {
  /** Past sessions for the active project, sorted by most recent first. */
  readonly sessions: readonly Session[];
  /** Whether sessions are being loaded. */
  readonly isLoading: boolean;
  /** Reload sessions from the backend. */
  readonly reload: () => Promise<void>;
}

/**
 * Loads and provides the session history for the currently active project.
 * Automatically reloads when the active project changes.
 */
export function useSessionHistory(): UseSessionHistoryResult {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [sessions, setSessions] = useState<readonly Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    if (!activeProjectId) {
      setSessions([]);
      return;
    }

    setIsLoading(true);
    try {
      const result = await listSessions(activeProjectId);
      /* Sort by most recent first */
      const sorted = [...result].sort((a, b) => b.startedAt - a.startedAt);
      setSessions(sorted);
    } catch (error) {
      console.error("Failed to load sessions:", error);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { sessions, isLoading, reload };
}

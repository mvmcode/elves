/* Insights data hook — loads aggregated usage analytics from the Rust backend. */

import { useCallback, useEffect, useState } from "react";
import { loadInsights } from "@/lib/tauri";
import type { InsightsData } from "@/types/insights";

interface UseInsightsResult {
  /** Aggregated insights data, or null while loading. */
  readonly data: InsightsData | null;
  /** Whether the data is being loaded. */
  readonly isLoading: boolean;
  /** Error message if the load failed. */
  readonly error: string | null;
  /** Reload insights data from the backend. */
  readonly reload: () => Promise<void>;
}

/**
 * Loads usage insights data on mount and provides a reload function.
 * Aggregates Claude Code telemetry files and ELVES session DB data.
 */
export function useInsights(): UseInsightsResult {
  const [data, setData] = useState<InsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await loadInsights();
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to load insights:", message);
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, isLoading, error, reload };
}

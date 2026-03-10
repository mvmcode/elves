/* MCP actions hook — connects McpManager to Tauri IPC for server management. */

import { useCallback, useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useMcpStore } from "@/stores/mcp";
import type { SearchPhase } from "@/stores/mcp";
import {
  listMcpServers,
  addMcpServer as invokeAddMcpServer,
  toggleMcpServer as invokeToggleMcpServer,
  healthCheckMcp as invokeHealthCheck,
  importMcpFromClaude as invokeImportMcp,
  deleteMcpServer as invokeDeleteMcpServer,
  searchMcpServers as invokeSearchMcp,
  loadMcpCatalog as invokeLoadCatalog,
} from "@/lib/tauri";
import type { McpSearchResult } from "@/types/search";
import type { McpImportResult } from "@/types/mcp";

/** Payload shape emitted by the Rust backend for search progress. */
interface SearchProgressPayload {
  readonly searchId: string;
  readonly phase: string;
  readonly resultCount?: number;
  readonly error?: string;
}

/**
 * Provides IPC-connected callbacks for the McpManager.
 * Handles loading, adding, toggling, health checks, importing, searching, and deleting MCP servers.
 * Automatically loads servers on mount.
 */
export function useMcpActions(): {
  loadServers: () => Promise<void>;
  handleAddServer: (name: string, command: string, args?: string, env?: string, scope?: string) => Promise<void>;
  handleToggleServer: (id: string, enabled: boolean) => void;
  handleHealthCheck: (id: string) => Promise<boolean>;
  handleImportFromClaude: () => Promise<McpImportResult>;
  handleDeleteServer: (id: string) => void;
  handleSearch: (query: string) => Promise<void>;
  handleInstallFromSearch: (result: McpSearchResult) => Promise<void>;
  handleLoadCatalog: () => Promise<void>;
} {
  const setServers = useMcpStore((s) => s.setServers);
  const addServer = useMcpStore((s) => s.addServer);
  const updateServer = useMcpStore((s) => s.updateServer);
  const removeServer = useMcpStore((s) => s.removeServer);
  const setLoading = useMcpStore((s) => s.setLoading);
  const setSearchResults = useMcpStore((s) => s.setSearchResults);
  const setSearching = useMcpStore((s) => s.setSearching);
  const setSearchPhase = useMcpStore((s) => s.setSearchPhase);
  const setSearchError = useMcpStore((s) => s.setSearchError);
  const setCatalogItems = useMcpStore((s) => s.setCatalogItems);

  /** Fetch all MCP servers from the backend. */
  const loadServers = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const servers = await listMcpServers();
      setServers(servers);
    } catch (error) {
      console.error("Failed to load MCP servers:", error);
    } finally {
      setLoading(false);
    }
  }, [setServers, setLoading]);

  /** Load servers on mount. */
  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  /** Add a new MCP server configuration. */
  const handleAddServer = useCallback(
    async (name: string, command: string, args?: string, env?: string, scope?: string): Promise<void> => {
      try {
        const server = await invokeAddMcpServer(name, command, args, env, scope);
        addServer(server);
      } catch (error) {
        console.error("Failed to add MCP server:", error);
      }
    },
    [addServer],
  );

  /** Toggle a server enabled/disabled. */
  const handleToggleServer = useCallback(
    (id: string, enabled: boolean): void => {
      void (async () => {
        try {
          await invokeToggleMcpServer(id, enabled);
          const servers = useMcpStore.getState().servers;
          const existing = servers.find((s) => s.id === id);
          if (existing) {
            updateServer(id, { ...existing, enabled });
          }
        } catch (error) {
          console.error("Failed to toggle MCP server:", error);
        }
      })();
    },
    [updateServer],
  );

  /** Run a health check on a server. Returns true if healthy. */
  const handleHealthCheck = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const healthy = await invokeHealthCheck(id);
        const servers = useMcpStore.getState().servers;
        const existing = servers.find((s) => s.id === id);
        if (existing) {
          updateServer(id, { ...existing, lastHealthCheck: Date.now() });
        }
        return healthy;
      } catch (error) {
        console.error("Failed health check:", error);
        return false;
      }
    },
    [updateServer],
  );

  /** Import MCP servers from Claude Code config. Returns import result with count and files scanned. */
  const handleImportFromClaude = useCallback(async (): Promise<McpImportResult> => {
    try {
      const result = await invokeImportMcp();
      if (result.imported > 0) {
        await loadServers();
      }
      return result;
    } catch (error) {
      console.error("Failed to import MCP servers:", error);
      return { imported: 0, scanned: 0 };
    }
  }, [loadServers]);

  /** Delete an MCP server. */
  const handleDeleteServer = useCallback(
    (id: string): void => {
      void (async () => {
        try {
          await invokeDeleteMcpServer(id);
          removeServer(id);
        } catch (error) {
          console.error("Failed to delete MCP server:", error);
        }
      })();
    },
    [removeServer],
  );

  /** Search for MCP servers via Claude CLI with progress event listening. */
  const handleSearch = useCallback(
    async (query: string): Promise<void> => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      setSearchError(null);
      setSearchPhase("fetching");

      let unlisten: UnlistenFn | null = null;
      try {
        unlisten = await listen<SearchProgressPayload>("search:progress", (event) => {
          const phase = event.payload.phase as SearchPhase;
          setSearchPhase(phase);
        });

        const results = await invokeSearchMcp(query);
        setSearchResults(results);
      } catch (error) {
        console.error("MCP search failed:", error);
        const message = error instanceof Error ? error.message : String(error);
        setSearchError(message);
        setSearchResults([]);
      } finally {
        if (unlisten) unlisten();
        setSearching(false);
        setSearchPhase(null);
      }
    },
    [setSearchResults, setSearching, setSearchPhase, setSearchError],
  );

  /** Install an MCP server from a search result by adding it to the database. */
  const handleInstallFromSearch = useCallback(
    async (result: McpSearchResult): Promise<void> => {
      const argsJson = result.args.length > 0 ? JSON.stringify(result.args) : undefined;
      const envJson = result.env ? JSON.stringify(result.env) : undefined;
      await handleAddServer(result.name, result.command, argsJson, envJson);
    },
    [handleAddServer],
  );

  /** Load the curated MCP catalog from the backend. */
  const handleLoadCatalog = useCallback(async (): Promise<void> => {
    try {
      const items = await invokeLoadCatalog();
      setCatalogItems(items);
    } catch (error) {
      console.error("Failed to load MCP catalog:", error);
    }
  }, [setCatalogItems]);

  return {
    loadServers,
    handleAddServer,
    handleToggleServer,
    handleHealthCheck,
    handleImportFromClaude,
    handleDeleteServer,
    handleSearch,
    handleInstallFromSearch,
    handleLoadCatalog,
  };
}

/* MCP actions hook — connects McpManager to Tauri IPC for server management. */

import { useCallback, useEffect } from "react";
import { useMcpStore } from "@/stores/mcp";
import {
  listMcpServers,
  addMcpServer as invokeAddMcpServer,
  toggleMcpServer as invokeToggleMcpServer,
  healthCheckMcp as invokeHealthCheck,
  importMcpFromClaude as invokeImportMcp,
  deleteMcpServer as invokeDeleteMcpServer,
} from "@/lib/tauri";

/**
 * Provides IPC-connected callbacks for the McpManager.
 * Handles loading, adding, toggling, health checks, importing, and deleting MCP servers.
 * Automatically loads servers on mount.
 */
export function useMcpActions(): {
  loadServers: () => Promise<void>;
  handleAddServer: (name: string, command: string, args?: string, env?: string, scope?: string) => Promise<void>;
  handleToggleServer: (id: string, enabled: boolean) => void;
  handleHealthCheck: (id: string) => Promise<boolean>;
  handleImportFromClaude: () => Promise<number>;
  handleDeleteServer: (id: string) => void;
} {
  const setServers = useMcpStore((s) => s.setServers);
  const addServer = useMcpStore((s) => s.addServer);
  const updateServer = useMcpStore((s) => s.updateServer);
  const removeServer = useMcpStore((s) => s.removeServer);
  const setLoading = useMcpStore((s) => s.setLoading);

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

  /** Import MCP servers from Claude Code config. Returns count imported. */
  const handleImportFromClaude = useCallback(async (): Promise<number> => {
    try {
      const count = await invokeImportMcp();
      if (count > 0) {
        await loadServers();
      }
      return count;
    } catch (error) {
      console.error("Failed to import MCP servers:", error);
      return 0;
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

  return {
    loadServers,
    handleAddServer,
    handleToggleServer,
    handleHealthCheck,
    handleImportFromClaude,
    handleDeleteServer,
  };
}

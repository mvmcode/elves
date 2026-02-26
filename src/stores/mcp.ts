/* MCP store — client-side state for MCP server management UI. */

import { create } from "zustand";
import type { McpServer } from "@/types/mcp";

interface McpState {
  /** All configured MCP servers */
  readonly servers: readonly McpServer[];
  /** Whether servers are being loaded */
  readonly isLoading: boolean;

  /** Replace the full server list */
  setServers: (servers: readonly McpServer[]) => void;
  /** Add a newly configured server */
  addServer: (server: McpServer) => void;
  /** Update an existing server by ID */
  updateServer: (id: string, updated: McpServer) => void;
  /** Remove a server by ID */
  removeServer: (id: string) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
}

export const useMcpStore = create<McpState>((set) => ({
  servers: [],
  isLoading: false,

  setServers: (servers: readonly McpServer[]) => set({ servers }),

  addServer: (server: McpServer) =>
    set((state) => ({ servers: [...state.servers, server] })),

  updateServer: (id: string, updated: McpServer) =>
    set((state) => ({
      servers: state.servers.map((s) => (s.id === id ? updated : s)),
    })),

  removeServer: (id: string) =>
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== id),
    })),

  setLoading: (isLoading: boolean) => set({ isLoading }),
}));

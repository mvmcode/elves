/* MCP store — client-side state for MCP server management UI. */

import { create } from "zustand";
import type { McpServer, McpCatalogItem } from "@/types/mcp";
import type { McpSearchResult } from "@/types/search";

/** Search phases emitted by the Rust backend during a registry search. */
export type SearchPhase = "fetching" | "done" | "error" | null;

interface McpState {
  /** All configured MCP servers */
  readonly servers: readonly McpServer[];
  /** Whether servers are being loaded */
  readonly isLoading: boolean;
  /** Current search query */
  readonly searchQuery: string;
  /** Search results from Claude-powered search */
  readonly searchResults: readonly McpSearchResult[];
  /** Whether a search is in progress */
  readonly isSearching: boolean;
  /** Current search phase for progress feedback */
  readonly searchPhase: SearchPhase;
  /** Error message from a failed search */
  readonly searchError: string | null;
  /** Curated MCP catalog items loaded from the backend */
  readonly catalogItems: readonly McpCatalogItem[];
  /** Current search query for catalog filtering */
  readonly catalogSearchQuery: string;
  /** Active category filter for catalog view */
  readonly catalogCategoryFilter: string | null;

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
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Set search results */
  setSearchResults: (results: readonly McpSearchResult[]) => void;
  /** Set searching state */
  setSearching: (searching: boolean) => void;
  /** Set the current search phase */
  setSearchPhase: (phase: SearchPhase) => void;
  /** Set or clear the search error message */
  setSearchError: (error: string | null) => void;
  /** Reset all search state — query, results, error, phase */
  clearSearch: () => void;
  /** Set catalog items from the backend */
  setCatalogItems: (items: readonly McpCatalogItem[]) => void;
  /** Set catalog search query for local filtering */
  setCatalogSearchQuery: (query: string) => void;
  /** Set or clear the active catalog category filter */
  setCatalogCategoryFilter: (category: string | null) => void;
}

export const useMcpStore = create<McpState>((set) => ({
  servers: [],
  isLoading: false,
  searchQuery: "",
  searchResults: [],
  isSearching: false,
  searchPhase: null,
  searchError: null,
  catalogItems: [],
  catalogSearchQuery: "",
  catalogCategoryFilter: null,

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
  setSearchQuery: (searchQuery: string) => set({ searchQuery }),
  setSearchResults: (searchResults: readonly McpSearchResult[]) => set({ searchResults }),
  setSearching: (isSearching: boolean) => set({ isSearching }),
  setSearchPhase: (searchPhase: SearchPhase) => set({ searchPhase }),
  setSearchError: (searchError: string | null) => set({ searchError }),
  clearSearch: () =>
    set({
      searchQuery: "",
      searchResults: [],
      searchError: null,
      searchPhase: null,
      isSearching: false,
    }),
  setCatalogItems: (catalogItems: readonly McpCatalogItem[]) => set({ catalogItems }),
  setCatalogSearchQuery: (catalogSearchQuery: string) => set({ catalogSearchQuery }),
  setCatalogCategoryFilter: (catalogCategoryFilter: string | null) => set({ catalogCategoryFilter }),
}));

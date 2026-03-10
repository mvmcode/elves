/* McpManager — two-tab MCP management view: My Servers + Catalog. */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useMcpStore } from "@/stores/mcp";
import { useMcpActions } from "@/hooks/useMcpActions";
import type { SearchPhase } from "@/stores/mcp";
import { useAppStore } from "@/stores/app";
import { getRuntimeControlConfig } from "@/lib/runtime-controls";
import { listMcpTools, type McpTool } from "@/lib/tauri";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { getEmptyState } from "@/lib/funny-copy";
import { McpCatalog } from "./McpCatalog";
import type { McpServer } from "@/types/mcp";
import type { McpSearchResult } from "@/types/search";

type McpTab = "my-servers" | "catalog";

/**
 * Top-level MCP management container with two tabs:
 * - "My Servers": existing server grid with add form, import, and search
 * - "Catalog": curated MCP server catalog with instant filtering and npm fallback
 */
export function McpManager(): React.JSX.Element {
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);
  const controlConfig = getRuntimeControlConfig(defaultRuntime);

  const [activeTab, setActiveTab] = useState<McpTab>("my-servers");

  if (!controlConfig.supportsMcp) {
    return (
      <div className="flex flex-1 items-center justify-center p-8" data-testid="mcp-manager-unsupported">
        <EmptyState
          message="MCP for Codex — Coming Soon"
          submessage="Codex now supports MCP servers, and ELVES integration is on the way. Switch to Claude Code to use MCP now."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col" data-testid="mcp-manager">
      {/* Tab bar */}
      <div className="flex border-b-token-normal border-border">
        {(["my-servers", "catalog"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const label = tab === "my-servers" ? "My Servers" : "Catalog";
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "cursor-pointer px-6 py-3 font-display text-sm font-bold uppercase tracking-wide",
                "border-[2px] border-border border-b-[3px] transition-all duration-100",
                isActive
                  ? "bg-accent text-black border-b-accent shadow-brutal-sm"
                  : "bg-surface-elevated text-text-light hover:bg-accent-light border-b-transparent",
              ].join(" ")}
              data-testid={`mcp-tab-${tab}`}
            >
              {label}
            </button>
          );
        })}
        <div className="flex-1 border-b-[3px] border-b-transparent" />
      </div>

      {/* Tab content */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === "my-servers" ? <MyServersTab /> : <McpCatalog />}
      </div>
    </div>
  );
}

/** My Servers tab — card grid with add form, import, search, and server management. */
function MyServersTab(): React.JSX.Element {
  const servers = useMcpStore((s) => s.servers);
  const isLoading = useMcpStore((s) => s.isLoading);
  const searchQuery = useMcpStore((s) => s.searchQuery);
  const searchResults = useMcpStore((s) => s.searchResults);
  const isSearching = useMcpStore((s) => s.isSearching);
  const searchPhase = useMcpStore((s) => s.searchPhase);
  const searchError = useMcpStore((s) => s.searchError);
  const setSearchQuery = useMcpStore((s) => s.setSearchQuery);
  const setSearchError = useMcpStore((s) => s.setSearchError);
  const clearSearch = useMcpStore((s) => s.clearSearch);

  const {
    handleAddServer,
    handleToggleServer,
    handleHealthCheck,
    handleImportFromClaude,
    handleDeleteServer,
    handleSearch,
    handleInstallFromSearch,
  } = useMcpActions();

  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCommand, setAddCommand] = useState("");
  const [addArgs, setAddArgs] = useState("");
  const [addEnv, setAddEnv] = useState("");
  const [healthStatus, setHealthStatus] = useState<Record<string, boolean | null>>({});
  const [toolsData, setToolsData] = useState<Record<string, McpTool[]>>({});
  const [toolsExpanded, setToolsExpanded] = useState<Record<string, boolean>>({});
  const [toolsLoading, setToolsLoading] = useState<Record<string, boolean>>({});
  const [searchElapsed, setSearchElapsed] = useState(0);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Derive installed names from actual server list. */
  const installedNames = useMemo(() => {
    const names = new Set<string>();
    for (const server of servers) {
      names.add(server.name);
      names.add(server.command);
    }
    return names;
  }, [servers]);

  /** Clear search state on unmount. */
  useEffect(() => {
    return () => {
      clearSearch();
    };
  }, [clearSearch]);

  /** Track elapsed seconds while searching. */
  useEffect(() => {
    if (isSearching) {
      setSearchElapsed(0);
      searchTimerRef.current = setInterval(() => {
        setSearchElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (searchTimerRef.current) {
        clearInterval(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      setSearchElapsed(0);
    }
    return () => {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    };
  }, [isSearching]);

  const handleSubmitAdd = useCallback((): void => {
    if (!addName.trim() || !addCommand.trim()) return;
    void handleAddServer(
      addName.trim(),
      addCommand.trim(),
      addArgs.trim() || undefined,
      addEnv.trim() || undefined,
    );
    setAddName("");
    setAddCommand("");
    setAddArgs("");
    setAddEnv("");
    setIsAddFormOpen(false);
  }, [addName, addCommand, addArgs, addEnv, handleAddServer]);

  const handleRunHealthCheck = useCallback(
    (server: McpServer): void => {
      setHealthStatus((prev) => ({ ...prev, [server.id]: null }));
      void (async () => {
        const healthy = await handleHealthCheck(server.id);
        setHealthStatus((prev) => ({ ...prev, [server.id]: healthy }));
      })();
    },
    [handleHealthCheck],
  );

  const handleShowTools = useCallback((server: McpServer): void => {
    if (toolsData[server.id] !== undefined) {
      setToolsExpanded((prev) => ({ ...prev, [server.id]: !prev[server.id] }));
      return;
    }
    setToolsLoading((prev) => ({ ...prev, [server.id]: true }));
    void listMcpTools(server.id)
      .then((tools) => {
        setToolsData((prev) => ({ ...prev, [server.id]: tools }));
        setToolsExpanded((prev) => ({ ...prev, [server.id]: true }));
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setToolsData((prev) => ({ ...prev, [server.id]: [] }));
        setToolsExpanded((prev) => ({ ...prev, [server.id]: true }));
        console.error(`Failed to list tools for ${server.name}:`, message);
      })
      .finally(() => {
        setToolsLoading((prev) => ({ ...prev, [server.id]: false }));
      });
  }, [toolsData]);

  const handleImport = useCallback((): void => {
    setImportFeedback(null);
    void (async () => {
      const result = await handleImportFromClaude();
      if (result.imported > 0) {
        setImportFeedback(`Imported ${result.imported} server${result.imported === 1 ? "" : "s"}`);
      } else {
        setImportFeedback(`No new servers found (scanned ${result.scanned} file${result.scanned === 1 ? "" : "s"})`);
      }
    })();
  }, [handleImportFromClaude]);

  const handleSearchSubmit = useCallback((): void => {
    void handleSearch(searchQuery);
  }, [searchQuery, handleSearch]);

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      if (event.key === "Enter") {
        void handleSearch(searchQuery);
      }
      if (event.key === "Escape") {
        clearSearch();
      }
    },
    [searchQuery, handleSearch, clearSearch],
  );

  const handleInstallResult = useCallback(
    (result: McpSearchResult): void => {
      void handleInstallFromSearch(result);
    },
    [handleInstallFromSearch],
  );

  const isResultInstalled = useCallback(
    (result: McpSearchResult): boolean => {
      return installedNames.has(result.name) || installedNames.has(result.command);
    },
    [installedNames],
  );

  const hasSearchContent = searchResults.length > 0 || searchError !== null;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="font-display text-xl font-bold text-text-light/40">Loading MCP servers...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl text-heading tracking-tight">
          MCP Servers
        </h2>
        <div className="flex gap-2">
          <Button variant="secondary" className="text-xs" onClick={handleImport}>
            Import from Claude
          </Button>
          <Button variant="primary" className="text-xs" onClick={() => setIsAddFormOpen(!isAddFormOpen)}>
            + Add Server
          </Button>
        </div>
      </div>

      {/* Import feedback banner */}
      {importFeedback && (
        <div
          className="mb-4 flex items-center justify-between border-token-normal border-border bg-accent-light rounded-token-md px-4 py-3"
          data-testid="mcp-import-feedback"
        >
          <span className="font-body text-sm font-bold">{importFeedback}</span>
          <button
            onClick={() => setImportFeedback(null)}
            className="font-body text-xs font-bold text-text-light/60 hover:text-text-light"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="mb-4 flex gap-2" data-testid="mcp-search">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full border-token-normal border-border bg-surface-elevated rounded-token-md px-3 py-2 pr-8 font-body text-sm outline-none focus:focus-ring"
            placeholder="Search MCP servers (e.g., github, filesystem, database)..."
            disabled={isSearching}
            data-testid="mcp-search-input"
          />
          {(searchQuery || hasSearchContent) && !isSearching && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 font-body text-lg text-text-light/40 hover:text-text-light"
              title="Clear search"
            >
              x
            </button>
          )}
        </div>
        {isSearching ? (
          <Button
            variant="danger"
            className="px-4 text-sm"
            onClick={() => {
              useMcpStore.getState().setSearching(false);
              useMcpStore.getState().setSearchPhase(null);
            }}
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="primary"
            className="px-4 text-sm"
            onClick={handleSearchSubmit}
            disabled={!searchQuery.trim()}
          >
            Search
          </Button>
        )}
      </div>

      {/* Search progress indicator */}
      {isSearching && (
        <div className="mb-4 flex items-center gap-3 border-token-normal border-border bg-accent-light rounded-token-md px-4 py-3" data-testid="mcp-search-progress">
          <span className="inline-block h-3 w-3 animate-pulse border-token-thin border-border bg-accent" />
          <span className="font-body text-sm font-bold">
            {getSearchPhaseLabel(searchPhase)}
          </span>
          <span className="font-mono text-xs text-text-light/60">({searchElapsed}s)</span>
        </div>
      )}

      {/* Search error banner */}
      {searchError && !isSearching && (
        <div className="mb-4 flex items-center justify-between border-token-normal border-border bg-error/10 rounded-token-md px-4 py-3" data-testid="mcp-search-error">
          <span className="font-body text-sm font-bold text-error">{searchError}</span>
          <button
            onClick={() => setSearchError(null)}
            className="font-body text-xs font-bold text-error hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="mb-4" data-testid="mcp-search-results">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg text-heading">
              Search Results
              <span className="ml-2 font-body text-sm text-text-light/50">({searchResults.length})</span>
            </h3>
            <Button variant="secondary" className="px-3 py-1 text-xs" onClick={clearSearch}>
              Close Results
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {searchResults.map((result) => {
              const installed = isResultInstalled(result);
              return (
                <div
                  key={`${result.name}-${result.command}`}
                  className={[
                    "border-token-normal border-border bg-surface-elevated rounded-token-md p-4 shadow-brutal",
                    installed ? "opacity-60" : "",
                  ].join(" ")}
                  data-testid="mcp-search-result-card"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <h4 className="font-display text-base font-bold text-heading truncate" title={result.name}>{result.name}</h4>
                    {result.author && (
                      <Badge variant="default">{result.author}</Badge>
                    )}
                  </div>
                  <p className="mb-2 font-body text-xs text-text-light/70 line-clamp-2">{result.description}</p>
                  <p className="mb-1 truncate font-mono text-xs text-text-light/50" title={result.command}>{result.command}</p>
                  {result.sourceUrl && (
                    <a
                      href={result.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-2 block truncate font-body text-xs text-info hover:underline"
                    >
                      {result.sourceUrl}
                    </a>
                  )}
                  <Button
                    variant={installed ? "secondary" : "primary"}
                    className="mt-2 w-full text-xs"
                    onClick={() => handleInstallResult(result)}
                    disabled={installed}
                  >
                    {installed ? "Installed" : "Install"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add server form */}
      {isAddFormOpen && (
        <div
          className="mb-4 border-token-normal border-border bg-surface-elevated rounded-token-md p-4 shadow-brutal"
          data-testid="mcp-add-form"
        >
          <h3 className="mb-3 font-display text-lg text-heading">Add MCP Server</h3>
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={addName}
              onChange={(event) => setAddName(event.target.value)}
              className="border-token-normal border-border bg-surface-elevated rounded-token-md px-3 py-2 font-body text-sm outline-none focus:focus-ring"
              placeholder="Server name"
              data-testid="mcp-add-name"
            />
            <input
              type="text"
              value={addCommand}
              onChange={(event) => setAddCommand(event.target.value)}
              className="border-token-normal border-border bg-surface-elevated rounded-token-md px-3 py-2 font-mono text-sm outline-none focus:focus-ring"
              placeholder="Command (e.g., npx -y @modelcontextprotocol/server-github)"
              data-testid="mcp-add-command"
            />
            <input
              type="text"
              value={addArgs}
              onChange={(event) => setAddArgs(event.target.value)}
              className="border-token-normal border-border/60 bg-surface-elevated rounded-token-md px-3 py-2 font-mono text-sm outline-none focus:border-border focus:focus-ring"
              placeholder="Args (optional, comma-separated)"
              data-testid="mcp-add-args"
            />
            <input
              type="text"
              value={addEnv}
              onChange={(event) => setAddEnv(event.target.value)}
              className="border-token-normal border-border/60 bg-surface-elevated rounded-token-md px-3 py-2 font-mono text-sm outline-none focus:border-border focus:focus-ring"
              placeholder="Env vars (optional, KEY=VALUE,KEY2=VALUE2)"
              data-testid="mcp-add-env"
            />
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleSubmitAdd}>
                Add
              </Button>
              <Button variant="secondary" onClick={() => setIsAddFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Server card grid */}
      {servers.length === 0 ? (
        <div data-testid="mcp-empty">
          {(() => {
            const empty = getEmptyState("no-mcp");
            return <EmptyState message={`${empty.emoji} ${empty.title}`} submessage={empty.subtitle} />;
          })()}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => {
            const health = healthStatus[server.id];
            return (
              <div
                key={server.id}
                className={[
                  "border-token-normal border-border bg-surface-elevated rounded-token-md p-4 shadow-brutal-lg transition-all duration-100",
                  server.enabled ? "" : "opacity-60",
                ].join(" ")}
                data-testid="mcp-server-card"
              >
                {/* Card header */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 border-token-thin border-border"
                      style={{
                        backgroundColor: !server.enabled
                          ? "#9CA3AF"
                          : health === true
                            ? "#6BCB77"
                            : health === false
                              ? "#FF6B6B"
                              : "#FFD93D",
                      }}
                      data-testid="mcp-status-dot"
                    />
                    <h3 className="font-display text-base text-heading">{server.name}</h3>
                  </div>
                  <Badge variant={server.scope === "global" ? "info" : "default"}>
                    {server.scope}
                  </Badge>
                </div>

                {/* Command */}
                <p className="mb-3 truncate font-mono text-xs text-text-light/60">
                  {server.command} {server.args}
                </p>

                {/* Toggle + actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleServer(server.id, !server.enabled)}
                    className={[
                      "relative h-6 w-11 cursor-pointer rounded-token-sm border-token-thin border-border transition-colors duration-100",
                      server.enabled ? "bg-success" : "bg-surface-muted",
                    ].join(" ")}
                    data-testid="mcp-toggle"
                    role="switch"
                    aria-checked={server.enabled}
                  >
                    <span
                      className="absolute top-0.5 h-4 w-4 border-[1px] border-border bg-white transition-transform duration-100"
                      style={{ left: server.enabled ? "20px" : "2px" }}
                    />
                  </button>

                  <Button
                    variant="secondary"
                    className="px-2 py-1 text-xs"
                    onClick={() => handleRunHealthCheck(server)}
                  >
                    Check
                  </Button>

                  <Button
                    variant="secondary"
                    className="px-2 py-1 text-xs"
                    onClick={() => handleShowTools(server)}
                    data-testid="mcp-show-tools"
                  >
                    {toolsLoading[server.id]
                      ? "..."
                      : toolsExpanded[server.id]
                        ? "Hide Tools"
                        : "Show Tools"}
                  </Button>

                  <Button
                    variant="danger"
                    className="ml-auto px-2 py-1 text-xs"
                    onClick={() => handleDeleteServer(server.id)}
                  >
                    x
                  </Button>
                </div>

                {/* Expandable tools list */}
                {(() => {
                  const serverTools = toolsData[server.id];
                  if (!toolsExpanded[server.id] || serverTools === undefined) return null;
                  return (
                    <div className="mt-3 border-t border-border pt-3" data-testid="mcp-tools-list">
                      {serverTools.length === 0 ? (
                        <p className="font-body text-xs text-text-light/50">No tools reported.</p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {serverTools.map((tool) => (
                            <li key={tool.name} className="flex flex-col">
                              <span className="font-mono text-xs font-bold text-heading">{tool.name}</span>
                              {tool.description && (
                                <span className="font-body text-xs text-text-light/60">{tool.description}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Map a search phase to a user-friendly label. */
function getSearchPhaseLabel(phase: SearchPhase): string {
  switch (phase) {
    case "fetching":
      return "Searching npm registry...";
    case "done":
      return "Done";
    case "error":
      return "Search failed";
    default:
      return "Searching...";
  }
}

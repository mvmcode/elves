/* McpManager — neo-brutalist card grid for managing MCP server configurations. */

import { useState, useCallback } from "react";
import { useMcpStore } from "@/stores/mcp";
import { useMcpActions } from "@/hooks/useMcpActions";
import { Button } from "@/components/shared/Button";
import { Badge } from "@/components/shared/Badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { getEmptyState } from "@/lib/funny-copy";
import type { McpServer } from "@/types/mcp";

/**
 * MCP server manager with a card grid and add server form.
 * Each card shows server name, command, status indicator, toggle switch, and actions.
 */
export function McpManager(): React.JSX.Element {
  const servers = useMcpStore((s) => s.servers);
  const isLoading = useMcpStore((s) => s.isLoading);
  const {
    handleAddServer,
    handleToggleServer,
    handleHealthCheck,
    handleImportFromClaude,
    handleDeleteServer,
  } = useMcpActions();

  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCommand, setAddCommand] = useState("");
  const [addArgs, setAddArgs] = useState("");
  const [addEnv, setAddEnv] = useState("");
  const [healthStatus, setHealthStatus] = useState<Record<string, boolean | null>>({});

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

  const handleImport = useCallback((): void => {
    void handleImportFromClaude();
  }, [handleImportFromClaude]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="font-display text-xl font-bold text-text-light/40">Loading MCP servers...</p>
      </div>
    );
  }

  return (
    <div className="p-4" data-testid="mcp-manager">
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
                    {/* Status dot */}
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
                  {/* Toggle switch */}
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
                    variant="danger"
                    className="ml-auto px-2 py-1 text-xs"
                    onClick={() => handleDeleteServer(server.id)}
                  >
                    ×
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

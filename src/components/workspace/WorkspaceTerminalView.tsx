/* WorkspaceTerminalView — full-width terminal view for an open workspace.
 * Shows header with back navigation, runtime badge, diff summary, and a live XTerminal.
 * PTY events are wired via the pty:data:{ptyId} listener pattern. */

import { useCallback, useRef, useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { XTerminal } from "@/components/terminal/XTerminal";
import type { XTerminalHandle } from "@/components/terminal/XTerminal";
import { PermissionPopup } from "@/components/session/PermissionPopup";
import { useWorkspaceStore } from "@/stores/workspace";
import { useSessionStore } from "@/stores/session";
import { useProjectStore } from "@/stores/project";
import { SplitTerminalView } from "./SplitTerminalView";
import { PtyAgentDetector } from "@/lib/pty-agent-detector";
import type { DetectedAgent, DetectedPermission } from "@/lib/pty-agent-detector";
import { generateElf } from "@/lib/elf-names";
import { playSound } from "@/lib/sounds";
import { removeWorkspace as invokeRemoveWorkspace, completeSession, updateClaudeSessionId } from "@/lib/tauri";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { WorkspaceInfo } from "@/types/workspace";

/** Tauri IPC: write data to PTY stdin. */
async function writePty(ptyId: string, data: string): Promise<void> {
  await invoke<void>("write_pty", { ptyId, data });
}

/** Tauri IPC: resize the PTY. */
async function resizePty(ptyId: string, cols: number, rows: number): Promise<void> {
  await invoke<void>("resize_pty", { ptyId, cols, rows });
}

interface WorkspaceTerminalViewProps {
  /** The workspace currently being viewed. */
  readonly workspace: WorkspaceInfo;
}

/**
 * Full-width terminal view for an active workspace.
 * Header: back link, workspace slug, elf name, runtime badge, diff summary.
 * Body: XTerminal wired to the workspace's PTY.
 * Footer: STOP, SHIP IT buttons, branch name.
 *
 * When a workspace has no PTY (opened without deploying), auto-spawns an
 * interactive Claude session in the workspace directory so the user always
 * gets a working terminal.
 */
export function WorkspaceTerminalView({ workspace }: WorkspaceTerminalViewProps): React.JSX.Element {
  const teamEntries = useWorkspaceStore((s) => s.teamPtyEntries[workspace.slug]);
  const ptyId = useWorkspaceStore((s) => s.ptyIds[workspace.slug] ?? null);

  /* Team mode: render split terminal grid instead of single terminal. */
  if (teamEntries && teamEntries.length > 0) {
    return <SplitTerminalView workspace={workspace} entries={teamEntries} />;
  }

  const terminalRef = useRef<XTerminalHandle>(null);
  const detectorRef = useRef<PtyAgentDetector>(new PtyAgentDetector());
  const [hasExited, setHasExited] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<DetectedPermission | null>(null);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  /** Guard against double-spawning during auto-spawn. */
  const autoSpawnAttempted = useRef(false);

  /** Auto-spawn a Claude interactive PTY when workspace has no terminal.
   * This covers the case where a workspace tab is opened on an existing worktree
   * (e.g., from the card grid or after an app restart).
   *
   * If a ptyId exists in the store, verifies it's still alive in the Rust backend.
   * Stale ptyIds (from killed processes where the exit event was missed) are cleaned
   * up, which triggers a re-run that spawns a fresh session. */
  useEffect(() => {
    if (hasExited || autoSpawnAttempted.current) return;
    if (!workspace.path) return;

    /* If a ptyId exists, verify it's still alive in the backend. If stale, remove it
     * so the next effect run (ptyId → null) triggers the spawn branch below. */
    if (ptyId) {
      invoke<boolean>("check_pty_exists", { ptyId }).then((exists) => {
        if (!exists) {
          useWorkspaceStore.getState().removePtyId(workspace.slug);
        }
      }).catch(() => {
        useWorkspaceStore.getState().removePtyId(workspace.slug);
      });
      return;
    }

    autoSpawnAttempted.current = true;

    async function autoSpawn(): Promise<void> {
      try {
        const newPtyId = await invoke<string>("spawn_pty", {
          command: "claude",
          args: [],
          cwd: workspace.path,
        });
        useWorkspaceStore.getState().setPtyId(workspace.slug, newPtyId);
        useWorkspaceStore.getState().updateWorkspaceStatus(workspace.slug, "active");
      } catch (error: unknown) {
        console.error("Failed to auto-spawn Claude session:", error);
        setSpawnError(String(error));
      }
    }

    void autoSpawn();
  }, [ptyId, hasExited, workspace.path, workspace.slug]);

  /** Handle permission response — write y/n to PTY stdin. */
  const handlePermissionResponse = useCallback((response: "y" | "n"): void => {
    if (!ptyId) return;
    writePty(ptyId, `${response}\n`).catch((error: unknown) => {
      console.error("Failed to write permission response:", error);
    });
    setPendingPermission(null);
  }, [ptyId]);

  /** PTY event listener — always active when ptyId exists. */
  useEffect(() => {
    if (!ptyId) return;
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let mounted = true;

    detectorRef.current.reset();
    setHasExited(false);

    async function setup(): Promise<void> {
      try {
        unlistenData = await listen<string>(`pty:data:${ptyId}`, (event) => {
          if (!mounted) return;
          terminalRef.current?.write(event.payload);

          const { agents, permissions, claudeSessionId } = detectorRef.current.feed(event.payload);
          for (const agent of agents) {
            handleAgentDetected(agent, workspace.slug);
          }
          for (const perm of permissions) {
            setPendingPermission(perm);
          }

          /* Save Claude session ID to DB when first detected — enables Resume in History. */
          if (claudeSessionId) {
            const sessionState = useSessionStore.getState();
            const floorId = sessionState.activeFloorId;
            if (floorId) {
              const floor = sessionState.floors[floorId];
              const dbSessionId = floor?.session?.id;
              if (dbSessionId) {
                updateClaudeSessionId(dbSessionId, claudeSessionId).catch((error: unknown) => {
                  console.error("Failed to save Claude session ID:", error);
                });
              }
            }
          }
        });

        unlistenExit = await listen<number>(`pty:exit:${ptyId}`, (event) => {
          if (!mounted) return;
          terminalRef.current?.writeln("");
          terminalRef.current?.writeln(
            `\x1b[33m--- Session ended (exit code: ${event.payload}) ---\x1b[0m`,
          );
          setHasExited(true);
          const wsStore = useWorkspaceStore.getState();
          wsStore.updateWorkspaceStatus(workspace.slug, "idle");
          /* Remove stale PTY ID so reopening the tab triggers a fresh auto-spawn
           * instead of subscribing to a dead channel (blank black screen). */
          wsStore.removePtyId(workspace.slug);

          /* Transition session store so RuntimePicker reappears in TopBar. */
          const sessionState = useSessionStore.getState();
          const floorId = sessionState.activeFloorId;
          if (floorId) {
            const floor = sessionState.floors[floorId];
            if (floor?.session?.status === "active") {
              sessionState.updateAllElfStatusOnFloor(floorId, "done");
              sessionState.endSessionOnFloor(floorId, "completed");

              /* Persist session completion to DB so History view shows correct status. */
              const dbSessionId = floor.session.id;
              if (dbSessionId) {
                const exitCode = event.payload;
                const status = exitCode === 0 ? "completed" : "failed";
                completeSession(dbSessionId, status).catch((error: unknown) => {
                  console.error("Failed to persist session completion to DB:", error);
                });
              }
            }
          }
        });
      } catch (error) {
        console.error("Failed to subscribe to PTY events:", error);
        setHasExited(true);
      }
    }

    void setup();

    return () => {
      mounted = false;
      unlistenData?.();
      unlistenExit?.();
    };
  }, [ptyId, workspace.slug]);

  /** Forward user keystrokes to PTY stdin. */
  const handleTerminalData = useCallback((data: string): void => {
    if (!ptyId) return;
    writePty(ptyId, data).catch((error: unknown) => {
      console.error("Failed to write to PTY:", error);
    });
  }, [ptyId]);

  /** Forward terminal resize to PTY. */
  const handleTerminalResize = useCallback((cols: number, rows: number): void => {
    if (!ptyId) return;
    resizePty(ptyId, cols, rows).catch((error: unknown) => {
      console.error("Failed to resize PTY:", error);
    });
  }, [ptyId]);

  /** Stop the running PTY process.
   * Immediately cleans up state — does NOT rely on the async exit event, which
   * may fire after the user closes the tab (causing a stale ptyId on reopen). */
  const handleStop = useCallback((): void => {
    if (!ptyId) return;
    invoke<void>("kill_pty", { ptyId }).catch((error: unknown) => {
      console.error("Failed to kill PTY:", error);
    });
    setHasExited(true);
    const wsStore = useWorkspaceStore.getState();
    wsStore.updateWorkspaceStatus(workspace.slug, "idle");
    wsStore.removePtyId(workspace.slug);
  }, [ptyId, workspace.slug]);

  /** Remove workspace — deletes the worktree from disk and closes the tab. */
  const handleRemoveWorkspace = useCallback((): void => {
    const projectPath = useProjectStore.getState().projects.find(
      (p) => p.id === useProjectStore.getState().activeProjectId,
    )?.path;
    if (!projectPath) return;

    invokeRemoveWorkspace(projectPath, workspace.slug, true).catch((error: unknown) => {
      console.error("Failed to remove workspace:", error);
    });
    useWorkspaceStore.getState().removeWorkspace(workspace.slug);
  }, [workspace.slug]);

  const isDirectMode = !workspace.branch;
  /** Only treat as "active" when a PTY is actually connected — avoids showing
   * STOP/LIVE controls for workspaces that are open but have no running process. */
  const isActive = workspace.status === "active" && !!ptyId;
  const diffSummary = workspace.filesChanged > 0
    ? `${workspace.filesChanged} file${workspace.filesChanged !== 1 ? "s" : ""} changed`
    : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#1A1A2E]" data-testid="workspace-terminal-view">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b-[3px] border-border bg-surface-elevated px-4 py-2.5">
        <span className="font-display text-base font-bold tracking-tight">{workspace.slug}</span>

        {workspace.elfName && (
          <span className="font-body text-sm text-text-muted">{workspace.elfName}</span>
        )}

        {workspace.runtime && (
          <span className="border-[2px] border-border bg-info px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
            {workspace.runtime}
          </span>
        )}

        {diffSummary && (
          <span className="font-mono text-xs text-text-muted">{diffSummary}</span>
        )}

        {!isDirectMode && (
          <span className="ml-auto font-mono text-xs text-text-muted">{workspace.branch}</span>
        )}
      </div>

      {/* Terminal body — keep XTerminal mounted after exit so the "session ended" message
       * remains visible. The ptyId is removed from the store on exit, but hasExited keeps
       * the terminal rendered. On tab close + reopen, both reset and auto-spawn kicks in. */}
      <div className="relative flex flex-1 overflow-hidden">
        {(ptyId || hasExited) ? (
          <div className="flex flex-1 flex-col overflow-hidden p-1">
            <XTerminal
              ref={terminalRef}
              onData={handleTerminalData}
              onResize={handleTerminalResize}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            {spawnError ? (
              <>
                <p className="font-display text-sm font-bold text-error">
                  Failed to start Claude session
                </p>
                <p className="max-w-md text-center font-mono text-xs text-gray-400">
                  {spawnError}
                </p>
                <button
                  onClick={() => {
                    setSpawnError(null);
                    autoSpawnAttempted.current = false;
                  }}
                  className="cursor-pointer border-[2px] border-border bg-info px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-white shadow-brutal-xs transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                >
                  Retry
                </button>
              </>
            ) : (
              <p className="font-mono text-sm text-gray-500">
                Starting Claude session...
              </p>
            )}
          </div>
        )}

        {/* Permission popup overlay */}
        <AnimatePresence>
          {pendingPermission && (
            <PermissionPopup
              permission={pendingPermission}
              onRespond={handlePermissionResponse}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center gap-2 border-t-[3px] border-border bg-surface-elevated px-4 py-2">
        {isActive && !hasExited ? (
          <button
            onClick={handleStop}
            className="cursor-pointer border-[2px] border-border bg-error px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-white shadow-brutal-xs transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            data-testid="workspace-stop-btn"
          >
            Stop
          </button>
        ) : null}

        {(workspace.status === "idle" || hasExited) && (
          <>
            {!isDirectMode && (
              <button
                onClick={() => {
                  /* Ship It is handled by the grid — switch to grid view where ShipItDialog lives */
                  useWorkspaceStore.getState().setActiveWorkspace(null);
                }}
                className="cursor-pointer border-[2px] border-border bg-success px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-white shadow-brutal-xs transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                data-testid="workspace-shipit-btn"
              >
                Ship It
              </button>
            )}
            <button
              onClick={isDirectMode
                ? () => useWorkspaceStore.getState().closeWorkspaceTab(workspace.slug)
                : handleRemoveWorkspace}
              className="cursor-pointer border-[2px] border-border bg-gray-600 px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-white shadow-brutal-xs transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              data-testid="workspace-remove-btn"
            >
              {isDirectMode ? "Close" : "Remove"}
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className={[
            "border-[2px] border-border/50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
            hasExited ? "bg-gray-600 text-gray-300" : isActive ? "bg-success/20 text-success" : "bg-elf-gold/20 text-elf-gold",
          ].join(" ")}>
            {hasExited ? "ENDED" : isActive ? "LIVE" : "IDLE"}
          </span>
          {!isDirectMode && (
            <span className="font-mono text-[10px] text-text-muted">{workspace.branch}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Create a new elf when an Agent tool call is detected in PTY output. */
function handleAgentDetected(agent: DetectedAgent, workspaceSlug: string): void {
  const store = useSessionStore.getState();
  const floorId = store.activeFloorId;
  if (!floorId) return;

  const floor = store.floors[floorId];
  if (!floor) return;

  const existingNames = floor.elves.map((elf) => elf.name);
  const personality = generateElf(existingNames);
  const elfId = `elf-ws-${workspaceSlug}-${agent.id}`;
  const roleName = agent.role === "Agent" ? "Worker" : agent.role;

  store.addElfToFloor(floorId, {
    id: elfId,
    sessionId: workspaceSlug,
    name: personality.name,
    role: roleName,
    avatar: personality.avatar,
    color: personality.color,
    quirk: personality.quirk,
    runtime: "claude-code",
    status: "spawning",
    spawnedAt: Date.now(),
    finishedAt: null,
    parentElfId: null,
    toolsUsed: [],
  });

  playSound("spawn");

  setTimeout(() => {
    const currentStore = useSessionStore.getState();
    const currentFloor = currentStore.floors[floorId];
    if (currentFloor?.elves.some((e) => e.id === elfId)) {
      currentStore.updateElfStatusOnFloor(floorId, elfId, "working");
    }
  }, 1500);
}

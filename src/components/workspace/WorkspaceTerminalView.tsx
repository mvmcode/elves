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
import { removeWorkspace as invokeRemoveWorkspace } from "@/lib/tauri";
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

          const { agents, permissions } = detectorRef.current.feed(event.payload);
          for (const agent of agents) {
            handleAgentDetected(agent, workspace.slug);
          }
          for (const perm of permissions) {
            setPendingPermission(perm);
          }
        });

        unlistenExit = await listen<number>(`pty:exit:${ptyId}`, (event) => {
          if (!mounted) return;
          terminalRef.current?.writeln("");
          terminalRef.current?.writeln(
            `\x1b[33m--- Session ended (exit code: ${event.payload}) ---\x1b[0m`,
          );
          setHasExited(true);
          useWorkspaceStore.getState().updateWorkspaceStatus(workspace.slug, "idle");
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

  /** Stop the running PTY process. */
  const handleStop = useCallback((): void => {
    if (!ptyId) return;
    invoke<void>("kill_pty", { ptyId }).catch((error: unknown) => {
      console.error("Failed to kill PTY:", error);
    });
  }, [ptyId]);

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
  const isActive = workspace.status === "active";
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

      {/* Terminal body */}
      <div className="relative flex flex-1 overflow-hidden">
        {ptyId ? (
          <div className="flex flex-1 flex-col overflow-hidden p-1">
            <XTerminal
              ref={terminalRef}
              onData={handleTerminalData}
              onResize={handleTerminalResize}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="font-mono text-sm text-gray-500">
              No terminal attached to this workspace.
            </p>
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

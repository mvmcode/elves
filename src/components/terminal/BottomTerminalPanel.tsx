/* BottomTerminalPanel — VS Code-style terminal panel that slides up from the bottom.
 * During active sessions: shows a read-only live event stream (LiveEventTerminal).
 * During completed/interactive sessions: spawns a PTY with `claude --resume` (SessionTerminal).
 * Does NOT auto-kill the --print process when opened. */

import { useCallback, useRef } from "react";
import { SessionTerminal } from "./SessionTerminal";
import { LiveEventTerminal } from "./LiveEventTerminal";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { generateElf, getStatusMessage } from "@/lib/elf-names";
import { playSound } from "@/lib/sounds";
import type { DetectedAgent } from "@/lib/pty-agent-detector";

/** Minimum panel height in pixels. */
const MIN_HEIGHT = 150;

/** Maximum panel height as a fraction of viewport. */
const MAX_HEIGHT_FRACTION = 0.8;

/**
 * Bottom terminal panel with resize drag handle and close button.
 *
 * Mode selection:
 * - Active --print session → LiveEventTerminal (read-only, shows live events)
 * - Interactive mode (user explicitly transitioned) → SessionTerminal (PTY)
 * - Completed session → SessionTerminal (--resume PTY for follow-up)
 */
export function BottomTerminalPanel(): React.JSX.Element | null {
  const activeSession = useSessionStore((s) => s.activeSession);
  const isInteractiveMode = useSessionStore((s) => s.isInteractiveMode);
  const terminalPanelHeight = useUiStore((s) => s.terminalPanelHeight);
  const setTerminalPanelHeight = useUiStore((s) => s.setTerminalPanelHeight);
  const toggleTerminalPanel = useUiStore((s) => s.toggleTerminalPanel);
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const sessionId = activeSession?.id;
  const claudeSessionId = activeSession?.claudeSessionId;
  const isSessionActive = activeSession?.status === "active";
  const isSessionCompleted = activeSession?.status === "completed";
  const projectPath = projects.find((p) => p.id === activeProjectId)?.path ?? "";
  const taskLabel = activeSession?.task ?? "";

  /* Determine which terminal mode to use:
   * - "live": Active --print session, show read-only event stream
   * - "interactive": PTY mode (user transitioned or session completed) */
  const terminalMode = isSessionActive && !isInteractiveMode ? "live" : "interactive";

  /* Complete session when PTY exits in interactive mode */
  const handlePtyExit = useCallback((): void => {
    if (isInteractiveMode || isSessionCompleted) {
      useSessionStore.getState().endSession("completed");
    }
  }, [isInteractiveMode, isSessionCompleted]);

  /* Track used elf names to avoid duplicates when creating elves from PTY agent detection */
  const usedNamesRef = useRef<string[]>([]);

  /* Create a new elf when an Agent tool call is detected in PTY output */
  const handleAgentDetected = useCallback((agent: DetectedAgent): void => {
    const store = useSessionStore.getState();
    const floorId = store.activeFloorId;
    if (!floorId || !sessionId) return;

    const floor = store.floors[floorId];
    if (!floor) return;

    /* Collect already-used names from existing elves + previous detections */
    const existingNames = floor.elves.map((elf) => elf.name);
    usedNamesRef.current = [...new Set([...existingNames, ...usedNamesRef.current])];

    const personality = generateElf(usedNamesRef.current);
    usedNamesRef.current.push(personality.name);

    const runtime = floor.session?.runtime ?? "claude-code";
    const elfId = `elf-pty-${sessionId}-${agent.id}`;
    const roleName = agent.role === "Agent" ? "Worker" : agent.role;

    store.addElfToFloor(floorId, {
      id: elfId,
      sessionId,
      name: personality.name,
      role: roleName,
      avatar: personality.avatar,
      color: personality.color,
      quirk: personality.quirk,
      runtime,
      status: "spawning",
      spawnedAt: Date.now(),
      finishedAt: null,
      parentElfId: floor.elves[0]?.id ?? null,
      toolsUsed: [],
    });

    store.addEventToFloor(floorId, {
      id: `event-pty-spawn-${Date.now()}-${agent.id}`,
      timestamp: Date.now(),
      elfId,
      elfName: personality.name,
      runtime,
      type: "spawn",
      payload: { role: roleName, description: agent.description },
      funnyStatus: getStatusMessage(personality.name, "spawning"),
    });

    playSound("spawn");

    /* Transition to working after brief delay */
    setTimeout(() => {
      const currentStore = useSessionStore.getState();
      const currentFloor = currentStore.floors[floorId];
      if (currentFloor?.elves.some((e) => e.id === elfId)) {
        currentStore.updateElfStatusOnFloor(floorId, elfId, "working");
      }
    }, 1500);
  }, [sessionId]);

  /* Resize drag handlers */
  const handleDragStart = useCallback(
    (event: React.MouseEvent): void => {
      event.preventDefault();
      dragRef.current = { startY: event.clientY, startHeight: terminalPanelHeight };

      const handleDragMove = (moveEvent: MouseEvent): void => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startY - moveEvent.clientY;
        const maxHeight = window.innerHeight * MAX_HEIGHT_FRACTION;
        const newHeight = Math.min(maxHeight, Math.max(MIN_HEIGHT, dragRef.current.startHeight + delta));
        setTerminalPanelHeight(newHeight);
      };

      const handleDragEnd = (): void => {
        dragRef.current = null;
        window.removeEventListener("mousemove", handleDragMove);
        window.removeEventListener("mouseup", handleDragEnd);
      };

      window.addEventListener("mousemove", handleDragMove);
      window.addEventListener("mouseup", handleDragEnd);
    },
    [terminalPanelHeight, setTerminalPanelHeight],
  );

  /* No terminal content if there's no session at all */
  if (!sessionId) {
    return (
      <div
        className="shrink-0 border-t-[3px] border-border bg-[#1A1A2E]"
        style={{ height: terminalPanelHeight }}
        data-testid="bottom-terminal-panel"
      >
        <div
          className="flex h-1.5 cursor-row-resize items-center justify-center bg-border/20 hover:bg-elf-gold/50"
          onMouseDown={handleDragStart}
          data-testid="terminal-resize-handle"
        />
        <div className="flex items-center justify-between border-b-[2px] border-border/30 px-3 py-1.5">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-gray-500">
            Terminal
          </span>
          <button
            onClick={toggleTerminalPanel}
            className="cursor-pointer border-[2px] border-border/30 bg-transparent px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-gray-400 transition-colors hover:bg-error hover:text-white"
            data-testid="terminal-panel-close"
          >
            CLOSE
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="font-mono text-sm text-gray-500">No active session</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 border-t-[3px] border-border bg-[#1A1A2E]"
      style={{ height: terminalPanelHeight }}
      data-testid="bottom-terminal-panel"
    >
      {/* Resize drag handle */}
      <div
        className="flex h-1.5 cursor-row-resize items-center justify-center bg-border/20 hover:bg-elf-gold/50"
        onMouseDown={handleDragStart}
        data-testid="terminal-resize-handle"
      />

      {/* Terminal content — live stream or interactive PTY */}
      <div className="flex h-[calc(100%-6px)] flex-col">
        {terminalMode === "live" ? (
          <LiveEventTerminal
            sessionId={sessionId}
            claudeSessionId={claudeSessionId ?? ""}
            projectPath={projectPath}
            taskLabel={taskLabel}
            onClose={toggleTerminalPanel}
          />
        ) : claudeSessionId ? (
          <SessionTerminal
            sessionId={sessionId}
            claudeSessionId={claudeSessionId}
            projectPath={projectPath}
            taskLabel={taskLabel}
            onClose={toggleTerminalPanel}
            onPtyExit={handlePtyExit}
            onAgentDetected={handleAgentDetected}
          />
        ) : (
          <div className="flex h-full flex-col border-token-normal border-border bg-[#1A1A2E]">
            <div className="flex items-center justify-between border-b-token-normal border-border bg-surface-elevated px-3 py-2">
              <span className="font-display text-xs font-bold uppercase tracking-wider text-gray-500">Terminal</span>
              <button
                onClick={toggleTerminalPanel}
                className="shrink-0 cursor-pointer border-token-thin border-border bg-surface-elevated rounded-token-sm px-2 py-0.5 font-display text-[10px] text-label transition-all duration-100 hover:bg-error hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <p className="font-mono text-sm text-gray-500">Waiting for Claude session ID...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

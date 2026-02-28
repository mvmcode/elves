/* BottomTerminalPanel — VS Code-style terminal panel that slides up from the bottom.
 * Renders between the content area and FloorBar when open. Connects to the active
 * floor's session via PTY for interactive terminal access. */

import { useCallback, useRef, useState } from "react";
import { SessionTerminal } from "./SessionTerminal";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { transitionToInteractive } from "@/lib/tauri";

/** Minimum panel height in pixels. */
const MIN_HEIGHT = 150;

/** Maximum panel height as a fraction of viewport. */
const MAX_HEIGHT_FRACTION = 0.8;

/**
 * Bottom terminal panel with resize drag handle, LIVE/ENDED badge, and close button.
 * When opened during an active --print session, transitions to interactive mode
 * by killing the print process and resuming via PTY.
 */
export function BottomTerminalPanel(): React.JSX.Element | null {
  const activeSession = useSessionStore((s) => s.activeSession);
  const isInteractiveMode = useSessionStore((s) => s.isInteractiveMode);
  const terminalPanelHeight = useUiStore((s) => s.terminalPanelHeight);
  const setTerminalPanelHeight = useUiStore((s) => s.setTerminalPanelHeight);
  const toggleTerminalPanel = useUiStore((s) => s.toggleTerminalPanel);
  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const [hasTransitioned, setHasTransitioned] = useState(false);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const sessionId = activeSession?.id;
  const claudeSessionId = activeSession?.claudeSessionId;
  const isSessionActive = activeSession?.status === "active";
  const projectPath = projects.find((p) => p.id === activeProjectId)?.path ?? "";
  const taskLabel = activeSession?.task ?? "";

  /* Transition to interactive mode when terminal opens during active session */
  const handleTransition = useCallback((): void => {
    if (isSessionActive && !hasTransitioned && !isInteractiveMode && sessionId) {
      setHasTransitioned(true);
      transitionToInteractive(sessionId).catch((error: unknown) => {
        console.error("Failed to transition to interactive:", error);
      });
    }
  }, [sessionId, isSessionActive, hasTransitioned, isInteractiveMode]);

  /* Complete session when PTY exits in interactive mode */
  const handlePtyExit = useCallback((): void => {
    if (isInteractiveMode) {
      useSessionStore.getState().endSession("completed");
    }
  }, [isInteractiveMode]);

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

  /* Auto-transition on mount if session is active */
  if (isSessionActive && !hasTransitioned && !isInteractiveMode) {
    handleTransition();
  }

  /* No terminal if there's no Claude session ID */
  if (!claudeSessionId || !sessionId) {
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

        {/* Header */}
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
          <p className="font-mono text-sm text-gray-500">
            Waiting for session to connect...
          </p>
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

      {/* Terminal content */}
      <div className="flex h-[calc(100%-6px)] flex-col">
        <SessionTerminal
          sessionId={sessionId}
          claudeSessionId={claudeSessionId}
          projectPath={projectPath}
          taskLabel={taskLabel}
          onClose={toggleTerminalPanel}
          onPtyExit={handlePtyExit}
        />
      </div>
    </div>
  );
}

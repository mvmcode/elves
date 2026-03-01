/* SessionControlCard — compact floating control card for the active floor's session.
 * Shows session status, elapsed time, stop/end buttons, and terminal toggle.
 * Replaces the right-side SidePanel as the primary session control UI. */

import { useState, useEffect, useCallback } from "react";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";
import { useStallDetection } from "@/hooks/useStallDetection";
import { useTeamSession } from "@/hooks/useTeamSession";

/** Format elapsed seconds to "M:SS" or "H:MM:SS". */
function formatElapsed(seconds: number): string {
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Compact session control card that floats at the bottom-right of the content area,
 * above the FloorBar. Only visible when the active floor has a running or completed session.
 *
 * Shows:
 * - Status indicator (pulsing dot when active)
 * - Task label / funny status
 * - Elapsed time (ticking)
 * - STOP button (kills the session)
 * - END SESSION button (marks as completed, clears floor)
 * - TERMINAL toggle (opens bottom terminal panel)
 * - Stall warning icon when events stop arriving
 */
export function SessionControlCard(): React.JSX.Element | null {
  const activeSession = useSessionStore((s) => s.activeSession);
  const elves = useSessionStore((s) => s.elves);
  const lastEventAt = useSessionStore((s) => s.lastEventAt);
  const isInteractiveMode = useSessionStore((s) => s.isInteractiveMode);
  const activeFloorId = useSessionStore((s) => s.activeFloorId);
  const clearFloorSession = useSessionStore((s) => s.clearFloorSession);
  const toggleTerminalPanel = useUiStore((s) => s.toggleTerminalPanel);
  const isTerminalPanelOpen = useUiStore((s) => s.isTerminalPanelOpen);
  const { stopSession } = useTeamSession();

  const isActive = activeSession?.status === "active";
  const isCompleted = activeSession?.status === "completed";
  const isStalled = useStallDetection(lastEventAt, isActive && !isInteractiveMode);

  /* Ticking elapsed timer */
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeSession) {
      setElapsed(0);
      return;
    }

    const updateElapsed = (): void => {
      setElapsed(Math.floor((Date.now() - activeSession.startedAt) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleStop = useCallback((): void => {
    void stopSession();
  }, [stopSession]);

  const handleEndSession = useCallback((): void => {
    if (activeFloorId) {
      clearFloorSession(activeFloorId);
    }
  }, [activeFloorId, clearFloorSession]);

  const isCancelled = activeSession?.status === "cancelled";

  /* Only show when there's a session (active, completed, or cancelled) */
  if (!activeSession || (activeSession.status !== "active" && activeSession.status !== "completed" && activeSession.status !== "cancelled")) {
    return null;
  }

  const leadElf = elves[0];
  const statusText = isCompleted
    ? "Done!"
    : isCancelled
      ? "Cancelled"
      : isInteractiveMode
        ? "Interactive mode"
        : leadElf?.status === "thinking"
          ? "Thinking..."
          : "Working...";

  return (
    <div
      className="absolute bottom-2 right-4 z-10 w-80 border-[3px] border-border bg-white shadow-brutal-sm"
      data-testid="session-control-card"
    >
      {/* Status row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Status dot */}
        <span
          className={[
            "h-2.5 w-2.5 shrink-0 rounded-full",
            isActive ? "animate-pulse bg-info" : isCancelled ? "bg-warning" : "bg-success",
          ].join(" ")}
          data-testid="control-status-dot"
        />

        {/* Status text + task label */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xs font-bold uppercase tracking-wider" data-testid="control-status-text">
            {statusText}
          </p>
          <p className="truncate font-body text-[11px] text-text-light/60" title={activeSession.task}>
            {activeSession.task}
          </p>
        </div>

        {/* Stall warning */}
        {isStalled && (
          <span className="text-warning" title="Claude may be waiting for input" data-testid="stall-warning">
            &#9888;
          </span>
        )}

        {/* Elapsed time */}
        <span className="shrink-0 font-mono text-xs font-bold text-text-light/60" data-testid="control-elapsed">
          {formatElapsed(elapsed)}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 border-t-[2px] border-border/30 px-3 py-2">
        {isActive ? (
          <button
            onClick={handleStop}
            className="cursor-pointer border-[2px] border-border bg-error px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-white shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            data-testid="control-stop-btn"
          >
            STOP
          </button>
        ) : (
          <>
            <button
              onClick={handleEndSession}
              className="cursor-pointer border-[2px] border-border bg-success/20 px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              data-testid="control-end-btn"
            >
              NEW TASK
            </button>
          </>
        )}

        <div className="flex-1" />

        <button
          onClick={toggleTerminalPanel}
          className={[
            "cursor-pointer border-[2px] border-border px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
            isTerminalPanelOpen ? "bg-elf-gold" : "bg-white",
          ].join(" ")}
          data-testid="control-terminal-btn"
          title="Toggle terminal panel (Cmd+`)"
        >
          {isTerminalPanelOpen ? "\u25BC TERMINAL" : "\u25B6 TERMINAL"}
        </button>
      </div>
    </div>
  );
}

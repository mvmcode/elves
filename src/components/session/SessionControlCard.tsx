/* SessionControlCard — compact floating control card for the active floor's session.
 * Shows session status, elapsed time, stop/end buttons, and terminal toggle.
 * Replaces the right-side SidePanel as the primary session control UI. */

import { useState, useEffect, useCallback } from "react";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";
import { useStallDetection } from "@/hooks/useStallDetection";
import { useTeamSession } from "@/hooks/useTeamSession";
import { FollowUpCard } from "./FollowUpCard";

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
  const workshopViewMode = useUiStore((s) => s.workshopViewMode);
  const toggleWorkshopViewMode = useUiStore((s) => s.toggleWorkshopViewMode);
  const isHistoricalFloor = useSessionStore(
    (s) => (s.activeFloorId ? s.floors[s.activeFloorId]?.isHistorical : false) ?? false,
  );
  const needsInput = useSessionStore((s) => s.needsInput);
  const lastResultText = useSessionStore((s) => s.lastResultText);
  const setNeedsInputOnFloor = useSessionStore((s) => s.setNeedsInputOnFloor);
  const { stopSession, continueSession } = useTeamSession();
  const [isFollowUpSubmitting, setIsFollowUpSubmitting] = useState(false);

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

  const handleFollowUpSubmit = useCallback((message: string): void => {
    setIsFollowUpSubmitting(true);
    void continueSession(message).finally(() => setIsFollowUpSubmitting(false));
  }, [continueSession]);

  const handleFollowUpDismiss = useCallback((): void => {
    if (activeFloorId) {
      setNeedsInputOnFloor(activeFloorId, false, null);
    }
  }, [activeFloorId, setNeedsInputOnFloor]);

  const isCancelled = activeSession?.status === "cancelled";

  /* Only show when there's a session (active, completed, or cancelled) */
  if (!activeSession || (activeSession.status !== "active" && activeSession.status !== "completed" && activeSession.status !== "cancelled")) {
    return null;
  }

  const leadElf = elves[0];
  const statusText = isCompleted
    ? needsInput ? "Waiting for reply..." : "Done!"
    : isCancelled
      ? "Cancelled"
      : isInteractiveMode
        ? "Interactive mode"
        : leadElf?.status === "thinking"
          ? "Thinking..."
          : "Working...";

  const permissionMode = activeSession?.appliedOptions?.permissionMode;
  const showModeBadge = permissionMode != null && permissionMode !== "default";

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

        {/* Permission mode badge */}
        {showModeBadge && (
          <span
            className={[
              "border-token-thin border-border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase",
              permissionMode === "bypassPermissions" ? "bg-error/20 text-error" :
              permissionMode === "plan" ? "bg-purple-500/20 text-purple-400" :
              permissionMode === "acceptEdits" ? "bg-elf-gold/30 text-yellow-700" :
              permissionMode === "dontAsk" ? "bg-warning/20 text-warning" :
              "bg-info/20 text-info",
            ].join(" ")}
            data-testid="mode-badge"
          >
            {permissionMode === "bypassPermissions" ? "\u26A0 YOLO" : permissionMode}
          </span>
        )}

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

        {/* View toggle — pixel art vs card view */}
        {!isHistoricalFloor && (
          <button
            onClick={toggleWorkshopViewMode}
            className={[
              "cursor-pointer border-[2px] border-border px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
              workshopViewMode === "workshop" ? "bg-purple-100" : "bg-white",
            ].join(" ")}
            data-testid="control-view-toggle"
            title={`Switch to ${workshopViewMode === "workshop" ? "card" : "pixel art"} view (Space)`}
          >
            {workshopViewMode === "workshop" ? "\u2630 CARDS" : "\u2B1A PIXEL"}
          </button>
        )}

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

      {/* Follow-up card when Claude asks a question */}
      {isCompleted && needsInput && (
        <div className="border-t-[2px] border-border/30 px-3 py-2">
          <FollowUpCard
            questionText={lastResultText}
            onSubmit={handleFollowUpSubmit}
            onDismiss={handleFollowUpDismiss}
            isSubmitting={isFollowUpSubmitting}
          />
        </div>
      )}
    </div>
  );
}

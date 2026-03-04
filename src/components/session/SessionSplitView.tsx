/* SessionSplitView — workshop-first session layout.
 * The pixel-art WorkshopCanvas fills the left area. The PTY terminal is a
 * toggleable right panel (collapse/expand). Permission requests detected
 * in PTY output appear as centered popups over the workshop. A compact
 * SessionControlPill floats at bottom-left for stop/resume/terminal toggle.
 *
 * The PTY event listener runs in the parent (always active when ptyId exists)
 * so agent detection and permission popups work even when the terminal panel
 * is collapsed. */

import { useCallback, useRef, useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { WorkshopCanvas } from "@/components/workshop/WorkshopCanvas";
import { PermissionPopup } from "@/components/session/PermissionPopup";
import { XTerminal } from "@/components/terminal/XTerminal";
import type { XTerminalHandle } from "@/components/terminal/XTerminal";
import { ResizeHandle } from "@/components/shared/ResizeHandle";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";
import { useTeamSession } from "@/hooks/useTeamSession";
import { useStallDetection } from "@/hooks/useStallDetection";
import { useResizable } from "@/hooks/useResizable";
import { PtyAgentDetector } from "@/lib/pty-agent-detector";
import type { DetectedAgent, DetectedPermission } from "@/lib/pty-agent-detector";
import { generateElf, getStatusMessage } from "@/lib/elf-names";
import { playSound } from "@/lib/sounds";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Terminal right-panel width constraints. */
const TERMINAL_DEFAULT_WIDTH = 500;
const TERMINAL_MIN_WIDTH = 300;
const TERMINAL_MAX_WIDTH = 900;

/** Tauri IPC: write data to PTY stdin. */
async function writePty(ptyId: string, data: string): Promise<void> {
  await invoke<void>("write_pty", { ptyId, data });
}

/** Tauri IPC: resize the PTY. */
async function resizePty(ptyId: string, cols: number, rows: number): Promise<void> {
  await invoke<void>("resize_pty", { ptyId, cols, rows });
}

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
 * Workshop-first session view.
 *
 * Layout: WorkshopCanvas (left, fills space) | PTY Terminal (right, collapsible).
 * The PTY listener always runs so permission popups appear even with terminal hidden.
 */
export function SessionSplitView(): React.JSX.Element {
  const activeSession = useSessionStore((s) => s.activeSession);
  const elves = useSessionStore((s) => s.elves);
  const events = useSessionStore((s) => s.events);
  const activeFloorId = useSessionStore((s) => s.activeFloorId);
  const floor = useSessionStore((s) => activeFloorId ? s.floors[activeFloorId] : null);
  const ptyId = floor?.ptyId ?? null;
  const sessionId = activeSession?.id ?? null;
  const isHistorical = floor?.isHistorical ?? false;
  const isCompleted = activeSession?.status === "completed";

  const isTerminalOpen = useUiStore((s) => s.isTerminalPanelOpen);
  const toggleTerminal = useUiStore((s) => s.toggleTerminalPanel);

  /* Terminal right-panel width (local state — persists within session) */
  const [terminalWidth, setTerminalWidth] = useState(TERMINAL_DEFAULT_WIDTH);

  const terminalResize = useResizable({
    initialWidth: terminalWidth,
    onWidthChange: setTerminalWidth,
    minWidth: TERMINAL_MIN_WIDTH,
    maxWidth: TERMINAL_MAX_WIDTH,
    side: "left",
  });

  /* Permission popup state */
  const [pendingPermission, setPendingPermission] = useState<DetectedPermission | null>(null);

  /** Handle permission response — write y/n to PTY stdin and dismiss popup. */
  const handlePermissionResponse = useCallback((response: "y" | "n"): void => {
    if (!ptyId) return;
    writePty(ptyId, `${response}\n`).catch((error: unknown) => {
      console.error("Failed to write permission response:", error);
    });
    setPendingPermission(null);
  }, [ptyId]);

  /* ── PTY event listener — ALWAYS active when ptyId exists ── */
  const terminalRef = useRef<XTerminalHandle>(null);
  const detectorRef = useRef<PtyAgentDetector>(new PtyAgentDetector());
  const [hasExited, setHasExited] = useState(false);

  useEffect(() => {
    if (!ptyId || !sessionId) return;
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let mounted = true;

    detectorRef.current.reset();
    setHasExited(false);

    async function setup(): Promise<void> {
      try {
        /* Listen for PTY stdout data — write to xterm + agent/permission detection */
        unlistenData = await listen<string>(`pty:data:${ptyId}`, (event) => {
          if (!mounted) return;
          /* Write to terminal (may be unmounted if panel is collapsed — that's ok) */
          terminalRef.current?.write(event.payload);

          /* Always run detection regardless of terminal visibility */
          const { agents, permissions } = detectorRef.current.feed(event.payload);
          for (const agent of agents) {
            handleAgentDetected(agent, sessionId!);
          }
          for (const perm of permissions) {
            setPendingPermission(perm);
          }
        });

        /* Listen for PTY process exit */
        unlistenExit = await listen<number>(`pty:exit:${ptyId}`, (event) => {
          if (!mounted) return;
          terminalRef.current?.writeln("");
          terminalRef.current?.writeln(
            `\x1b[33m--- Session ended (exit code: ${event.payload}) ---\x1b[0m`,
          );
          setHasExited(true);

          const store = useSessionStore.getState();
          const floorId = store.getFloorBySessionId(sessionId!);
          if (floorId) {
            store.updateAllElfStatusOnFloor(floorId, "done");
            store.endSessionOnFloor(floorId, "completed");
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
  }, [ptyId, sessionId]);

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

  return (
    <div className="relative flex flex-1 overflow-hidden">
      {/* Left: Workshop canvas — fills available space */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <WorkshopCanvas elves={elves} events={events} />
        </div>

        {/* Idle overlay when no session is active */}
        {!activeSession && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="border-[3px] border-border/20 bg-white/80 px-8 py-6 text-center shadow-brutal-sm">
              <p className="font-display text-2xl font-black tracking-tight text-text-light/30">
                Type a task above to summon the elves.
              </p>
              <p className="mt-2 font-body text-sm text-text-light/20">
                Your workshop awaits instructions.
              </p>
            </div>
          </div>
        )}

        {/* Permission popup — centered overlay on workshop */}
        <AnimatePresence>
          {pendingPermission && (
            <PermissionPopup
              permission={pendingPermission}
              onRespond={handlePermissionResponse}
            />
          )}
        </AnimatePresence>

        {/* Compact control pill — bottom-left of workshop */}
        {activeSession && (
          <SessionControlPill
            isTerminalOpen={isTerminalOpen}
            onToggleTerminal={toggleTerminal}
          />
        )}
      </div>

      {/* Right: PTY terminal panel — toggleable */}
      {isTerminalOpen && (
        <div className="relative flex shrink-0" style={{ width: terminalWidth }}>
          {/* Resize handle on the left edge of the terminal panel */}
          <ResizeHandle
            side="left"
            onMouseDown={terminalResize.handleProps.onMouseDown}
            isDragging={terminalResize.isDragging}
          />

          <div className="flex flex-1 flex-col overflow-hidden border-l-[3px] border-border bg-[#1A1A2E]">
            {ptyId ? (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Terminal header */}
                <div className="flex shrink-0 items-center justify-between border-b-[2px] border-border/30 px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={[
                      "border-[2px] border-border/50 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase",
                      hasExited || isCompleted ? "bg-gray-600 text-gray-300" : "bg-success/20 text-success",
                    ].join(" ")}>
                      {hasExited || isCompleted ? "ENDED" : "LIVE"}
                    </span>
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-text-dark-muted">
                      Terminal
                    </span>
                  </div>
                  <button
                    onClick={toggleTerminal}
                    className="cursor-pointer border-none bg-transparent px-1 py-0.5 font-mono text-xs text-gray-500 hover:text-white"
                    title="Close terminal panel"
                  >
                    &#10005;
                  </button>
                </div>

                {/* Terminal viewport */}
                <div className="flex-1 overflow-hidden p-1">
                  <XTerminal
                    ref={terminalRef}
                    onData={handleTerminalData}
                    onResize={handleTerminalResize}
                  />
                </div>

                {/* Exited footer */}
                {hasExited && (
                  <div className="shrink-0 border-t-[2px] border-border/20 bg-[#1A1A2E] px-3 py-1 text-center">
                    <span className="font-mono text-xs text-elf-gold">
                      Session ended. Start a new task or close this floor.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="font-mono text-sm text-gray-500">
                  {isHistorical ? "Historical session \u2014 no terminal" : "Connecting to terminal..."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SessionControlPill — compact floating controls at bottom-left ────── */

interface SessionControlPillProps {
  readonly isTerminalOpen: boolean;
  readonly onToggleTerminal: () => void;
}

/**
 * Minimal floating pill at bottom-left showing session status, elapsed time,
 * and action buttons (STOP, RESUME, TERMINAL toggle).
 */
function SessionControlPill({ isTerminalOpen, onToggleTerminal }: SessionControlPillProps): React.JSX.Element {
  const activeSession = useSessionStore((s) => s.activeSession);
  const elves = useSessionStore((s) => s.elves);
  const lastEventAt = useSessionStore((s) => s.lastEventAt);
  const isInteractiveMode = useSessionStore((s) => s.isInteractiveMode);
  const activeFloorId = useSessionStore((s) => s.activeFloorId);
  const clearFloorSession = useSessionStore((s) => s.clearFloorSession);
  const { stopSession, resumeSession, isSessionActive } = useTeamSession();
  const isStalled = useStallDetection(lastEventAt, isSessionActive && !isInteractiveMode);

  const isActive = activeSession?.status === "active";
  const isCompleted = activeSession?.status === "completed";
  const isCancelled = activeSession?.status === "cancelled";
  const canResume = (isCompleted || isCancelled) && !!activeSession?.claudeSessionId;

  /* Ticking elapsed timer */
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeSession) { setElapsed(0); return; }
    const updateElapsed = (): void => {
      setElapsed(Math.floor((Date.now() - activeSession.startedAt) / 1000));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  const handleStop = useCallback((): void => { void stopSession(); }, [stopSession]);
  const handleResume = useCallback((): void => { void resumeSession(); }, [resumeSession]);
  const handleEnd = useCallback((): void => {
    if (activeFloorId) clearFloorSession(activeFloorId);
  }, [activeFloorId, clearFloorSession]);

  const leadElf = elves[0];
  const statusText = isCompleted ? "Done!"
    : isCancelled ? "Cancelled"
    : isInteractiveMode ? "Interactive"
    : leadElf?.status === "thinking" ? "Thinking..."
    : "Working...";

  return (
    <div className="absolute bottom-3 left-3 z-10 border-[3px] border-border bg-white shadow-brutal-sm">
      {/* Status row */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span
          className={[
            "h-2 w-2 shrink-0 rounded-full",
            isActive ? "animate-pulse bg-info" : isCancelled ? "bg-warning" : "bg-success",
          ].join(" ")}
        />
        <span className="font-display text-[10px] font-bold uppercase tracking-wider">
          {statusText}
        </span>

        {isStalled && (
          <span className="text-warning" title="Claude may be waiting for input">&#9888;</span>
        )}

        <span className="font-mono text-[10px] font-bold text-text-light/50">
          {formatElapsed(elapsed)}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 border-t-[2px] border-border/30 px-2 py-1.5">
        {isActive ? (
          <button
            onClick={handleStop}
            className="cursor-pointer border-[2px] border-border bg-error px-2.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest text-white shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
          >
            STOP
          </button>
        ) : (
          <>
            {canResume && (
              <button
                onClick={handleResume}
                className="cursor-pointer border-[2px] border-border bg-info px-2.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest text-white shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              >
                RESUME
              </button>
            )}
            <button
              onClick={handleEnd}
              className="cursor-pointer border-[2px] border-border bg-success/20 px-2.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              NEW TASK
            </button>
          </>
        )}

        <button
          onClick={onToggleTerminal}
          className={[
            "cursor-pointer border-[2px] border-border px-2.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-widest shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
            isTerminalOpen ? "bg-elf-gold" : "bg-white",
          ].join(" ")}
        >
          {isTerminalOpen ? "\u25C0 TERM" : "\u25B6 TERM"}
        </button>
      </div>
    </div>
  );
}

/** Create a new elf when an Agent tool call is detected in PTY output. */
function handleAgentDetected(agent: DetectedAgent, sessionId: string): void {
  const store = useSessionStore.getState();
  const floorId = store.activeFloorId;
  if (!floorId) return;

  const floor = store.floors[floorId];
  if (!floor) return;

  const existingNames = floor.elves.map((elf) => elf.name);
  const personality = generateElf(existingNames);
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

  setTimeout(() => {
    const currentStore = useSessionStore.getState();
    const currentFloor = currentStore.floors[floorId];
    if (currentFloor?.elves.some((e) => e.id === elfId)) {
      currentStore.updateElfStatusOnFloor(floorId, elfId, "working");
    }
  }, 1500);
}

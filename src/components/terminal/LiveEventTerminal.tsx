/* LiveEventTerminal — read-only terminal view that shows the live event stream
 * during an active --print session. Renders events from the session store in
 * ANSI-colored terminal format without spawning a PTY or killing the process. */

import { useEffect, useRef, useCallback, useState } from "react";
import { XTerminal } from "./XTerminal";
import type { XTerminalHandle } from "./XTerminal";
import { useSessionStore } from "@/stores/session";
import { transitionToInteractive } from "@/lib/tauri";
import type { ElfEvent } from "@/types/elf";

interface LiveEventTerminalProps {
  readonly sessionId: string;
  readonly claudeSessionId: string;
  readonly projectPath: string;
  readonly taskLabel: string;
  readonly onClose: () => void;
}

/** ANSI color codes for terminal rendering. */
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  purple: "\x1b[35m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
  white: "\x1b[37m",
  cyan: "\x1b[36m",
} as const;

/** Format a timestamp to HH:MM:SS for terminal display. */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Render a single ElfEvent as an ANSI-colored terminal line. */
function formatEventLine(event: ElfEvent): string {
  const time = `${ANSI.dim}[${formatTime(event.timestamp)}]${ANSI.reset}`;
  const payload = event.payload as Record<string, unknown>;

  switch (event.type) {
    case "thinking": {
      const text = String(payload.text ?? "").slice(0, 200);
      return `${time} ${ANSI.purple}${ANSI.italic}[thinking]${ANSI.reset} ${ANSI.purple}${text}${ANSI.reset}`;
    }
    case "tool_call": {
      const tool = String(payload.tool ?? "tool");
      const input = payload.input as Record<string, unknown> | undefined;
      const detail = String(input?.file_path ?? input?.command ?? input?.pattern ?? "").slice(0, 120);
      return `${time} ${ANSI.blue}${ANSI.bold}[${tool}]${ANSI.reset} ${ANSI.gray}${detail}${ANSI.reset}`;
    }
    case "tool_result": {
      const result = String(payload.result ?? "done").split("\n")[0]!.slice(0, 120);
      return `${time} ${ANSI.green}  \u2514\u2500 ${result}${ANSI.reset}`;
    }
    case "output": {
      const text = String(payload.text ?? "");
      const isFinal = Boolean(payload.isFinal);
      if (isFinal) {
        return `${time} ${ANSI.green}${ANSI.bold}[result]${ANSI.reset} ${ANSI.green}${text.slice(0, 300)}${ANSI.reset}`;
      }
      return `${time} ${ANSI.white}${text.slice(0, 200)}${ANSI.reset}`;
    }
    case "spawn":
      return `${time} ${ANSI.yellow}${ANSI.bold}\u2728 ${event.elfName} spawned${ANSI.reset}`;
    case "task_update":
      return `${time} ${ANSI.cyan}${String(payload.message ?? "task updated")}${ANSI.reset}`;
    case "error":
      return `${time} ${ANSI.red}${ANSI.bold}[error]${ANSI.reset} ${ANSI.red}${String(payload.message ?? "")}${ANSI.reset}`;
    default:
      return `${time} ${ANSI.gray}${event.type}: ${JSON.stringify(payload).slice(0, 100)}${ANSI.reset}`;
  }
}

/**
 * Read-only terminal view that shows the live --print event stream.
 * Subscribes to the session store's event list and renders new events
 * as ANSI-colored lines. Does NOT spawn a PTY or kill the print process.
 *
 * Includes a "GO INTERACTIVE" button that transitions to a real PTY
 * when the user explicitly requests it.
 */
export function LiveEventTerminal({
  sessionId,
  claudeSessionId,
  taskLabel,
  onClose,
}: LiveEventTerminalProps): React.JSX.Element {
  const terminalRef = useRef<XTerminalHandle>(null);
  const writtenCountRef = useRef(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  /** Write all new events since last render to the terminal. */
  const flushEvents = useCallback((events: readonly ElfEvent[]): void => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const startIdx = writtenCountRef.current;
    for (let i = startIdx; i < events.length; i++) {
      terminal.writeln(formatEventLine(events[i]!));
    }
    writtenCountRef.current = events.length;
  }, []);

  /** Subscribe to event changes and flush new events. */
  useEffect(() => {
    /* Write existing events on mount */
    const state = useSessionStore.getState();
    const floorId = state.getFloorBySessionId(sessionId);
    if (floorId) {
      const floor = state.floors[floorId];
      if (floor) {
        /* Small delay to let xterm initialize */
        setTimeout(() => flushEvents(floor.events), 50);
      }
    }

    /* Subscribe to store changes for new events */
    const unsub = useSessionStore.subscribe((newState) => {
      const fid = newState.getFloorBySessionId(sessionId);
      if (!fid) return;
      const floor = newState.floors[fid];
      if (floor && floor.events.length > writtenCountRef.current) {
        flushEvents(floor.events);
      }
    });

    return unsub;
  }, [sessionId, flushEvents]);

  /** Explicitly transition to interactive PTY mode. */
  const handleGoInteractive = useCallback((): void => {
    setIsTransitioning(true);
    transitionToInteractive(sessionId).catch((error: unknown) => {
      console.error("Failed to transition to interactive:", error);
      setIsTransitioning(false);
    });
  }, [sessionId]);

  /* No-op handlers — this terminal is read-only */
  const handleData = useCallback((): void => {
    /* Read-only: ignore user input */
  }, []);
  const handleResize = useCallback((): void => {
    /* No PTY to resize */
  }, []);

  return (
    <div className="flex h-full flex-col border-token-normal border-border bg-[#1A1A2E]" data-testid="live-event-terminal">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b-token-normal border-border bg-surface-elevated px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 animate-pulse border-token-thin border-border bg-info/20 px-1.5 py-0.5 font-mono text-[10px] text-label">
            LIVE
          </span>
          <span className="min-w-0 truncate font-body text-xs font-bold" title={taskLabel}>
            {taskLabel}
          </span>
          <span className="font-mono text-[9px] text-text-light/40">
            (read-only)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGoInteractive}
            disabled={isTransitioning || !claudeSessionId}
            className={[
              "shrink-0 border-[2px] border-border px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest shadow-brutal-sm transition-all duration-100",
              isTransitioning
                ? "cursor-wait bg-gray-200 text-gray-400"
                : "cursor-pointer bg-warning/20 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none",
            ].join(" ")}
            title="Kill the print process and open an interactive terminal (interrupts current work)"
            data-testid="go-interactive-btn"
          >
            {isTransitioning ? "..." : "\u26A1 INTERACTIVE"}
          </button>
          <button
            onClick={onClose}
            className="shrink-0 cursor-pointer border-token-thin border-border bg-surface-elevated rounded-token-sm px-2 py-0.5 font-display text-[10px] text-label transition-all duration-100 hover:bg-error hover:text-white"
            data-testid="terminal-close-button"
          >
            Close
          </button>
        </div>
      </div>

      {/* Terminal viewport — read-only event stream */}
      <div className="flex-1 overflow-hidden p-1">
        <XTerminal ref={terminalRef} onData={handleData} onResize={handleResize} />
      </div>
    </div>
  );
}

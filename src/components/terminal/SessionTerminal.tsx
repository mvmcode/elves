/* SessionTerminal — per-session interactive terminal wired to a PTY via Tauri IPC. */

import { useCallback, useEffect, useRef, useState } from "react";
import { XTerminal } from "./XTerminal";
import type { XTerminalHandle } from "./XTerminal";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { PtyAgentDetector } from "@/lib/pty-agent-detector";
import type { DetectedAgent } from "@/lib/pty-agent-detector";

interface SessionTerminalProps {
  /** ELVES session ID (used to look up the Claude session ID). */
  readonly sessionId: string;
  /** The Claude Code session ID for --resume. */
  readonly claudeSessionId: string;
  /** Absolute path to the project directory (cwd for PTY). */
  readonly projectPath: string;
  /** Task description shown in the header bar. */
  readonly taskLabel: string;
  /** Called when the user closes the terminal panel. */
  readonly onClose: () => void;
  /** Called when the PTY process exits — allows the parent to update session state. */
  readonly onPtyExit?: () => void;
  /** Called when Agent tool calls are detected in the PTY output stream. */
  readonly onAgentDetected?: (agent: DetectedAgent) => void;
}

/** Tauri IPC: spawn a new PTY process. Returns a unique pty_id. */
async function spawnPty(
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<string> {
  return invoke<string>("spawn_pty", { command, args, cwd });
}

/** Tauri IPC: write data to PTY stdin. */
async function writePty(ptyId: string, data: string): Promise<void> {
  await invoke<void>("write_pty", { ptyId, data });
}

/** Tauri IPC: resize the PTY. */
async function resizePty(ptyId: string, cols: number, rows: number): Promise<void> {
  await invoke<void>("resize_pty", { ptyId, cols, rows });
}

/** Tauri IPC: kill a PTY process. */
async function killPty(ptyId: string): Promise<void> {
  await invoke<void>("kill_pty", { ptyId });
}

/**
 * Wraps XTerminal with PTY lifecycle management for a single session.
 * Spawns `claude --resume <claudeSessionId>` in the project directory,
 * wires bidirectional data and resize between xterm and the PTY,
 * and handles process exit and cleanup.
 */
export function SessionTerminal({
  sessionId,
  claudeSessionId,
  projectPath,
  taskLabel,
  onClose,
  onPtyExit,
  onAgentDetected,
}: SessionTerminalProps): React.JSX.Element {
  const terminalRef = useRef<XTerminalHandle>(null);
  const ptyIdRef = useRef<string | null>(null);
  const detectorRef = useRef<PtyAgentDetector>(new PtyAgentDetector());
  const onAgentDetectedRef = useRef(onAgentDetected);
  onAgentDetectedRef.current = onAgentDetected;
  const [hasExited, setHasExited] = useState(false);

  /** Forward user keystrokes to PTY stdin. */
  const handleData = useCallback((data: string): void => {
    const ptyId = ptyIdRef.current;
    if (ptyId) {
      writePty(ptyId, data).catch((error: unknown) => {
        console.error("Failed to write to PTY:", error);
      });
    }
  }, []);

  /** Forward terminal resize to PTY. */
  const handleResize = useCallback((cols: number, rows: number): void => {
    const ptyId = ptyIdRef.current;
    if (ptyId) {
      resizePty(ptyId, cols, rows).catch((error: unknown) => {
        console.error("Failed to resize PTY:", error);
      });
    }
  }, []);

  /** Spawn PTY and wire events on mount; kill PTY on unmount. */
  useEffect(() => {
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;
    let mounted = true;

    async function setup(): Promise<void> {
      try {
        const ptyId = await spawnPty("claude", ["--resume", claudeSessionId], projectPath);
        if (!mounted) {
          /* Component unmounted before spawn completed — clean up immediately */
          void killPty(ptyId);
          return;
        }
        ptyIdRef.current = ptyId;

        /* Listen for PTY stdout data → write to xterm display + scan for agent spawns */
        unlistenData = await listen<string>(`pty:data:${ptyId}`, (event) => {
          terminalRef.current?.write(event.payload);

          /* Feed PTY output through agent detector to find Agent tool calls */
          const detected = detectorRef.current.feed(event.payload);
          for (const agent of detected) {
            onAgentDetectedRef.current?.(agent);
          }
        });

        /* Listen for PTY process exit → show message and notify parent */
        unlistenExit = await listen<number>(`pty:exit:${ptyId}`, (event) => {
          terminalRef.current?.writeln("");
          terminalRef.current?.writeln(
            `\x1b[33m--- Session ended (exit code: ${event.payload}) ---\x1b[0m`,
          );
          setHasExited(true);
          onPtyExit?.();
        });
      } catch (error) {
        console.error("Failed to spawn PTY:", error);
        terminalRef.current?.writeln(
          `\x1b[31mFailed to start terminal: ${error instanceof Error ? error.message : String(error)}\x1b[0m`,
        );
        setHasExited(true);
      }
    }

    void setup();

    return () => {
      mounted = false;
      unlistenData?.();
      unlistenExit?.();
      const ptyId = ptyIdRef.current;
      if (ptyId) {
        killPty(ptyId).catch((error: unknown) => {
          console.error("Failed to kill PTY on unmount:", error);
        });
        ptyIdRef.current = null;
      }
    };
  }, [claudeSessionId, projectPath, sessionId]);

  return (
    <div className="flex h-full flex-col border-token-normal border-border bg-[#1A1A2E]" data-testid="session-terminal">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b-token-normal border-border bg-surface-elevated px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={[
            "shrink-0 border-token-thin border-border px-1.5 py-0.5 font-mono text-[10px] text-label",
            hasExited ? "bg-gray-300" : "bg-success/20",
          ].join(" ")}>
            {hasExited ? "ENDED" : "LIVE"}
          </span>
          <span className="min-w-0 truncate font-body text-xs font-bold" title={taskLabel}>
            {taskLabel}
          </span>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 cursor-pointer border-token-thin border-border bg-surface-elevated rounded-token-sm px-2 py-0.5 font-display text-[10px] text-label transition-all duration-100 hover:bg-error hover:text-white"
          data-testid="terminal-close-button"
        >
          Close
        </button>
      </div>

      {/* Terminal viewport */}
      <div className="flex-1 overflow-hidden p-1">
        <XTerminal ref={terminalRef} onData={handleData} onResize={handleResize} />
      </div>

      {/* Exited footer */}
      {hasExited && (
        <div className="border-t-token-thin border-border/30 bg-[#1A1A2E] px-3 py-1 text-center">
          <span className="font-mono text-xs text-elf-gold">Session ended. Close this panel when done.</span>
        </div>
      )}
    </div>
  );
}

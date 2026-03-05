/* TerminalPane — a single PTY pane for team split view.
 * Wraps XTerminal with PTY event wiring, permission popups, and agent detection.
 * Each pane has a compact header with role name, status indicator, and focus toggle. */

import { useCallback, useRef, useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { XTerminal } from "@/components/terminal/XTerminal";
import type { XTerminalHandle } from "@/components/terminal/XTerminal";
import { PermissionPopup } from "@/components/session/PermissionPopup";
import { PtyAgentDetector } from "@/lib/pty-agent-detector";
import type { DetectedAgent, DetectedPermission } from "@/lib/pty-agent-detector";
import { useSessionStore } from "@/stores/session";
import { generateElf } from "@/lib/elf-names";
import { playSound } from "@/lib/sounds";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Role color palette — maps index to left-border accent color. */
const ROLE_COLORS = ["#FFD93D", "#FF6B6B", "#6BCB77", "#4D96FF", "#FF8B3D", "#C084FC"];

interface TerminalPaneProps {
  readonly ptyId: string;
  readonly role: string;
  readonly roleIndex: number;
  readonly workspaceSlug: string;
  readonly isFocused?: boolean;
  readonly onFocus?: () => void;
}

/**
 * A single terminal pane for one role in a team deployment.
 * Compact header with colored left border, role name, and status dot.
 * Double-click header to toggle focus (maximize).
 */
export function TerminalPane({
  ptyId,
  role,
  roleIndex,
  workspaceSlug,
  isFocused,
  onFocus,
}: TerminalPaneProps): React.JSX.Element {
  const terminalRef = useRef<XTerminalHandle>(null);
  const detectorRef = useRef<PtyAgentDetector>(new PtyAgentDetector());
  const [hasExited, setHasExited] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<DetectedPermission | null>(null);

  const accentColor = ROLE_COLORS[roleIndex % ROLE_COLORS.length] ?? "#FFD93D";

  /** Handle permission response — write y/n to PTY stdin. */
  const handlePermissionResponse = useCallback((response: "y" | "n"): void => {
    invoke<void>("write_pty", { ptyId, data: `${response}\n` }).catch((error: unknown) => {
      console.error("Failed to write permission response:", error);
    });
    setPendingPermission(null);
  }, [ptyId]);

  /** PTY event listeners. */
  useEffect(() => {
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
            handleAgentDetected(agent, workspaceSlug);
          }
          for (const perm of permissions) {
            setPendingPermission(perm);
          }
        });

        unlistenExit = await listen<number>(`pty:exit:${ptyId}`, (event) => {
          if (!mounted) return;
          terminalRef.current?.writeln("");
          terminalRef.current?.writeln(
            `\x1b[33m--- ${role} ended (exit code: ${event.payload}) ---\x1b[0m`,
          );
          setHasExited(true);
        });
      } catch (error) {
        console.error(`Failed to subscribe to PTY events for ${role}:`, error);
        setHasExited(true);
      }
    }

    void setup();

    return () => {
      mounted = false;
      unlistenData?.();
      unlistenExit?.();
    };
  }, [ptyId, role, workspaceSlug]);

  /** Forward user keystrokes to PTY stdin. */
  const handleTerminalData = useCallback((data: string): void => {
    invoke<void>("write_pty", { ptyId, data }).catch((error: unknown) => {
      console.error("Failed to write to PTY:", error);
    });
  }, [ptyId]);

  /** Forward terminal resize to PTY. */
  const handleTerminalResize = useCallback((cols: number, rows: number): void => {
    invoke<void>("resize_pty", { ptyId, cols, rows }).catch((error: unknown) => {
      console.error("Failed to resize PTY:", error);
    });
  }, [ptyId]);

  return (
    <div
      className="flex flex-col overflow-hidden border-[3px] border-border bg-[#1A1A2E]"
      data-testid={`terminal-pane-${role}`}
    >
      {/* Compact header (24px) */}
      <div
        className="flex h-6 shrink-0 cursor-pointer items-center gap-2 bg-[#0D0D1A] px-2"
        style={{ borderLeft: `4px solid ${accentColor}` }}
        onDoubleClick={onFocus}
      >
        <span className="font-display text-[10px] font-bold uppercase tracking-widest text-white/90">
          {role}
        </span>
        <span
          className={[
            "ml-auto h-2 w-2 rounded-full",
            hasExited ? "bg-gray-500" : "bg-green-400",
          ].join(" ")}
          title={hasExited ? "Exited" : "Running"}
        />
        {isFocused && (
          <span className="font-mono text-[8px] text-white/40">ESC to unfocus</span>
        )}
      </div>

      {/* Terminal body */}
      <div className="relative flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden p-0.5">
          <XTerminal
            ref={terminalRef}
            onData={handleTerminalData}
            onResize={handleTerminalResize}
          />
        </div>

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
  const elfId = `elf-team-${workspaceSlug}-${agent.id}`;
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

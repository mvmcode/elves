/* SidePanel — tabbed right-side panel with Activity and Terminal tabs.
 * Handles the transition from non-interactive (--print) mode to interactive
 * PTY terminal when the user needs to provide feedback to a running session. */

import { useState, useCallback, useEffect, useRef } from "react";
import { ActivityFeed } from "./ActivityFeed";
import { SessionTerminal } from "@/components/terminal/SessionTerminal";
import { useSessionStore } from "@/stores/session";
import { transitionToInteractive } from "@/lib/tauri";
import type { ElfEvent } from "@/types/elf";

type TabId = "activity" | "terminal";

/** Seconds of silence before showing the stall banner. */
const STALL_THRESHOLD_SECONDS = 15;

interface SidePanelProps {
  readonly events: readonly ElfEvent[];
  readonly sessionId: string;
  readonly claudeSessionId: string | undefined;
  readonly projectPath: string;
  readonly taskLabel: string;
  readonly onCollapse: () => void;
}

/**
 * Tabbed wrapper for the right-side panel in the workshop view.
 * Renders an Activity feed tab and a Terminal tab. The terminal tab
 * connects to the active Claude session via PTY when a claudeSessionId
 * is available.
 *
 * When switching to the Terminal tab during an active session, the
 * non-interactive --print process is killed and `claude --resume` takes
 * over in a PTY, enabling the user to provide feedback, approve permissions,
 * or send follow-up instructions.
 */
export function SidePanel({
  events,
  sessionId,
  claudeSessionId,
  projectPath,
  taskLabel,
  onCollapse,
}: SidePanelProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>("activity");
  const [hasTransitioned, setHasTransitioned] = useState(false);
  const [isStalled, setIsStalled] = useState(false);
  const isInteractiveMode = useSessionStore((s) => s.isInteractiveMode);
  const lastEventAt = useSessionStore((s) => s.lastEventAt);
  const activeSession = useSessionStore((s) => s.activeSession);
  const isSessionActive = activeSession?.status === "active";

  /** Kill the print process before mounting the terminal. */
  const handleSwitchToTerminal = useCallback((): void => {
    if (isSessionActive && !hasTransitioned && !isInteractiveMode) {
      setHasTransitioned(true);
      transitionToInteractive(sessionId).catch((error: unknown) => {
        console.error("Failed to transition to interactive:", error);
      });
    }
    setActiveTab("terminal");
    setIsStalled(false);
  }, [sessionId, isSessionActive, hasTransitioned, isInteractiveMode]);

  /** Detect event stream stall — indicates Claude may be waiting for input. */
  const stallTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isSessionActive || isInteractiveMode || activeTab === "terminal") {
      setIsStalled(false);
      if (stallTimerRef.current) {
        clearInterval(stallTimerRef.current);
        stallTimerRef.current = null;
      }
      return;
    }

    stallTimerRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastEventAt) / 1000;
      if (elapsed >= STALL_THRESHOLD_SECONDS && lastEventAt > 0) {
        setIsStalled(true);
      } else {
        setIsStalled(false);
      }
    }, 3000);

    return () => {
      if (stallTimerRef.current) {
        clearInterval(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };
  }, [isSessionActive, isInteractiveMode, activeTab, lastEventAt]);

  /** Complete the session when the PTY exits during interactive mode. */
  const handlePtyExit = useCallback((): void => {
    if (isInteractiveMode) {
      useSessionStore.getState().endSession("completed");
    }
  }, [isInteractiveMode]);

  /** Reset transition state when session changes. */
  useEffect(() => {
    setHasTransitioned(false);
    setIsStalled(false);
    setActiveTab("activity");
  }, [sessionId]);

  return (
    <div className="flex h-full flex-col">
      {/* Stall banner — shown when Claude appears to be waiting for input */}
      {isStalled && activeTab === "activity" && claudeSessionId && (
        <button
          onClick={handleSwitchToTerminal}
          className="flex w-full cursor-pointer items-center gap-2 border-b-[3px] border-border bg-warning px-4 py-2 text-left transition-all duration-100 hover:brightness-110"
          data-testid="stall-banner"
        >
          <span className="text-lg">&#9888;</span>
          <span className="flex-1 font-display text-xs font-bold uppercase tracking-wider text-text-light">
            Claude may be waiting for input
          </span>
          <span className="border-[2px] border-border bg-white px-3 py-1 font-display text-[10px] font-bold uppercase tracking-widest text-text-light">
            Open Terminal
          </span>
        </button>
      )}

      {/* Tab bar */}
      <div className="flex items-center border-b-[3px] border-border">
        <button
          onClick={() => setActiveTab("activity")}
          className={[
            "cursor-pointer border-[3px] border-border border-b-0 font-display text-xs font-bold uppercase tracking-wider px-4 py-2",
            activeTab === "activity"
              ? "bg-elf-gold text-text-light"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700",
          ].join(" ")}
          data-testid="tab-activity"
        >
          Activity
        </button>
        <button
          onClick={handleSwitchToTerminal}
          className={[
            "cursor-pointer border-[3px] border-border border-b-0 font-display text-xs font-bold uppercase tracking-wider px-4 py-2",
            activeTab === "terminal"
              ? "bg-elf-gold text-text-light"
              : "bg-gray-800 text-gray-400 hover:bg-gray-700",
          ].join(" ")}
          data-testid="tab-terminal"
        >
          Terminal
          {isStalled && activeTab !== "terminal" && (
            <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-warning" data-testid="stall-dot" />
          )}
        </button>
        <div className="flex-1" />
        <button
          onClick={onCollapse}
          className="cursor-pointer border-none bg-transparent p-1 px-3 font-mono text-xs font-bold text-text-light/40 hover:text-text-light"
          title="Collapse activity feed (Cmd+B)"
          data-testid="collapse-button"
        >
          {"\u00BB"}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === "activity" ? (
        <ActivityFeed events={events} maxHeight="100%" />
      ) : claudeSessionId ? (
        <SessionTerminal
          sessionId={sessionId}
          claudeSessionId={claudeSessionId}
          projectPath={projectPath}
          taskLabel={taskLabel}
          onClose={() => setActiveTab("activity")}
          onPtyExit={handlePtyExit}
        />
      ) : (
        <div
          className="flex flex-1 items-center justify-center bg-gray-900"
          data-testid="terminal-waiting"
        >
          <p className="font-mono text-sm text-gray-500">
            Waiting for session to connect...
          </p>
        </div>
      )}
    </div>
  );
}

/* StatusBar — thin bottom bar showing runtime picker, task state, and session metrics.
 * Includes clickable runtime toggle (Claude Code / Codex) on the left. */

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app";
import { useSessionStore } from "@/stores/session";
import type { Runtime } from "@/types/elf";

/** Runtime display metadata. */
const RUNTIME_META: Record<Runtime, { label: string; icon: string; color: string }> = {
  "claude-code": { label: "Claude Code", icon: "CC", color: "#A78BFA" },
  codex: { label: "Codex", icon: "CX", color: "#34D399" },
};

/**
 * Bottom status bar with runtime toggle, current task status, and elapsed time.
 * Always visible at the bottom of the main content area.
 */
export function StatusBar(): React.JSX.Element {
  const runtimes = useAppStore((s) => s.runtimes);
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);
  const setDefaultRuntime = useAppStore((s) => s.setDefaultRuntime);
  const activeSession = useSessionStore((s) => s.activeSession);
  const elves = useSessionStore((s) => s.elves);

  const isActive = activeSession?.status === "active";
  const isCompleted = activeSession?.status === "completed";
  const isCancelled = activeSession?.status === "cancelled";
  const leadElf = elves[0];

  const currentRuntime = defaultRuntime ?? "claude-code";
  const meta = RUNTIME_META[currentRuntime];
  const runtimeAvailable = currentRuntime === "codex" ? runtimes?.codex : runtimes?.claudeCode;

  const toggleRuntime = useCallback((): void => {
    if (isActive) return;
    setDefaultRuntime(currentRuntime === "claude-code" ? "codex" : "claude-code");
  }, [currentRuntime, isActive, setDefaultRuntime]);

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

  const formatElapsed = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  const statusLabel = isActive
    ? leadElf?.status === "thinking"
      ? "Thinking..."
      : "Working..."
    : isCompleted
      ? "Done"
      : isCancelled
        ? "Cancelled"
        : "Idle";

  return (
    <footer
      className="no-select flex h-7 shrink-0 items-center justify-between border-t-[2px] border-border bg-[#F0EDE6] px-2 text-[11px] text-text-light/70"
      data-testid="status-bar"
    >
      {/* Left: Runtime toggle */}
      <button
        onClick={toggleRuntime}
        className={[
          "flex items-center gap-1.5 border-none bg-transparent text-[11px] text-text-light/70 transition-colors duration-100",
          isActive ? "cursor-default" : "cursor-pointer hover:text-text-light",
        ].join(" ")}
        title={isActive ? `Runtime: ${meta.label}` : `Switch runtime (Cmd+R) — ${meta.label}`}
        data-testid="status-runtime-toggle"
      >
        {/* Runtime badge */}
        <span
          className="flex h-4 items-center gap-1 rounded-sm border-[1px] border-border/30 px-1.5 font-mono text-[9px] font-black text-white"
          style={{ backgroundColor: meta.color }}
        >
          {meta.icon}
        </span>

        {/* Runtime name + version */}
        <span>
          {meta.label}
          {runtimeAvailable ? ` ${runtimeAvailable.version}` : ""}
        </span>

        {/* Availability dot */}
        <span
          className={[
            "inline-block h-1.5 w-1.5 rounded-full",
            runtimeAvailable ? "bg-success" : "bg-error",
          ].join(" ")}
        />
      </button>

      {/* Center: Status */}
      <span className="font-display text-[10px] font-bold uppercase tracking-wider">
        {statusLabel}
      </span>

      {/* Right: Elapsed */}
      <div className="flex items-center gap-3">
        {activeSession && (
          <span className="font-mono">{formatElapsed(elapsed)}</span>
        )}
      </div>
    </footer>
  );
}

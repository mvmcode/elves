/* StatusBar — thin bottom bar showing runtime picker, task state, and session metrics.
 * Includes clickable runtime toggle (Claude Code / Codex) on the left. */

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app";
import { useSessionStore } from "@/stores/session";
import { useGitStore } from "@/stores/git";
import { useProjectStore } from "@/stores/project";
import { useUiStore } from "@/stores/ui";
import { BranchSwitcher } from "@/components/git/BranchSwitcher";
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
  const stagedFiles = useGitStore((s) => s.stagedFiles);
  const unstagedFiles = useGitStore((s) => s.unstagedFiles);
  const gitState = useGitStore((s) => s.gitState);
  const worktrees = useGitStore((s) => s.worktrees);
  const refreshBranch = useGitStore((s) => s.refreshBranch);
  const activeProject = useProjectStore((s) => {
    const id = s.activeProjectId;
    return id ? s.projects.find((p) => p.id === id) : undefined;
  });
  const setActiveView = useUiStore((s) => s.setActiveView);

  const totalChanges = stagedFiles.length + unstagedFiles.length;

  /** Load branch info when a project is active — skip if gitState already populated. */
  useEffect(() => {
    if (activeProject?.path && !gitState) {
      void refreshBranch(activeProject.path);
    }
  }, [activeProject?.path, gitState, refreshBranch]);

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

      {/* Branch display + git indicators */}
      <div className="flex items-center gap-2">
        <BranchSwitcher />

        {/* Dirty indicator — yellow dot when working tree has uncommitted changes */}
        {gitState?.isDirty && (
          <span
            className="text-[10px] text-elf-gold"
            title="Uncommitted changes"
            data-testid="git-dirty-indicator"
          >
            ●
          </span>
        )}

        {/* Ahead/behind counts relative to upstream */}
        {gitState?.aheadBehind != null && (
          <span className="flex items-center gap-1 font-mono text-[10px] font-bold">
            {gitState.aheadBehind.ahead > 0 && (
              <span className="text-success" title={`${gitState.aheadBehind.ahead} commit${gitState.aheadBehind.ahead !== 1 ? "s" : ""} ahead`} data-testid="git-ahead-count">
                ↑{gitState.aheadBehind.ahead}
              </span>
            )}
            {gitState.aheadBehind.behind > 0 && (
              <span className="text-info" title={`${gitState.aheadBehind.behind} commit${gitState.aheadBehind.behind !== 1 ? "s" : ""} behind`} data-testid="git-behind-count">
                ↓{gitState.aheadBehind.behind}
              </span>
            )}
          </span>
        )}

        {/* Change count badge */}
        {totalChanges > 0 && (
          <button
            onClick={() => setActiveView("git")}
            className="flex cursor-pointer items-center gap-1 border-[2px] border-border/20 bg-error/10 px-1.5 py-0 font-mono text-[10px] font-bold text-error transition-all duration-100 hover:border-border/40 hover:bg-error/20"
            title={`${totalChanges} uncommitted change${totalChanges !== 1 ? "s" : ""}`}
            data-testid="git-changes-badge"
          >
            {totalChanges}
          </button>
        )}

        {/* Worktree count badge — only shown when multiple worktrees exist */}
        {worktrees.length > 1 && (
          <button
            onClick={() => setActiveView("git")}
            className="flex cursor-pointer items-center gap-1 border-[2px] border-border/20 bg-info/10 px-1.5 py-0 font-mono text-[10px] font-bold text-info transition-all duration-100 hover:border-border/40 hover:bg-info/20"
            title={`${worktrees.length} worktrees`}
            data-testid="git-worktree-count"
          >
            {/* Tree icon */}
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2" />
              <rect width="18" height="18" x="3" y="4" rx="2" />
              <circle cx="12" cy="10" r="2" />
              <line x1="8" y1="2" x2="8" y2="4" />
              <line x1="16" y1="2" x2="16" y2="4" />
            </svg>
            {worktrees.length}
          </button>
        )}
      </div>

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

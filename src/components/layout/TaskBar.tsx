/* Task bar — Cmd+K focused input with Claude Code options row for agent, model, and mode selection. */

import { useRef, useState, useEffect, useCallback } from "react";
import { Input } from "@/components/shared/Input";
import { DeployButton } from "@/components/shared/DeployButton";
import { useUiStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { useAppStore } from "@/stores/app";
import { useSessionStore } from "@/stores/session";
import { useTeamSession } from "@/hooks/useTeamSession";
import { TaskBarPickers } from "@/components/layout/TaskBarPickers";

/**
 * Command-K style task input bar with collapsible options row.
 * Focuses on Cmd+K keypress. Enter or clicking "Summon" starts the task.
 * When Claude agents are discovered, shows an options row with agent/model/mode pickers.
 */
export function TaskBar(): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [taskText, setTaskText] = useState("");
  const isFocused = useUiStore((s) => s.isTaskBarFocused);
  const setFocused = useUiStore((s) => s.setTaskBarFocused);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { analyzeAndDeploy, continueSession, stopSession, isSessionActive, isSessionCompleted, isPlanPreview } = useTeamSession();
  const claudeDiscovery = useAppStore((s) => s.claudeDiscovery);
  const isOptionsExpanded = useAppStore((s) => s.isOptionsExpanded);
  const setOptionsExpanded = useAppStore((s) => s.setOptionsExpanded);
  const selectedAgent = useAppStore((s) => s.selectedAgent);
  const selectedModel = useAppStore((s) => s.selectedModel);
  const selectedApprovalMode = useAppStore((s) => s.selectedApprovalMode);
  const forceTeamMode = useAppStore((s) => s.forceTeamMode);
  const appliedOptions = useSessionStore((s) => s.activeSession?.appliedOptions);

  const canDeploy = taskText.trim().length > 0 && activeProjectId !== null && !isSessionActive && !isPlanPreview;
  const canFollowUp = taskText.trim().length > 0 && isSessionCompleted;
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);
  /* Show options row for Claude Code when discovery finds a .claude dir, or always for Codex (which has its own controls) */
  const hasOptions = defaultRuntime === "codex" || (claudeDiscovery !== null && claudeDiscovery.claudeDirExists);

  /* During an active session, show the options that were applied at deploy time.
   * When idle, show the currently selected options for the next task. */
  const displayAgent = isSessionActive ? appliedOptions?.agent : selectedAgent?.slug;
  const displayModel = isSessionActive ? appliedOptions?.model : selectedModel;
  const displayPermission = isSessionActive ? appliedOptions?.permissionMode : selectedApprovalMode;
  const displayTeamMode = !isSessionActive && forceTeamMode;
  const hasActiveSelections = displayAgent != null || displayModel != null || displayPermission != null || displayTeamMode;

  const handleDeploy = useCallback(async (): Promise<void> => {
    /* Follow-up to a completed session */
    if (canFollowUp) {
      const message = taskText.trim();
      setTaskText("");
      inputRef.current?.blur();
      setFocused(false);
      await continueSession(message);
      return;
    }
    /* New task deployment */
    if (!canDeploy) return;
    const task = taskText.trim();
    setTaskText("");
    inputRef.current?.blur();
    setFocused(false);
    await analyzeAndDeploy(task);
  }, [canDeploy, canFollowUp, taskText, setFocused, analyzeAndDeploy, continueSession]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.metaKey && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setFocused(true);
      }
      if (event.key === "Escape") {
        inputRef.current?.blur();
        setFocused(false);
      }
    },
    [setFocused],
  );

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && (canDeploy || canFollowUp)) {
        event.preventDefault();
        void handleDeploy();
      }
    },
    [canDeploy, canFollowUp, handleDeploy],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={[
        "border-b-token-normal border-border transition-colors duration-100",
        isFocused ? "bg-accent-light" : "bg-surface-elevated",
      ].join(" ")}
    >
      {/* Main input row */}
      <div className="flex items-center gap-3 p-3">
        <Input
          ref={inputRef}
          value={taskText}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskText(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={
            !activeProjectId
              ? "Select a project first..."
              : isPlanPreview
                ? "Review the plan below... (Cmd+K)"
                : isSessionActive
                  ? "Elves are working... (Cmd+K)"
                  : isSessionCompleted
                    ? "Reply to continue the conversation... (Cmd+K)"
                    : "What do you want the elves to do? (Cmd+K)"
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={isSessionActive || isPlanPreview}
        />
        {isSessionActive ? (
          <button
            onClick={() => void stopSession()}
            className="shrink-0 cursor-pointer border-token-normal border-border bg-error px-4 py-2 font-display text-sm text-label text-white shadow-brutal-sm transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none rounded-token-md"
          >
            Stop
          </button>
        ) : isSessionCompleted ? (
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => void handleDeploy()}
              disabled={!canFollowUp}
              className={[
                "border-[3px] border-border px-4 py-2 font-display text-sm font-bold uppercase tracking-wider shadow-brutal-sm transition-all duration-100",
                canFollowUp
                  ? "cursor-pointer bg-info text-white hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                  : "cursor-not-allowed bg-gray-300 text-gray-500",
              ].join(" ")}
            >
              SEND
            </button>
            <button
              onClick={() => useSessionStore.getState().clearSession()}
              className="cursor-pointer border-[3px] border-border bg-white px-3 py-2 font-display text-sm font-bold uppercase tracking-wider shadow-brutal-sm transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
              title="End conversation and start fresh"
            >
              NEW
            </button>
          </div>
        ) : (
          <DeployButton onClick={() => void handleDeploy()} disabled={!canDeploy} />
        )}
      </div>

      {/* Options row — agent, model, mode pickers */}
      {hasOptions && (
        <div className="border-t-[2px] border-border/30 px-3 pb-2 pt-1">
          <div className="flex items-center justify-between">
            {isOptionsExpanded ? (
              <TaskBarPickers />
            ) : (
              <div className="flex items-center gap-2">
                {hasActiveSelections && (
                  <>
                    {displayAgent != null && (
                      <span className="border-token-thin border-border bg-info/20 px-2 py-0.5 font-mono text-xs font-bold rounded-token-sm">
                        {displayAgent}
                      </span>
                    )}
                    {displayModel != null && (
                      <span className="border-token-thin border-border bg-accent/30 px-2 py-0.5 font-mono text-xs font-bold rounded-token-sm">
                        {displayModel}
                      </span>
                    )}
                    {displayPermission != null && (
                      <span className="border-token-thin border-border bg-success/20 px-2 py-0.5 font-mono text-xs font-bold rounded-token-sm">
                        {displayPermission}
                      </span>
                    )}
                    {displayTeamMode && (
                      <span className="border-token-thin border-border bg-[#E0C3FC]/30 px-2 py-0.5 font-mono text-xs font-bold rounded-token-sm">
                        Team: ON
                      </span>
                    )}
                  </>
                )}
                {!hasActiveSelections && (
                  <span className="text-xs text-text-light/50">
                    {claudeDiscovery?.hasAgents
                      ? `${claudeDiscovery.agents.length} agent${claudeDiscovery.agents.length !== 1 ? "s" : ""} available`
                      : "Runtime options"}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={() => setOptionsExpanded(!isOptionsExpanded)}
              className="ml-2 shrink-0 cursor-pointer border-token-thin border-border bg-surface-elevated px-2 py-0.5 font-display text-[10px] text-label transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-surface-light rounded-token-sm"
            >
              {isOptionsExpanded ? "Less" : "More"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

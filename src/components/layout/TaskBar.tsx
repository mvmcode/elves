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
  const { analyzeAndDeploy, stopSession, isSessionActive, isPlanPreview } = useTeamSession();
  const claudeDiscovery = useAppStore((s) => s.claudeDiscovery);
  const isOptionsExpanded = useAppStore((s) => s.isOptionsExpanded);
  const setOptionsExpanded = useAppStore((s) => s.setOptionsExpanded);
  const selectedAgent = useAppStore((s) => s.selectedAgent);
  const selectedModel = useAppStore((s) => s.selectedModel);
  const selectedPermissionMode = useAppStore((s) => s.selectedPermissionMode);
  const forceTeamMode = useAppStore((s) => s.forceTeamMode);
  const appliedOptions = useSessionStore((s) => s.activeSession?.appliedOptions);

  const canDeploy = taskText.trim().length > 0 && activeProjectId !== null && !isSessionActive && !isPlanPreview;
  const hasOptions = claudeDiscovery !== null && claudeDiscovery.claudeDirExists;

  /* During an active session, show the options that were applied at deploy time.
   * When idle, show the currently selected options for the next task. */
  const displayAgent = isSessionActive ? appliedOptions?.agent : selectedAgent?.slug;
  const displayModel = isSessionActive ? appliedOptions?.model : selectedModel;
  const displayPermission = isSessionActive ? appliedOptions?.permissionMode : selectedPermissionMode;
  const displayTeamMode = !isSessionActive && forceTeamMode;
  const hasActiveSelections = displayAgent != null || displayModel != null || displayPermission != null || displayTeamMode;

  const handleDeploy = useCallback(async (): Promise<void> => {
    if (!canDeploy) return;
    const task = taskText.trim();
    setTaskText("");
    inputRef.current?.blur();
    setFocused(false);
    await analyzeAndDeploy(task);
  }, [canDeploy, taskText, setFocused, analyzeAndDeploy]);

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
      if (event.key === "Enter" && canDeploy) {
        event.preventDefault();
        void handleDeploy();
      }
    },
    [canDeploy, handleDeploy],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={[
        "border-b-[3px] border-border transition-colors duration-100",
        isFocused ? "bg-elf-gold-light" : "bg-white",
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
                  : "What do you want the elves to do? (Cmd+K)"
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={isSessionActive || isPlanPreview}
        />
        {isSessionActive ? (
          <button
            onClick={() => void stopSession()}
            className="shrink-0 cursor-pointer border-[3px] border-border bg-error px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-white shadow-brutal-sm transition-all duration-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            STOP
          </button>
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
                      <span className="border-[2px] border-border bg-info/20 px-2 py-0.5 font-mono text-xs font-bold">
                        {displayAgent}
                      </span>
                    )}
                    {displayModel != null && (
                      <span className="border-[2px] border-border bg-elf-gold/30 px-2 py-0.5 font-mono text-xs font-bold">
                        {displayModel}
                      </span>
                    )}
                    {displayPermission != null && (
                      <span className="border-[2px] border-border bg-success/20 px-2 py-0.5 font-mono text-xs font-bold">
                        {displayPermission}
                      </span>
                    )}
                    {displayTeamMode && (
                      <span className="border-[2px] border-border bg-[#E0C3FC]/30 px-2 py-0.5 font-mono text-xs font-bold">
                        Team: ON
                      </span>
                    )}
                  </>
                )}
                {!hasActiveSelections && (
                  <span className="text-xs text-text-light/50">
                    {claudeDiscovery.hasAgents
                      ? `${claudeDiscovery.agents.length} agent${claudeDiscovery.agents.length !== 1 ? "s" : ""} available`
                      : "Claude options"}
                  </span>
                )}
              </div>
            )}
            <button
              onClick={() => setOptionsExpanded(!isOptionsExpanded)}
              className="ml-2 shrink-0 cursor-pointer border-[2px] border-border bg-white px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-surface-light"
            >
              {isOptionsExpanded ? "LESS" : "MORE"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

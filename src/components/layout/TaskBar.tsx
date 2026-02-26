/* Task bar — Cmd+K focused input for typing task descriptions with summon action. */

import { useRef, useState, useEffect, useCallback } from "react";
import { Input } from "@/components/shared/Input";
import { DeployButton } from "@/components/shared/DeployButton";
import { useUiStore } from "@/stores/ui";
import { useProjectStore } from "@/stores/project";
import { useSession } from "@/hooks/useSession";

/**
 * Command-K style task input bar. Focuses on Cmd+K keypress.
 * Enter or clicking "Summon" starts the task on the active project.
 * Shows a stop button when a session is active.
 */
export function TaskBar(): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [taskText, setTaskText] = useState("");
  const isFocused = useUiStore((s) => s.isTaskBarFocused);
  const setFocused = useUiStore((s) => s.setTaskBarFocused);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const { deployTask, stopSession, isSessionActive } = useSession();

  const canDeploy = taskText.trim().length > 0 && activeProjectId !== null && !isSessionActive;

  const handleDeploy = useCallback(async (): Promise<void> => {
    if (!canDeploy) return;
    const task = taskText.trim();
    setTaskText("");
    inputRef.current?.blur();
    setFocused(false);
    await deployTask(task);
  }, [canDeploy, taskText, setFocused, deployTask]);

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
        "border-b-[3px] border-border p-3 transition-colors duration-100",
        isFocused ? "bg-elf-gold-light" : "bg-white",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <Input
          ref={inputRef}
          value={taskText}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTaskText(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={
            !activeProjectId
              ? "Select a project first..."
              : isSessionActive
                ? "Elves are working... (Cmd+K)"
                : "What do you want the elves to do? (Cmd+K)"
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={isSessionActive}
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
    </div>
  );
}

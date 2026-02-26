/* Task bar — Cmd+K focused input for typing task descriptions. */

import { useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/shared/Input";
import { useUiStore } from "@/stores/ui";

/**
 * Command-K style task input bar. Focuses on Cmd+K keypress.
 * Currently input-only — execution is wired in Phase 2.
 */
export function TaskBar(): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocused = useUiStore((s) => s.isTaskBarFocused);
  const setFocused = useUiStore((s) => s.setTaskBarFocused);

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

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className={[
        "border-b-[3px] border-border p-3 transition-colors duration-100",
        isFocused ? "bg-minion-yellow-light" : "bg-white",
      ].join(" ")}
    >
      <Input
        ref={inputRef}
        placeholder="What do you want the minions to do? (Cmd+K)"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

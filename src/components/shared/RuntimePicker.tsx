/* RuntimePicker — small toggle for selecting Claude Code vs Codex runtime. */

import { useState, useEffect, useCallback } from "react";
import type { Runtime } from "@/types/elf";

interface RuntimePickerProps {
  /** The currently selected runtime. */
  readonly value: Runtime;
  /** Callback when the runtime is changed. */
  readonly onChange: (runtime: Runtime) => void;
  /** Whether to show the compact (icon-only) variant. Default: false. */
  readonly compact?: boolean;
}

/** Runtime display metadata. */
const RUNTIME_META: Record<Runtime, { label: string; icon: string; color: string }> = {
  "claude-code": { label: "Claude Code", icon: "CC", color: "#A78BFA" },
  codex: { label: "Codex", icon: "CX", color: "#34D399" },
};

/**
 * Neo-brutalist runtime toggle for switching between Claude Code and Codex.
 * Compact mode shows just the icon badge; full mode shows both options as buttons.
 * Listens for Cmd+R to toggle the runtime.
 */
export function RuntimePicker({
  value,
  onChange,
  compact = false,
}: RuntimePickerProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  const toggleRuntime = useCallback((): void => {
    onChange(value === "claude-code" ? "codex" : "claude-code");
  }, [value, onChange]);

  /* Listen for Cmd+R to toggle runtime */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
        event.preventDefault();
        toggleRuntime();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleRuntime]);

  const currentMeta = RUNTIME_META[value];

  if (compact) {
    return (
      <button
        onClick={toggleRuntime}
        className="flex h-8 w-8 cursor-pointer items-center justify-center border-[2px] border-border font-mono text-xs font-black shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        style={{ backgroundColor: currentMeta.color }}
        title={`Runtime: ${currentMeta.label} (⌘R to switch)`}
        data-testid="runtime-picker-compact"
      >
        {currentMeta.icon}
      </button>
    );
  }

  return (
    <div className="relative" data-testid="runtime-picker">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex cursor-pointer items-center gap-2 border-[3px] border-border px-3 py-2 font-body text-sm font-bold shadow-brutal-sm transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
        style={{ backgroundColor: currentMeta.color }}
        data-testid="runtime-picker-button"
      >
        <span className="font-mono text-xs font-black">{currentMeta.icon}</span>
        <span>{currentMeta.label}</span>
        <span className="text-xs">▾</span>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full z-10 mt-1 w-full border-[3px] border-border bg-white shadow-brutal"
          data-testid="runtime-picker-dropdown"
        >
          {(["claude-code", "codex"] as const).map((runtime) => {
            const meta = RUNTIME_META[runtime];
            const isSelected = runtime === value;
            return (
              <button
                key={runtime}
                onClick={() => {
                  onChange(runtime);
                  setIsOpen(false);
                }}
                className={[
                  "flex w-full cursor-pointer items-center gap-2 border-b-[2px] border-border/20 px-3 py-2 text-left font-body text-sm font-bold last:border-b-0",
                  isSelected ? "bg-elf-gold-light" : "hover:bg-elf-gold-light/50",
                ].join(" ")}
                data-testid={`runtime-option-${runtime}`}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center border-[2px] border-border font-mono text-[10px] font-black"
                  style={{ backgroundColor: meta.color }}
                >
                  {meta.icon}
                </span>
                <span>{meta.label}</span>
                {isSelected && <span className="ml-auto">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

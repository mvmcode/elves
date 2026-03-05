/* The Summon the Elves split-button — primary action trigger with a chevron popover for runtime options. */

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "./Button";
import { useAppStore } from "@/stores/app";
import { getRuntimeControlConfig } from "@/lib/runtime-controls";
import type { ButtonHTMLAttributes } from "react";

type DeployButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
>;

/**
 * Split-button: the main "Summon the Elves" CTA on the left, a small chevron
 * trigger on the right. Clicking the chevron opens a popover with EffortPicker
 * and BudgetInput for quick per-session overrides. The main button fires onClick.
 */
export function DeployButton(props: DeployButtonProps): React.JSX.Element {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);
  const controlConfig = getRuntimeControlConfig(defaultRuntime);

  const selectedEffort = useAppStore((s) => s.selectedEffort);
  const setSelectedEffort = useAppStore((s) => s.setSelectedEffort);
  const budgetCap = useAppStore((s) => s.budgetCap);
  const setBudgetCap = useAppStore((s) => s.setBudgetCap);

  const hasOverrides = selectedEffort !== null || budgetCap !== null;

  /* Close popover on outside click */
  useEffect(() => {
    function handleClick(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleBudgetChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (value === "") {
        setBudgetCap(null);
        return;
      }
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed >= 0) {
        setBudgetCap(parsed);
      }
    },
    [setBudgetCap],
  );

  return (
    <div ref={containerRef} className="relative flex items-stretch">
      {/* Main deploy button */}
      <Button
        variant="primary"
        className="rounded-r-none px-4 py-2 font-display text-[11px] tracking-widest"
        {...props}
      >
        SUMMON
      </Button>

      {/* Chevron trigger */}
      <button
        type="button"
        onClick={() => setIsPopoverOpen(!isPopoverOpen)}
        className={[
          "cursor-pointer border-token-normal border-l-0 border-border bg-accent px-2 py-2 font-mono text-[10px] font-bold text-accent-contrast",
          "shadow-brutal transition-all duration-100 ease-out",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-brutal-sm",
          "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
          hasOverrides ? "bg-accent/80" : "",
        ].join(" ")}
        aria-label="Deploy options"
      >
        {isPopoverOpen ? "\u25B2" : "\u25BC"}
      </button>

      {/* Options popover */}
      {isPopoverOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[240px] border-token-normal border-border bg-surface-elevated p-4 shadow-brutal-sm">
          <h4 className="mb-3 font-display text-xs text-label tracking-wider">
            DEPLOY OPTIONS
          </h4>

          {/* Effort picker — only shown when runtime supports thinking */}
          {controlConfig.effortLevels.length > 0 && (
            <div className="mb-3">
              <label className="mb-1 block font-body text-xs font-bold text-text-muted-light">
                Thinking Effort
              </label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedEffort(null)}
                  className={[
                    "cursor-pointer border-token-thin border-border px-3 py-1 font-mono text-xs font-bold transition-all duration-100",
                    selectedEffort === null
                      ? "bg-accent text-accent-contrast shadow-[2px_2px_0px_0px_#000]"
                      : "bg-surface-elevated hover:bg-surface-light",
                  ].join(" ")}
                >
                  Auto
                </button>
                {controlConfig.effortLevels.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setSelectedEffort(level.id)}
                    className={[
                      "cursor-pointer border-token-thin border-border px-3 py-1 font-mono text-xs font-bold transition-all duration-100",
                      selectedEffort === level.id
                        ? "bg-accent text-accent-contrast shadow-[2px_2px_0px_0px_#000]"
                        : "bg-surface-elevated hover:bg-surface-light",
                    ].join(" ")}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Budget cap input */}
          <div>
            <label className="mb-1 block font-body text-xs font-bold text-text-muted-light">
              Budget Cap (USD)
            </label>
            <div className="flex items-center gap-1 border-token-thin border-border bg-white px-3 py-2">
              <span className="font-mono text-sm font-bold text-text-light/50">$</span>
              <input
                type="number"
                min={0}
                step={0.5}
                placeholder="No limit"
                value={budgetCap ?? ""}
                onChange={handleBudgetChange}
                className="w-full bg-transparent font-mono text-sm outline-none placeholder:text-text-light/30"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* MemorySettings — neo-brutalist settings panel for memory system configuration. */

import { useState, useCallback } from "react";
import { Button } from "@/components/shared/Button";
import { useSettingsStore } from "@/stores/settings";

interface MemorySettingsProps {
  /** Called when the user confirms clearing all memories */
  readonly onClearAll?: () => void;
  /** Called when the user clicks Export */
  readonly onExport?: () => void;
  /** Called when the user clicks Import */
  readonly onImport?: () => void;
}

/**
 * Settings panel for the memory system. Controls auto-learn toggle,
 * decay rate, capacity limits, and data management (clear/export/import).
 * All settings are persisted to localStorage via the settings store.
 */
export function MemorySettings({
  onClearAll,
  onExport,
  onImport,
}: MemorySettingsProps): React.JSX.Element {
  const {
    autoLearn,
    decayRate,
    maxMemoriesPerProject,
    maxContextInjection,
    setAutoLearn,
    setDecayRate,
    setMaxMemories,
    setMaxContextInjection,
  } = useSettingsStore();

  const [isClearConfirm, setIsClearConfirm] = useState(false);

  const handleClearConfirm = useCallback((): void => {
    setIsClearConfirm(false);
    onClearAll?.();
  }, [onClearAll]);

  const handleClearCancel = useCallback((): void => {
    setIsClearConfirm(false);
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="memory-settings">
      {/* Header */}
      <h2 className="font-display text-3xl font-bold uppercase tracking-wide">
        Memory Settings
      </h2>

      {/* Auto-learn toggle */}
      <div className="flex items-center justify-between border-[3px] border-border bg-white p-4 shadow-brutal-sm">
        <div>
          <span className="font-body text-sm font-bold">Auto-learn from sessions</span>
          <p className="font-body text-xs text-gray-500">
            Automatically extract and store memories after each task session.
          </p>
        </div>
        <button
          onClick={() => setAutoLearn(!autoLearn)}
          className={[
            "relative h-8 w-14 cursor-pointer border-[3px] border-border transition-colors duration-100",
            autoLearn ? "bg-elf-gold" : "bg-gray-200",
          ].join(" ")}
          role="switch"
          aria-checked={autoLearn}
          data-testid="auto-learn-toggle"
        >
          <div
            className={[
              "absolute top-0.5 h-5 w-5 border-[2px] border-border bg-white transition-transform duration-100",
              autoLearn ? "translate-x-6" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </div>

      {/* Decay rate dropdown */}
      <div className="flex items-center justify-between border-[3px] border-border bg-white p-4 shadow-brutal-sm">
        <div>
          <span className="font-body text-sm font-bold">Decay Rate</span>
          <p className="font-body text-xs text-gray-500">
            How quickly unused memories lose relevance.
          </p>
        </div>
        <select
          value={decayRate}
          onChange={(event) => setDecayRate(event.target.value as "slow" | "normal" | "fast")}
          className="border-[3px] border-border bg-white px-4 py-2 font-body text-sm font-bold uppercase tracking-wider outline-none"
          data-testid="decay-rate-select"
        >
          <option value="slow">Slow</option>
          <option value="normal">Normal</option>
          <option value="fast">Fast</option>
        </select>
      </div>

      {/* Max memories per project */}
      <div className="flex items-center justify-between border-[3px] border-border bg-white p-4 shadow-brutal-sm">
        <div>
          <span className="font-body text-sm font-bold">Max Memories Per Project</span>
          <p className="font-body text-xs text-gray-500">
            Upper limit on stored memories per project.
          </p>
        </div>
        <input
          type="number"
          value={maxMemoriesPerProject}
          onChange={(event) => setMaxMemories(Number(event.target.value))}
          min={10}
          max={10000}
          className="w-24 border-[3px] border-border bg-white px-3 py-2 text-right font-mono text-sm outline-none focus:shadow-[4px_4px_0px_0px_#FFD93D]"
          data-testid="max-memories-input"
        />
      </div>

      {/* Max context injection */}
      <div className="flex items-center justify-between border-[3px] border-border bg-white p-4 shadow-brutal-sm">
        <div>
          <span className="font-body text-sm font-bold">Max Context Injection</span>
          <p className="font-body text-xs text-gray-500">
            How many memories to inject into agent context per task.
          </p>
        </div>
        <input
          type="number"
          value={maxContextInjection}
          onChange={(event) => setMaxContextInjection(Number(event.target.value))}
          min={1}
          max={100}
          className="w-24 border-[3px] border-border bg-white px-3 py-2 text-right font-mono text-sm outline-none focus:shadow-[4px_4px_0px_0px_#FFD93D]"
          data-testid="max-context-input"
        />
      </div>

      {/* Data management buttons */}
      <div className="flex flex-col gap-3 pt-2">
        <h3 className="font-display text-sm font-bold uppercase tracking-wider text-gray-500">
          Data Management
        </h3>
        <div className="flex flex-wrap gap-3">
          {isClearConfirm ? (
            <div
              className="flex items-center gap-3 border-[3px] border-error bg-white p-3"
              data-testid="clear-confirm"
            >
              <span className="font-body text-sm font-bold text-error">
                Delete all memories? This cannot be undone.
              </span>
              <button
                onClick={handleClearConfirm}
                className="cursor-pointer border-[2px] border-border bg-error px-4 py-2 font-body text-sm font-bold text-white transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px]"
                data-testid="clear-confirm-yes"
              >
                Yes, Clear All
              </button>
              <button
                onClick={handleClearCancel}
                className="cursor-pointer border-[2px] border-border bg-white px-4 py-2 font-body text-sm font-bold text-text-light transition-all duration-100 hover:translate-x-[1px] hover:translate-y-[1px]"
                data-testid="clear-confirm-no"
              >
                Cancel
              </button>
            </div>
          ) : (
            <Button
              variant="danger"
              onClick={() => setIsClearConfirm(true)}
              data-testid="clear-all-button"
            >
              Clear All Memories
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => onExport?.()}
            data-testid="export-button"
          >
            Export Memories
          </Button>
          <Button
            variant="secondary"
            onClick={() => onImport?.()}
            data-testid="import-button"
          >
            Import Memories
          </Button>
        </div>
      </div>
    </div>
  );
}

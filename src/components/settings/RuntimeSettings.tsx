/* RuntimeSettings — default runtime preferences for model, mode, effort, budget, and system prompt. */

import { useCallback } from "react";
import { useSettingsStore } from "@/stores/settings";
import { useAppStore } from "@/stores/app";
import { getRuntimeControlConfig } from "@/lib/runtime-controls";

/**
 * Settings panel for runtime defaults. These values are used as fallbacks
 * when per-session overrides are not set in the app store.
 * All settings are persisted to localStorage via the settings store.
 */
export function RuntimeSettings(): React.JSX.Element {
  const defaultRuntime = useAppStore((s) => s.defaultRuntime);
  const controlConfig = getRuntimeControlConfig(defaultRuntime);

  const defaultModel = useSettingsStore((s) => s.defaultModel);
  const setDefaultModel = useSettingsStore((s) => s.setDefaultModel);
  const defaultPermissionMode = useSettingsStore((s) => s.defaultPermissionMode);
  const setDefaultPermissionMode = useSettingsStore((s) => s.setDefaultPermissionMode);
  const defaultEffort = useSettingsStore((s) => s.defaultEffort);
  const setDefaultEffort = useSettingsStore((s) => s.setDefaultEffort);
  const defaultBudgetCap = useSettingsStore((s) => s.defaultBudgetCap);
  const setDefaultBudgetCap = useSettingsStore((s) => s.setDefaultBudgetCap);
  const customSystemPrompt = useSettingsStore((s) => s.customSystemPrompt);
  const setCustomSystemPrompt = useSettingsStore((s) => s.setCustomSystemPrompt);

  const handleBudgetChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      if (value === "") {
        setDefaultBudgetCap(null);
        return;
      }
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed >= 0) {
        setDefaultBudgetCap(parsed);
      }
    },
    [setDefaultBudgetCap],
  );

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="runtime-settings">
      <h2 className="font-display text-3xl text-heading">
        Runtime Defaults
      </h2>
      <p className="font-body text-sm text-text-muted">
        These are used as fallbacks when per-session overrides are not set.
      </p>

      {/* Default model */}
      <SettingsRow
        label="Default Model"
        description="Model used for new sessions when no per-session override is set."
      >
        <select
          value={defaultModel ?? ""}
          onChange={(event) => setDefaultModel(event.target.value || null)}
          className="border-token-normal border-border bg-surface-elevated rounded-token-md px-4 py-2 font-mono text-sm outline-none"
          data-testid="default-model-select"
        >
          <option value="">Auto (runtime default)</option>
          {controlConfig.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label}
            </option>
          ))}
        </select>
      </SettingsRow>

      {/* Default permission mode */}
      <SettingsRow
        label="Default Permission Mode"
        description="Approval mode used when no per-session override is set."
      >
        <select
          value={defaultPermissionMode ?? ""}
          onChange={(event) => setDefaultPermissionMode(event.target.value || null)}
          className="border-token-normal border-border bg-surface-elevated rounded-token-md px-4 py-2 font-mono text-sm outline-none"
          data-testid="default-permission-mode-select"
        >
          <option value="">Auto (runtime default)</option>
          {controlConfig.approvalModes.map((mode) => (
            <option key={mode.id} value={mode.id}>
              {mode.label}
            </option>
          ))}
        </select>
      </SettingsRow>

      {/* Default effort — only shown when runtime supports thinking */}
      {controlConfig.effortLevels.length > 0 && (
        <SettingsRow
          label="Default Thinking Effort"
          description="Effort/thinking level used when no per-session override is set."
        >
          <select
            value={defaultEffort ?? ""}
            onChange={(event) => setDefaultEffort(event.target.value || null)}
            className="border-token-normal border-border bg-surface-elevated rounded-token-md px-4 py-2 font-mono text-sm outline-none"
            data-testid="default-effort-select"
          >
            <option value="">Auto (runtime default)</option>
            {controlConfig.effortLevels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.label}
              </option>
            ))}
          </select>
        </SettingsRow>
      )}

      {/* Default budget cap */}
      <SettingsRow
        label="Default Budget Cap"
        description="Per-session spending limit in USD. Leave empty for no limit."
      >
        <div className="flex items-center gap-1 border-token-normal border-border bg-surface-elevated rounded-token-md px-3 py-2">
          <span className="font-mono text-sm font-bold text-text-light/50">$</span>
          <input
            type="number"
            min={0}
            step={0.5}
            placeholder="No limit"
            value={defaultBudgetCap ?? ""}
            onChange={handleBudgetChange}
            className="w-24 bg-transparent text-right font-mono text-sm outline-none placeholder:text-text-light/30"
            data-testid="default-budget-input"
          />
        </div>
      </SettingsRow>

      {/* Custom system prompt */}
      <div className="flex flex-col gap-2 border-token-normal border-border bg-surface-elevated rounded-token-md p-4 shadow-brutal-sm">
        <div>
          <span className="font-body text-sm font-bold">Custom System Prompt</span>
          <p className="font-body text-xs text-text-muted-light">
            Appended to every agent invocation. Use for project-wide instructions.
          </p>
        </div>
        <textarea
          value={customSystemPrompt}
          onChange={(event) => setCustomSystemPrompt(event.target.value)}
          placeholder="e.g., Always use TypeScript strict mode. Follow our coding style guide."
          rows={4}
          className="border-token-normal border-border bg-white rounded-token-md px-4 py-3 font-mono text-sm outline-none placeholder:text-text-light/30 focus:shadow-[4px_4px_0px_0px_#FFD93D]"
          data-testid="custom-system-prompt"
        />
      </div>
    </div>
  );
}

/** Reusable settings row with label on the left and control on the right. */
function SettingsRow(props: {
  readonly label: string;
  readonly description: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between border-token-normal border-border bg-surface-elevated rounded-token-md p-4 shadow-brutal-sm">
      <div>
        <span className="font-body text-sm font-bold">{props.label}</span>
        <p className="font-body text-xs text-text-muted-light">{props.description}</p>
      </div>
      {props.children}
    </div>
  );
}

/* SettingsView — tabbed settings panel with Appearance, Runtime Defaults, Memory, and Advanced tabs. */

import { useState, useCallback } from "react";
import ThemePicker from "@/components/settings/ThemePicker";
import { RuntimeSettings } from "@/components/settings/RuntimeSettings";
import { MemorySettings } from "@/components/settings/MemorySettings";
import { useSettingsStore } from "@/stores/settings";

type SettingsTab = "appearance" | "runtime" | "memory" | "advanced";

interface TabDefinition {
  readonly id: SettingsTab;
  readonly label: string;
}

const TABS: readonly TabDefinition[] = [
  { id: "appearance", label: "Appearance" },
  { id: "runtime", label: "Runtime Defaults" },
  { id: "memory", label: "Memory" },
  { id: "advanced", label: "Advanced" },
] as const;

interface SettingsViewProps {
  /** Called when the user confirms clearing all memories */
  readonly onClearAll?: () => void;
  /** Called when the user clicks Export */
  readonly onExport?: () => void;
  /** Called when the user clicks Import */
  readonly onImport?: () => void;
}

/**
 * Tabbed settings panel. Each tab renders a specialized settings component.
 * Uses neo-brutalist styling: thick tab borders, hard shadows, bold typography.
 */
export function SettingsView({
  onClearAll,
  onExport,
  onImport,
}: SettingsViewProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  const handleTabClick = useCallback((tab: SettingsTab) => {
    setActiveTab(tab);
  }, []);

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="settings-view">
      {/* Tab bar */}
      <div className="flex border-b-token-normal border-border bg-surface-elevated">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab.id)}
            className={[
              "cursor-pointer border-b-[3px] px-6 py-3 font-display text-xs text-label tracking-wider transition-all duration-100",
              activeTab === tab.id
                ? "border-accent bg-surface-light font-bold"
                : "border-transparent hover:bg-surface-light/50",
            ].join(" ")}
            data-testid={`settings-tab-${tab.id}`}
          >
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "appearance" && <ThemePicker />}
        {activeTab === "runtime" && <RuntimeSettings />}
        {activeTab === "memory" && (
          <MemorySettings
            onClearAll={onClearAll}
            onExport={onExport}
            onImport={onImport}
          />
        )}
        {activeTab === "advanced" && <AdvancedSettings />}
      </div>
    </div>
  );
}

/** Advanced settings — sound controls and other miscellaneous preferences. */
function AdvancedSettings(): React.JSX.Element {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);
  const soundVolume = useSettingsStore((s) => s.soundVolume);
  const setSoundVolume = useSettingsStore((s) => s.setSoundVolume);

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="advanced-settings">
      <h2 className="font-display text-3xl text-heading">
        Advanced
      </h2>

      {/* Sound toggle */}
      <div className="flex items-center justify-between border-token-normal border-border bg-surface-elevated rounded-token-md p-4 shadow-brutal-sm">
        <div>
          <span className="font-body text-sm font-bold">Sound Effects</span>
          <p className="font-body text-xs text-text-muted-light">
            Play sounds for deploy, completion, and other events.
          </p>
        </div>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={[
            "relative h-8 w-14 cursor-pointer border-token-normal border-border transition-colors duration-100",
            soundEnabled ? "bg-accent" : "bg-surface-muted",
          ].join(" ")}
          role="switch"
          aria-checked={soundEnabled}
          data-testid="sound-toggle"
        >
          <div
            className={[
              "absolute top-0.5 h-5 w-5 border-token-thin border-border bg-white transition-transform duration-100",
              soundEnabled ? "translate-x-6" : "translate-x-0.5",
            ].join(" ")}
          />
        </button>
      </div>

      {/* Sound volume */}
      {soundEnabled && (
        <div className="flex items-center justify-between border-token-normal border-border bg-surface-elevated rounded-token-md p-4 shadow-brutal-sm">
          <div>
            <span className="font-body text-sm font-bold">Volume</span>
            <p className="font-body text-xs text-text-muted-light">
              Adjust sound effect volume.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={soundVolume}
              onChange={(event) => setSoundVolume(parseFloat(event.target.value))}
              className="w-24 accent-accent"
              data-testid="sound-volume-slider"
            />
            <span className="w-8 text-right font-mono text-xs font-bold">
              {Math.round(soundVolume * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

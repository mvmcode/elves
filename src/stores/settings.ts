/* Settings store — persisted user preferences for memory, sound, and general app behavior. */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeName = "neo-brutalist" | "modern";
type DecayRate = "slow" | "normal" | "fast";

interface SettingsState {
  /** Whether to automatically extract memories from completed sessions */
  readonly autoLearn: boolean;
  /** Memory relevance decay speed */
  readonly decayRate: DecayRate;
  /** Maximum number of memories stored per project */
  readonly maxMemoriesPerProject: number;
  /** Maximum number of memories injected into agent context per task */
  readonly maxContextInjection: number;
  /** Active UI theme */
  readonly theme: ThemeName;
  /** Whether sound effects are enabled */
  readonly soundEnabled: boolean;
  /** Sound effect volume (0.0 to 1.0) */
  readonly soundVolume: number;

  /** Default model for new sessions (null = use runtime/agent default) */
  readonly defaultModel: string | null;
  /** Default permission/approval mode (null = use runtime default) */
  readonly defaultPermissionMode: string | null;
  /** Default effort/thinking level (null = use runtime default) */
  readonly defaultEffort: string | null;
  /** Default per-session budget cap in USD (null = no cap) */
  readonly defaultBudgetCap: number | null;
  /** Custom system prompt appended to every agent invocation */
  readonly customSystemPrompt: string;

  /** Set the active theme and apply it to the document */
  setTheme: (theme: ThemeName) => void;
  /** Toggle auto-learn on or off */
  setAutoLearn: (enabled: boolean) => void;
  /** Set the decay rate */
  setDecayRate: (rate: DecayRate) => void;
  /** Set the max memories per project limit */
  setMaxMemories: (max: number) => void;
  /** Set the max context injection count */
  setMaxContextInjection: (max: number) => void;
  /** Toggle sound effects on or off */
  setSoundEnabled: (enabled: boolean) => void;
  /** Set the sound volume (0.0 to 1.0) */
  setSoundVolume: (volume: number) => void;
  /** Set the default model */
  setDefaultModel: (model: string | null) => void;
  /** Set the default permission mode */
  setDefaultPermissionMode: (mode: string | null) => void;
  /** Set the default effort level */
  setDefaultEffort: (effort: string | null) => void;
  /** Set the default budget cap */
  setDefaultBudgetCap: (cap: number | null) => void;
  /** Set the custom system prompt */
  setCustomSystemPrompt: (prompt: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoLearn: true,
      decayRate: "normal",
      maxMemoriesPerProject: 500,
      maxContextInjection: 20,
      theme: "neo-brutalist",
      soundEnabled: true,
      soundVolume: 0.5,

      defaultModel: null,
      defaultPermissionMode: null,
      defaultEffort: null,
      defaultBudgetCap: null,
      customSystemPrompt: "",

      setTheme: (theme: ThemeName) => {
        document.documentElement.setAttribute("data-theme", theme);
        set({ theme });
      },
      setAutoLearn: (autoLearn: boolean) => set({ autoLearn }),
      setDecayRate: (decayRate: DecayRate) => set({ decayRate }),
      setMaxMemories: (maxMemoriesPerProject: number) => set({ maxMemoriesPerProject }),
      setMaxContextInjection: (maxContextInjection: number) => set({ maxContextInjection }),
      setSoundEnabled: (soundEnabled: boolean) => set({ soundEnabled }),
      setSoundVolume: (soundVolume: number) => set({ soundVolume: Math.max(0, Math.min(1, soundVolume)) }),
      setDefaultModel: (defaultModel: string | null) => set({ defaultModel }),
      setDefaultPermissionMode: (defaultPermissionMode: string | null) => set({ defaultPermissionMode }),
      setDefaultEffort: (defaultEffort: string | null) => set({ defaultEffort }),
      setDefaultBudgetCap: (defaultBudgetCap: number | null) => set({ defaultBudgetCap }),
      setCustomSystemPrompt: (customSystemPrompt: string) => set({ customSystemPrompt }),
    }),
    {
      name: "elves-settings",
    },
  ),
);

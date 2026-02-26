/* Settings store — persisted user preferences for memory, sound, and general app behavior. */

import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  /** Whether sound effects are enabled */
  readonly soundEnabled: boolean;
  /** Sound effect volume (0.0 to 1.0) */
  readonly soundVolume: number;

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
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoLearn: true,
      decayRate: "normal",
      maxMemoriesPerProject: 500,
      maxContextInjection: 20,
      soundEnabled: true,
      soundVolume: 0.5,

      setAutoLearn: (autoLearn: boolean) => set({ autoLearn }),
      setDecayRate: (decayRate: DecayRate) => set({ decayRate }),
      setMaxMemories: (maxMemoriesPerProject: number) => set({ maxMemoriesPerProject }),
      setMaxContextInjection: (maxContextInjection: number) => set({ maxContextInjection }),
      setSoundEnabled: (soundEnabled: boolean) => set({ soundEnabled }),
      setSoundVolume: (soundVolume: number) => set({ soundVolume: Math.max(0, Math.min(1, soundVolume)) }),
    }),
    {
      name: "elves-settings",
    },
  ),
);

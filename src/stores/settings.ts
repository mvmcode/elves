/* Settings store — persisted user preferences for the memory system. */

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

  /** Toggle auto-learn on or off */
  setAutoLearn: (enabled: boolean) => void;
  /** Set the decay rate */
  setDecayRate: (rate: DecayRate) => void;
  /** Set the max memories per project limit */
  setMaxMemories: (max: number) => void;
  /** Set the max context injection count */
  setMaxContextInjection: (max: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoLearn: true,
      decayRate: "normal",
      maxMemoriesPerProject: 500,
      maxContextInjection: 20,

      setAutoLearn: (autoLearn: boolean) => set({ autoLearn }),
      setDecayRate: (decayRate: DecayRate) => set({ decayRate }),
      setMaxMemories: (maxMemoriesPerProject: number) => set({ maxMemoriesPerProject }),
      setMaxContextInjection: (maxContextInjection: number) => set({ maxContextInjection }),
    }),
    {
      name: "elves-settings",
    },
  ),
);

/* Sound hook — provides a play function that reads enabled/volume from the settings store. */

import { useCallback, useEffect } from "react";
import { useSettingsStore } from "@/stores/settings";
import {
  playSound,
  setSoundEnabled,
  setSoundVolume,
  type SoundName,
} from "@/lib/sounds";

interface UseSoundsResult {
  /** Play a named sound effect. Respects current settings. */
  readonly play: (name: SoundName) => void;
}

/**
 * React hook that syncs sound engine settings with the Zustand settings store
 * and returns a play function for triggering sound effects.
 */
export function useSounds(): UseSoundsResult {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const soundVolume = useSettingsStore((s) => s.soundVolume);

  /* Sync store settings to the sound engine module whenever they change */
  useEffect(() => {
    setSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    setSoundVolume(soundVolume);
  }, [soundVolume]);

  const play = useCallback((name: SoundName): void => {
    playSound(name);
  }, []);

  return { play };
}

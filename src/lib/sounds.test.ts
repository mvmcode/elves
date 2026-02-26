/* Tests for the sound engine — verifies all sound names exist and play functions don't throw. */

import { describe, it, expect, beforeEach } from "vitest";
import {
  playSound,
  setSoundEnabled,
  setSoundVolume,
  isSoundEnabled,
  getSoundVolume,
  ALL_SOUND_NAMES,
  type SoundName,
} from "./sounds";

describe("Sound Engine", () => {
  beforeEach(() => {
    setSoundEnabled(true);
    setSoundVolume(0.5);
  });

  it("defines all expected sound names", () => {
    const expected: readonly SoundName[] = ["spawn", "typing", "complete", "error", "chat", "deploy"];
    expect(ALL_SOUND_NAMES).toEqual(expected);
  });

  it("has exactly 6 sound names", () => {
    expect(ALL_SOUND_NAMES.length).toBe(6);
  });

  it("does not throw when playing any sound (even without AudioContext in jsdom)", () => {
    for (const name of ALL_SOUND_NAMES) {
      expect(() => playSound(name)).not.toThrow();
    }
  });

  it("does not throw when sounds are disabled", () => {
    setSoundEnabled(false);
    for (const name of ALL_SOUND_NAMES) {
      expect(() => playSound(name)).not.toThrow();
    }
  });

  it("tracks enabled state correctly", () => {
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
  });

  it("tracks volume correctly", () => {
    expect(getSoundVolume()).toBe(0.5);
    setSoundVolume(0.8);
    expect(getSoundVolume()).toBe(0.8);
  });

  it("clamps volume to 0-1 range", () => {
    setSoundVolume(-0.5);
    expect(getSoundVolume()).toBe(0);
    setSoundVolume(1.5);
    expect(getSoundVolume()).toBe(1);
  });

  it("does not throw at volume extremes", () => {
    setSoundVolume(0);
    expect(() => playSound("spawn")).not.toThrow();
    setSoundVolume(1);
    expect(() => playSound("spawn")).not.toThrow();
  });
});

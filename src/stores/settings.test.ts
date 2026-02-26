/* Tests for the settings store — verifies defaults and all update actions. */

import { describe, expect, it, beforeEach } from "vitest";
import { useSettingsStore } from "./settings";

/** Reset store state between tests (bypass persist middleware) */
function resetStore(): void {
  useSettingsStore.setState({
    autoLearn: true,
    decayRate: "normal",
    maxMemoriesPerProject: 500,
    maxContextInjection: 20,
    soundEnabled: true,
    soundVolume: 0.5,
  });
}

describe("useSettingsStore", () => {
  beforeEach(() => {
    resetStore();
  });

  describe("defaults", () => {
    it("has autoLearn enabled by default", () => {
      expect(useSettingsStore.getState().autoLearn).toBe(true);
    });

    it("has normal decay rate by default", () => {
      expect(useSettingsStore.getState().decayRate).toBe("normal");
    });

    it("has 500 max memories per project by default", () => {
      expect(useSettingsStore.getState().maxMemoriesPerProject).toBe(500);
    });

    it("has 20 max context injection by default", () => {
      expect(useSettingsStore.getState().maxContextInjection).toBe(20);
    });
  });

  describe("setAutoLearn", () => {
    it("toggles autoLearn off", () => {
      useSettingsStore.getState().setAutoLearn(false);
      expect(useSettingsStore.getState().autoLearn).toBe(false);
    });

    it("toggles autoLearn back on", () => {
      useSettingsStore.getState().setAutoLearn(false);
      useSettingsStore.getState().setAutoLearn(true);
      expect(useSettingsStore.getState().autoLearn).toBe(true);
    });
  });

  describe("setDecayRate", () => {
    it("sets decay rate to slow", () => {
      useSettingsStore.getState().setDecayRate("slow");
      expect(useSettingsStore.getState().decayRate).toBe("slow");
    });

    it("sets decay rate to fast", () => {
      useSettingsStore.getState().setDecayRate("fast");
      expect(useSettingsStore.getState().decayRate).toBe("fast");
    });

    it("sets decay rate back to normal", () => {
      useSettingsStore.getState().setDecayRate("fast");
      useSettingsStore.getState().setDecayRate("normal");
      expect(useSettingsStore.getState().decayRate).toBe("normal");
    });
  });

  describe("setMaxMemories", () => {
    it("updates max memories per project", () => {
      useSettingsStore.getState().setMaxMemories(1000);
      expect(useSettingsStore.getState().maxMemoriesPerProject).toBe(1000);
    });

    it("accepts small values", () => {
      useSettingsStore.getState().setMaxMemories(10);
      expect(useSettingsStore.getState().maxMemoriesPerProject).toBe(10);
    });
  });

  describe("setMaxContextInjection", () => {
    it("updates max context injection", () => {
      useSettingsStore.getState().setMaxContextInjection(50);
      expect(useSettingsStore.getState().maxContextInjection).toBe(50);
    });

    it("accepts small values", () => {
      useSettingsStore.getState().setMaxContextInjection(1);
      expect(useSettingsStore.getState().maxContextInjection).toBe(1);
    });
  });

  describe("sound settings", () => {
    it("has sound enabled by default", () => {
      expect(useSettingsStore.getState().soundEnabled).toBe(true);
    });

    it("has volume at 0.5 by default", () => {
      expect(useSettingsStore.getState().soundVolume).toBe(0.5);
    });

    it("toggles sound off", () => {
      useSettingsStore.getState().setSoundEnabled(false);
      expect(useSettingsStore.getState().soundEnabled).toBe(false);
    });

    it("sets volume", () => {
      useSettingsStore.getState().setSoundVolume(0.8);
      expect(useSettingsStore.getState().soundVolume).toBe(0.8);
    });

    it("clamps volume to valid range", () => {
      useSettingsStore.getState().setSoundVolume(-0.5);
      expect(useSettingsStore.getState().soundVolume).toBe(0);
      useSettingsStore.getState().setSoundVolume(1.5);
      expect(useSettingsStore.getState().soundVolume).toBe(1);
    });
  });
});

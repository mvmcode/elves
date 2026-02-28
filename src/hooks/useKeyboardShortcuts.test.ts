/* Tests for keyboard shortcuts hook — verifies shortcut definitions and export shape. */

import { describe, it, expect } from "vitest";
import { SHORTCUT_DEFINITIONS } from "./useKeyboardShortcuts";

describe("SHORTCUT_DEFINITIONS", () => {
  it("has at least 13 shortcuts defined", () => {
    expect(SHORTCUT_DEFINITIONS.length).toBeGreaterThanOrEqual(13);
  });

  it("each shortcut has keys and description", () => {
    for (const shortcut of SHORTCUT_DEFINITIONS) {
      expect(shortcut.keys).toBeTruthy();
      expect(typeof shortcut.keys).toBe("string");
      expect(shortcut.description).toBeTruthy();
      expect(typeof shortcut.description).toBe("string");
    }
  });

  it("contains the Cmd+K shortcut", () => {
    const cmdK = SHORTCUT_DEFINITIONS.find((s) => s.keys.includes("K"));
    expect(cmdK).toBeDefined();
    expect(cmdK?.description).toContain("task bar");
  });

  it("contains the Escape shortcut", () => {
    const esc = SHORTCUT_DEFINITIONS.find((s) => s.keys === "Escape");
    expect(esc).toBeDefined();
  });

  it("has no duplicate keys", () => {
    const keys = SHORTCUT_DEFINITIONS.map((s) => s.keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("contains floor management shortcuts", () => {
    const newFloor = SHORTCUT_DEFINITIONS.find((s) => s.keys.includes("T"));
    expect(newFloor).toBeDefined();
    expect(newFloor?.description).toContain("floor");

    const closeFloor = SHORTCUT_DEFINITIONS.find((s) => s.keys.includes("W"));
    expect(closeFloor).toBeDefined();
    expect(closeFloor?.description).toContain("floor");

    const nextFloor = SHORTCUT_DEFINITIONS.find((s) => s.keys.includes("]"));
    expect(nextFloor).toBeDefined();
    expect(nextFloor?.description).toContain("floor");

    const prevFloor = SHORTCUT_DEFINITIONS.find((s) => s.keys.includes("["));
    expect(prevFloor).toBeDefined();
    expect(prevFloor?.description).toContain("floor");
  });

  it("contains terminal toggle shortcut", () => {
    const terminal = SHORTCUT_DEFINITIONS.find((s) => s.keys.includes("`"));
    expect(terminal).toBeDefined();
    expect(terminal?.description).toContain("terminal");
  });
});

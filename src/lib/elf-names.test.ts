/* Tests for the elf personality engine — name generation, status messages, avatars, and colors. */

import { describe, expect, it } from "vitest";
import { generateElf, getAvatar, getColor, getStatusMessage } from "./elf-names";
import type { ElfStatus } from "@/types/elf";

const ALL_STATUSES: readonly ElfStatus[] = [
  "spawning", "working", "thinking", "waiting",
  "chatting", "done", "error", "sleeping",
] as const;

describe("generateElf", () => {
  it("returns a personality with all required fields", () => {
    const personality = generateElf();
    expect(personality.name).toBeTruthy();
    expect(personality.avatar).toBeTruthy();
    expect(personality.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(personality.quirk).toBeTruthy();
  });

  it("does not return a name already in use", () => {
    const usedNames = ["Spark", "Tinker", "Jingle"];
    for (let i = 0; i < 20; i++) {
      const personality = generateElf(usedNames);
      expect(usedNames).not.toContain(personality.name);
    }
  });

  it("generates unique names across sequential calls", () => {
    const names: string[] = [];
    for (let i = 0; i < 15; i++) {
      const personality = generateElf(names);
      expect(names).not.toContain(personality.name);
      names.push(personality.name);
    }
    expect(new Set(names).size).toBe(15);
  });

  it("wraps around with numeric suffix when all base names are exhausted", () => {
    const allNames = [
      "Spark", "Tinker", "Jingle", "Sprocket", "Nimble", "Flicker", "Bramble", "Thistle",
      "Cobalt", "Pip", "Fern", "Maple", "Cricket", "Rune", "Ember",
    ];
    const personality = generateElf(allNames);
    expect(personality.name).toMatch(/^.+ \d+$/);
    expect(personality.avatar).toBeTruthy();
    expect(personality.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("handles empty usedNames array", () => {
    const personality = generateElf([]);
    expect(personality.name).toBeTruthy();
  });
});

describe("getStatusMessage", () => {
  it("returns a string containing the elf name", () => {
    const message = getStatusMessage("Spark", "working");
    expect(message).toContain("Spark");
  });

  it("returns a non-empty string for every status", () => {
    for (const status of ALL_STATUSES) {
      const message = getStatusMessage("Tinker", status);
      expect(message).toBeTruthy();
      expect(message).toContain("Tinker");
    }
  });

  it("does not contain unreplaced template variables", () => {
    for (const status of ALL_STATUSES) {
      const message = getStatusMessage("Jingle", status);
      expect(message).not.toContain("{name}");
    }
  });

  it("works with suffixed names", () => {
    const message = getStatusMessage("Spark 2", "thinking");
    expect(message).toContain("Spark 2");
  });
});

describe("getAvatar", () => {
  it("returns an emoji for a known elf name", () => {
    const avatar = getAvatar("Spark");
    expect(avatar).toBeTruthy();
    expect(typeof avatar).toBe("string");
  });

  it("returns correct avatar for first elf", () => {
    expect(getAvatar("Spark")).toBe("⚡");
  });

  it("returns base avatar for suffixed names", () => {
    expect(getAvatar("Spark 2")).toBe(getAvatar("Spark"));
  });

  it("returns fallback emoji for unknown names", () => {
    expect(getAvatar("Unknown Agent")).toBe("🤖");
  });
});

describe("getColor", () => {
  it("returns a hex color for a known elf name", () => {
    const color = getColor("Spark");
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("returns correct color for first elf", () => {
    expect(getColor("Spark")).toBe("#FFD93D");
  });

  it("returns base color for suffixed names", () => {
    expect(getColor("Spark 2")).toBe(getColor("Spark"));
  });

  it("returns fallback color for unknown names", () => {
    expect(getColor("Unknown Agent")).toBe("#FFD93D");
  });

  it("returns distinct colors for different elves", () => {
    const colors = new Set([
      getColor("Spark"), getColor("Tinker"), getColor("Jingle"),
      getColor("Sprocket"), getColor("Nimble"),
    ]);
    expect(colors.size).toBe(5);
  });
});

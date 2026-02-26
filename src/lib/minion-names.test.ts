/* Tests for the minion personality engine — name generation, status messages, avatars, and colors. */

import { describe, expect, it } from "vitest";
import { generateMinion, getAvatar, getColor, getStatusMessage } from "./minion-names";
import type { MinionStatus } from "@/types/minion";

const ALL_STATUSES: readonly MinionStatus[] = [
  "spawning", "working", "thinking", "waiting",
  "chatting", "done", "error", "sleeping",
] as const;

describe("generateMinion", () => {
  it("returns a personality with all required fields", () => {
    const personality = generateMinion();
    expect(personality.name).toBeTruthy();
    expect(personality.avatar).toBeTruthy();
    expect(personality.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(personality.quirk).toBeTruthy();
  });

  it("does not return a name already in use", () => {
    const usedNames = ["Kevin", "Stuart", "Bob"];
    for (let i = 0; i < 20; i++) {
      const personality = generateMinion(usedNames);
      expect(usedNames).not.toContain(personality.name);
    }
  });

  it("generates unique names across sequential calls", () => {
    const names: string[] = [];
    for (let i = 0; i < 15; i++) {
      const personality = generateMinion(names);
      expect(names).not.toContain(personality.name);
      names.push(personality.name);
    }
    expect(new Set(names).size).toBe(15);
  });

  it("wraps around with numeric suffix when all base names are exhausted", () => {
    const allNames = [
      "Gru Jr.", "Kevin", "Stuart", "Bob", "Otto", "Dave", "Jerry", "Phil",
      "Norbert", "Jorge", "Carl", "Tim", "Mark", "Lance", "Steve",
    ];
    const personality = generateMinion(allNames);
    expect(personality.name).toMatch(/^.+ \d+$/);
    expect(personality.avatar).toBeTruthy();
    expect(personality.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("handles empty usedNames array", () => {
    const personality = generateMinion([]);
    expect(personality.name).toBeTruthy();
  });
});

describe("getStatusMessage", () => {
  it("returns a string containing the minion name", () => {
    const message = getStatusMessage("Kevin", "working");
    expect(message).toContain("Kevin");
  });

  it("returns a non-empty string for every status", () => {
    for (const status of ALL_STATUSES) {
      const message = getStatusMessage("Bob", status);
      expect(message).toBeTruthy();
      expect(message).toContain("Bob");
    }
  });

  it("does not contain unreplaced template variables", () => {
    for (const status of ALL_STATUSES) {
      const message = getStatusMessage("Stuart", status);
      expect(message).not.toContain("{name}");
    }
  });

  it("works with suffixed names", () => {
    const message = getStatusMessage("Kevin 2", "thinking");
    expect(message).toContain("Kevin 2");
  });
});

describe("getAvatar", () => {
  it("returns an emoji for a known minion name", () => {
    const avatar = getAvatar("Kevin");
    expect(avatar).toBeTruthy();
    expect(typeof avatar).toBe("string");
  });

  it("returns correct avatar for first minion", () => {
    expect(getAvatar("Gru Jr.")).toBe("👷");
  });

  it("returns base avatar for suffixed names", () => {
    expect(getAvatar("Kevin 2")).toBe(getAvatar("Kevin"));
  });

  it("returns fallback emoji for unknown names", () => {
    expect(getAvatar("Unknown Agent")).toBe("🤖");
  });
});

describe("getColor", () => {
  it("returns a hex color for a known minion name", () => {
    const color = getColor("Kevin");
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("returns correct color for first minion", () => {
    expect(getColor("Gru Jr.")).toBe("#FFD93D");
  });

  it("returns base color for suffixed names", () => {
    expect(getColor("Kevin 2")).toBe(getColor("Kevin"));
  });

  it("returns fallback color for unknown names", () => {
    expect(getColor("Unknown Agent")).toBe("#FFD93D");
  });

  it("returns distinct colors for different minions", () => {
    const colors = new Set([
      getColor("Gru Jr."), getColor("Kevin"), getColor("Stuart"),
      getColor("Bob"), getColor("Otto"),
    ]);
    expect(colors.size).toBe(5);
  });
});

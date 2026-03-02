/* Tests for PtyAgentDetector — verifies ANSI stripping, agent detection, and role extraction. */

import { describe, it, expect, beforeEach } from "vitest";
import { PtyAgentDetector, stripAnsi } from "./pty-agent-detector";

describe("stripAnsi", () => {
  it("removes CSI color codes", () => {
    expect(stripAnsi("\x1b[32mhello\x1b[0m")).toBe("hello");
  });

  it("removes CSI cursor movement", () => {
    expect(stripAnsi("\x1b[2Ahello\x1b[K")).toBe("hello");
  });

  it("removes OSC sequences terminated by BEL", () => {
    expect(stripAnsi("\x1b]0;title\x07content")).toBe("content");
  });

  it("removes carriage returns", () => {
    expect(stripAnsi("line1\rline2")).toBe("line1line2");
  });

  it("preserves normal text", () => {
    expect(stripAnsi("plain text")).toBe("plain text");
  });

  it("handles multiple escape sequences in one string", () => {
    expect(stripAnsi("\x1b[1m\x1b[33mBOLD YELLOW\x1b[0m")).toBe("BOLD YELLOW");
  });
});

describe("PtyAgentDetector", () => {
  let detector: PtyAgentDetector;

  beforeEach(() => {
    detector = new PtyAgentDetector();
  });

  it("returns empty array for plain text", () => {
    const result = detector.feed("Hello world\n");
    expect(result).toEqual([]);
  });

  it("detects 'Agent tool' header", () => {
    const result = detector.feed("⏳ Agent tool\n");
    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe("Agent");
  });

  it("detects bordered Agent header", () => {
    const result = detector.feed("─── Agent ───\n");
    expect(result).toHaveLength(1);
  });

  it("detects 'Spawning agent' message", () => {
    const result = detector.feed("Spawning agent to explore the codebase\n");
    expect(result).toHaveLength(1);
    expect(result[0]!.description).toContain("explore the codebase");
  });

  it("detects 'Launching a new agent' message", () => {
    const result = detector.feed("Launching a new agent to fix the bug\n");
    expect(result).toHaveLength(1);
    expect(result[0]!.description).toContain("fix the bug");
  });

  it("detects Agent(type) pattern and extracts role", () => {
    const result = detector.feed("Agent (Explore)\n");
    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe("Explore");
  });

  it("detects Agent(general-purpose) with hyphenated role", () => {
    const result = detector.feed("Agent (general-purpose)\n");
    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe("general-purpose");
  });

  it("detects 'Using the Agent tool' phrasing", () => {
    const result = detector.feed("Using the Agent tool to research\n");
    expect(result).toHaveLength(1);
  });

  it("detects 'Spawning teammate' message", () => {
    const result = detector.feed("Spawning a teammate for implementation\n");
    expect(result).toHaveLength(1);
  });

  it("increments agent count for each detection", () => {
    detector.feed("⏳ Agent tool\n");
    detector.feed("⏳ Agent tool\n");
    detector.feed("⏳ Agent tool\n");
    expect(detector.totalDetected).toBe(3);
  });

  it("assigns sequential IDs", () => {
    const first = detector.feed("⏳ Agent tool\n");
    const second = detector.feed("Agent (Explore)\n");
    expect(first[0]!.id).toBe("pty-agent-1");
    expect(second[0]!.id).toBe("pty-agent-2");
  });

  it("handles chunks split across lines", () => {
    /* First chunk ends mid-line */
    const result1 = detector.feed("⏳ Agent ");
    expect(result1).toEqual([]);

    /* Second chunk completes the line */
    const result2 = detector.feed("tool\n");
    expect(result2).toHaveLength(1);
  });

  it("handles ANSI codes in Agent tool output", () => {
    const result = detector.feed("\x1b[33m⏳ Agent tool\x1b[0m\n");
    expect(result).toHaveLength(1);
  });

  it("extracts role from subagent_type field in context", () => {
    detector.feed('subagent_type: "Explore"\n');
    const result = detector.feed("⏳ Agent tool\n");
    expect(result).toHaveLength(1);
    expect(result[0]!.role).toBe("Explore");
  });

  it("extracts description from description field", () => {
    detector.feed('description: "Find all API endpoints"\n');
    const result = detector.feed("⏳ Agent tool\n");
    expect(result).toHaveLength(1);
    expect(result[0]!.description).toBe("Find all API endpoints");
  });

  it("falls back to generic description when none found", () => {
    const result = detector.feed("⏳ Agent tool\n");
    expect(result[0]!.description).toBe("Agent task #1");
  });

  it("does not detect 'agent' in normal sentences", () => {
    const result = detector.feed("The user agent string is important\n");
    expect(result).toEqual([]);
  });

  it("does not detect 'agent' in code comments", () => {
    const result = detector.feed("// This agent handles requests\n");
    expect(result).toEqual([]);
  });

  it("resets state cleanly", () => {
    detector.feed("⏳ Agent tool\n");
    expect(detector.totalDetected).toBe(1);
    detector.reset();
    expect(detector.totalDetected).toBe(0);
    const result = detector.feed("⏳ Agent tool\n");
    expect(result[0]!.id).toBe("pty-agent-1");
  });

  it("detects multiple agents in a single chunk", () => {
    const result = detector.feed(
      "⏳ Agent tool\nSome output\nAgent (Explore)\n",
    );
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("pty-agent-1");
    expect(result[1]!.id).toBe("pty-agent-2");
    expect(result[1]!.role).toBe("Explore");
  });

  it("handles empty input", () => {
    expect(detector.feed("")).toEqual([]);
  });

  it("handles input with only newlines", () => {
    expect(detector.feed("\n\n\n")).toEqual([]);
  });
});

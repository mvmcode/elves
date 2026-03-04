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

  it("returns empty agents array for plain text", () => {
    const { agents } = detector.feed("Hello world\n");
    expect(agents).toEqual([]);
  });

  it("detects 'Agent tool' header", () => {
    const { agents } = detector.feed("⏳ Agent tool\n");
    expect(agents).toHaveLength(1);
    expect(agents[0]!.role).toBe("Agent");
  });

  it("detects bordered Agent header", () => {
    const { agents } = detector.feed("─── Agent ───\n");
    expect(agents).toHaveLength(1);
  });

  it("detects 'Spawning agent' message", () => {
    const { agents } = detector.feed("Spawning agent to explore the codebase\n");
    expect(agents).toHaveLength(1);
    expect(agents[0]!.description).toContain("explore the codebase");
  });

  it("detects 'Launching a new agent' message", () => {
    const { agents } = detector.feed("Launching a new agent to fix the bug\n");
    expect(agents).toHaveLength(1);
    expect(agents[0]!.description).toContain("fix the bug");
  });

  it("detects Agent(type) pattern and extracts role", () => {
    const { agents } = detector.feed("Agent (Explore)\n");
    expect(agents).toHaveLength(1);
    expect(agents[0]!.role).toBe("Explore");
  });

  it("detects Agent(general-purpose) with hyphenated role", () => {
    const { agents } = detector.feed("Agent (general-purpose)\n");
    expect(agents).toHaveLength(1);
    expect(agents[0]!.role).toBe("general-purpose");
  });

  it("detects 'Using the Agent tool' phrasing", () => {
    const { agents } = detector.feed("Using the Agent tool to research\n");
    expect(agents).toHaveLength(1);
  });

  it("detects 'Spawning teammate' message", () => {
    const { agents } = detector.feed("Spawning a teammate for implementation\n");
    expect(agents).toHaveLength(1);
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
    expect(first.agents[0]!.id).toBe("pty-agent-1");
    expect(second.agents[0]!.id).toBe("pty-agent-2");
  });

  it("handles chunks split across lines", () => {
    /* First chunk ends mid-line */
    const result1 = detector.feed("⏳ Agent ");
    expect(result1.agents).toEqual([]);

    /* Second chunk completes the line */
    const result2 = detector.feed("tool\n");
    expect(result2.agents).toHaveLength(1);
  });

  it("handles ANSI codes in Agent tool output", () => {
    const { agents } = detector.feed("\x1b[33m⏳ Agent tool\x1b[0m\n");
    expect(agents).toHaveLength(1);
  });

  it("extracts role from subagent_type field in context", () => {
    detector.feed('subagent_type: "Explore"\n');
    const { agents } = detector.feed("⏳ Agent tool\n");
    expect(agents).toHaveLength(1);
    expect(agents[0]!.role).toBe("Explore");
  });

  it("extracts description from description field", () => {
    detector.feed('description: "Find all API endpoints"\n');
    const { agents } = detector.feed("⏳ Agent tool\n");
    expect(agents).toHaveLength(1);
    expect(agents[0]!.description).toBe("Find all API endpoints");
  });

  it("falls back to generic description when none found", () => {
    const { agents } = detector.feed("⏳ Agent tool\n");
    expect(agents[0]!.description).toBe("Agent task #1");
  });

  it("does not detect 'agent' in normal sentences", () => {
    const { agents } = detector.feed("The user agent string is important\n");
    expect(agents).toEqual([]);
  });

  it("does not detect 'agent' in code comments", () => {
    const { agents } = detector.feed("// This agent handles requests\n");
    expect(agents).toEqual([]);
  });

  it("resets state cleanly", () => {
    detector.feed("⏳ Agent tool\n");
    expect(detector.totalDetected).toBe(1);
    detector.reset();
    expect(detector.totalDetected).toBe(0);
    const { agents } = detector.feed("⏳ Agent tool\n");
    expect(agents[0]!.id).toBe("pty-agent-1");
  });

  it("detects multiple agents in a single chunk", () => {
    const { agents } = detector.feed(
      "⏳ Agent tool\nSome output\nAgent (Explore)\n",
    );
    expect(agents).toHaveLength(2);
    expect(agents[0]!.id).toBe("pty-agent-1");
    expect(agents[1]!.id).toBe("pty-agent-2");
    expect(agents[1]!.role).toBe("Explore");
  });

  it("handles empty input", () => {
    const { agents } = detector.feed("");
    expect(agents).toEqual([]);
  });

  it("handles input with only newlines", () => {
    const { agents } = detector.feed("\n\n\n");
    expect(agents).toEqual([]);
  });
});

describe("PtyAgentDetector — permission detection", () => {
  let detector: PtyAgentDetector;

  beforeEach(() => {
    detector = new PtyAgentDetector();
  });

  it("detects simple Allow ToolName? prompt", () => {
    const { permissions } = detector.feed('Allow Edit? (Y)es/(N)o\n');
    expect(permissions).toHaveLength(1);
    expect(permissions[0]!.tool).toBe("Edit");
  });

  it("detects Allow with description in parens", () => {
    const { permissions } = detector.feed('Allow Bash("npm test")? (Y)es/(N)o\n');
    expect(permissions).toHaveLength(1);
    expect(permissions[0]!.tool).toBe("Bash");
    expect(permissions[0]!.description).toBe("npm test");
  });

  it("does not false-positive on normal text containing Allow", () => {
    const { permissions } = detector.feed("We should allow users to edit files\n");
    expect(permissions).toEqual([]);
  });

  it("assigns sequential permission IDs", () => {
    const first = detector.feed('Allow Edit? (Y)es\n');
    const second = detector.feed('Allow Bash("ls")? (Y)es\n');
    expect(first.permissions[0]!.id).toBe("pty-perm-1");
    expect(second.permissions[0]!.id).toBe("pty-perm-2");
  });
});

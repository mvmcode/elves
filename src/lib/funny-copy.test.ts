/* Tests for the funny copy engine — verifies all contexts return valid messages. */

import { describe, it, expect } from "vitest";
import {
  getEmptyState,
  getLoadingMessage,
  getErrorMessage,
  type EmptyContext,
  type LoadingPhase,
} from "./funny-copy";

const ALL_EMPTY_CONTEXTS: readonly EmptyContext[] = [
  "no-projects",
  "no-sessions",
  "no-memory",
  "no-skills",
  "no-mcp",
  "no-templates",
  "loading-app",
  "deploying",
  "analyzing-task",
  "extracting-memory",
  "runtime-not-found",
] as const;

const ALL_LOADING_PHASES: readonly LoadingPhase[] = [
  "app-init",
  "project-load",
  "session-start",
  "agent-spawn",
  "memory-fetch",
  "memory-extract",
  "task-analyze",
] as const;

describe("getEmptyState", () => {
  it.each(ALL_EMPTY_CONTEXTS)("returns a valid message for context '%s'", (context) => {
    const result = getEmptyState(context);
    expect(result.title).toBeTruthy();
    expect(typeof result.title).toBe("string");
    expect(result.subtitle).toBeTruthy();
    expect(typeof result.subtitle).toBe("string");
    expect(result.emoji).toBeTruthy();
    expect(typeof result.emoji).toBe("string");
  });

  it("returns different messages across multiple calls (random selection)", () => {
    const titles = new Set<string>();
    for (let i = 0; i < 50; i++) {
      titles.add(getEmptyState("no-projects").title);
    }
    /* With 3+ messages in the pool and 50 attempts, we should see at least 2 different titles */
    expect(titles.size).toBeGreaterThanOrEqual(2);
  });
});

describe("getLoadingMessage", () => {
  it.each(ALL_LOADING_PHASES)("returns a non-empty string for phase '%s'", (phase) => {
    const message = getLoadingMessage(phase);
    expect(message).toBeTruthy();
    expect(typeof message).toBe("string");
  });

  it("returns different messages across multiple calls", () => {
    const messages = new Set<string>();
    for (let i = 0; i < 50; i++) {
      messages.add(getLoadingMessage("app-init"));
    }
    expect(messages.size).toBeGreaterThanOrEqual(2);
  });
});

describe("getErrorMessage", () => {
  it("returns a non-empty string without error detail", () => {
    const message = getErrorMessage();
    expect(message).toBeTruthy();
    expect(typeof message).toBe("string");
  });

  it("appends error detail in parentheses when provided", () => {
    const message = getErrorMessage("Connection refused");
    expect(message).toContain("(Connection refused)");
  });

  it("returns different messages across multiple calls", () => {
    const messages = new Set<string>();
    for (let i = 0; i < 50; i++) {
      messages.add(getErrorMessage());
    }
    expect(messages.size).toBeGreaterThanOrEqual(2);
  });
});

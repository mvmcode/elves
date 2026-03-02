/* Tests for prompt-classifier — verifies yes/no vs text_input classification. */

import { describe, it, expect } from "vitest";
import { classifyPromptType } from "./prompt-classifier";

describe("classifyPromptType", () => {
  it("returns text_input for empty string", () => {
    expect(classifyPromptType("")).toBe("text_input");
  });

  it("returns text_input for whitespace-only string", () => {
    expect(classifyPromptType("   ")).toBe("text_input");
  });

  it("returns yes_no for 'Should I proceed with the changes?'", () => {
    expect(classifyPromptType("Should I proceed with the changes?")).toBe("yes_no");
  });

  it("returns yes_no for 'Would you like me to apply this fix?'", () => {
    expect(classifyPromptType("Would you like me to apply this fix?")).toBe("yes_no");
  });

  it("returns yes_no for 'Do you want me to continue?'", () => {
    expect(classifyPromptType("Do you want me to continue?")).toBe("yes_no");
  });

  it("returns yes_no for 'Can I proceed with the refactor?'", () => {
    expect(classifyPromptType("Can I proceed with the refactor?")).toBe("yes_no");
  });

  it("returns text_input for 'What file should I modify?'", () => {
    expect(classifyPromptType("What file should I modify?")).toBe("text_input");
  });

  it("returns text_input for 'Which approach do you prefer?'", () => {
    expect(classifyPromptType("Which approach do you prefer?")).toBe("text_input");
  });

  it("returns text_input for 'How should I handle the error case?'", () => {
    expect(classifyPromptType("How should I handle the error case?")).toBe("text_input");
  });

  it("returns text_input for multi-question text with multiple ? marks", () => {
    const text = "I found two issues. Should I fix both? Or just the first one?";
    expect(classifyPromptType(text)).toBe("text_input");
  });

  it("returns text_input for 'Please provide the API key'", () => {
    expect(classifyPromptType("Please provide the API key")).toBe("text_input");
  });

  it("returns text_input for 'Please specify which database to use'", () => {
    expect(classifyPromptType("Please specify which database to use")).toBe("text_input");
  });

  it("returns yes_no for short question without commas ending in ?", () => {
    expect(classifyPromptType("Is this correct?")).toBe("yes_no");
  });

  it("returns text_input for long ambiguous text without clear patterns", () => {
    const text =
      "I've analyzed the codebase and found several potential improvements. " +
      "The refactoring would touch 15 files across 3 modules. " +
      "Let me know your thoughts on the best path forward.";
    expect(classifyPromptType(text)).toBe("text_input");
  });

  it("classifies based on the last ~300 chars for long text", () => {
    const longPrefix = "x".repeat(500);
    const tail = "Shall I apply this change?";
    expect(classifyPromptType(longPrefix + tail)).toBe("yes_no");
  });

  it("returns yes_no for 'Go ahead with the deployment?'", () => {
    expect(classifyPromptType("Go ahead with the deployment?")).toBe("yes_no");
  });

  it("prioritizes text_input patterns over yes_no for mixed signals", () => {
    const text = "What changes should I make? Should I proceed?";
    /* Multiple ? marks → text_input (rule 1 fires first) */
    expect(classifyPromptType(text)).toBe("text_input");
  });
});

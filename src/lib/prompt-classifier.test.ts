/* Tests for prompt-classifier — verifies yes/no, multiple_choice, and text_input classification. */

import { describe, it, expect } from "vitest";
import { classifyPromptType } from "./prompt-classifier";

describe("classifyPromptType", () => {
  it("returns text_input for empty string", () => {
    expect(classifyPromptType("")).toEqual({ type: "text_input" });
  });

  it("returns text_input for whitespace-only string", () => {
    expect(classifyPromptType("   ")).toEqual({ type: "text_input" });
  });

  it("returns yes_no for 'Should I proceed with the changes?'", () => {
    expect(classifyPromptType("Should I proceed with the changes?")).toEqual({ type: "yes_no" });
  });

  it("returns yes_no for 'Would you like me to apply this fix?'", () => {
    expect(classifyPromptType("Would you like me to apply this fix?")).toEqual({ type: "yes_no" });
  });

  it("returns yes_no for 'Do you want me to continue?'", () => {
    expect(classifyPromptType("Do you want me to continue?")).toEqual({ type: "yes_no" });
  });

  it("returns yes_no for 'Can I proceed with the refactor?'", () => {
    expect(classifyPromptType("Can I proceed with the refactor?")).toEqual({ type: "yes_no" });
  });

  it("returns text_input for 'What file should I modify?'", () => {
    expect(classifyPromptType("What file should I modify?")).toEqual({ type: "text_input" });
  });

  it("returns text_input for 'Which approach do you prefer?'", () => {
    expect(classifyPromptType("Which approach do you prefer?")).toEqual({ type: "text_input" });
  });

  it("returns text_input for 'How should I handle the error case?'", () => {
    expect(classifyPromptType("How should I handle the error case?")).toEqual({ type: "text_input" });
  });

  it("returns text_input for multi-question text with multiple ? marks", () => {
    const text = "I found two issues. Should I fix both? Or just the first one?";
    expect(classifyPromptType(text)).toEqual({ type: "text_input" });
  });

  it("returns text_input for 'Please provide the API key'", () => {
    expect(classifyPromptType("Please provide the API key")).toEqual({ type: "text_input" });
  });

  it("returns text_input for 'Please specify which database to use'", () => {
    expect(classifyPromptType("Please specify which database to use")).toEqual({ type: "text_input" });
  });

  it("returns yes_no for short question without commas ending in ?", () => {
    expect(classifyPromptType("Is this correct?")).toEqual({ type: "yes_no" });
  });

  it("returns text_input for long ambiguous text without clear patterns", () => {
    const text =
      "I've analyzed the codebase and found several potential improvements. " +
      "The refactoring would touch 15 files across 3 modules. " +
      "Let me know your thoughts on the best path forward.";
    expect(classifyPromptType(text)).toEqual({ type: "text_input" });
  });

  it("classifies based on the last ~300 chars for long text", () => {
    const longPrefix = "x".repeat(500);
    const tail = "Shall I apply this change?";
    expect(classifyPromptType(longPrefix + tail)).toEqual({ type: "yes_no" });
  });

  it("returns yes_no for 'Go ahead with the deployment?'", () => {
    expect(classifyPromptType("Go ahead with the deployment?")).toEqual({ type: "yes_no" });
  });

  it("prioritizes text_input patterns over yes_no for mixed signals", () => {
    const text = "What changes should I make? Should I proceed?";
    /* Multiple ? marks → text_input (rule 1 fires first) */
    expect(classifyPromptType(text)).toEqual({ type: "text_input" });
  });

  /* Multiple choice tests */
  it("returns multiple_choice for numbered list with 1. 2. format", () => {
    const text = "Which option do you prefer?\n1. Use Redux\n2. Use Zustand\n3. Use Context API";
    const result = classifyPromptType(text);
    expect(result.type).toBe("multiple_choice");
    expect(result.options).toEqual(["Use Redux", "Use Zustand", "Use Context API"]);
  });

  it("returns multiple_choice for parenthesized numbered list", () => {
    const text = "Choose a database:\n(1) PostgreSQL\n(2) SQLite\n(3) MySQL";
    const result = classifyPromptType(text);
    expect(result.type).toBe("multiple_choice");
    expect(result.options).toEqual(["PostgreSQL", "SQLite", "MySQL"]);
  });

  it("returns multiple_choice for lettered list with (a) (b) format", () => {
    const text = "Pick one:\n(a) Option Alpha\n(b) Option Beta";
    const result = classifyPromptType(text);
    expect(result.type).toBe("multiple_choice");
    expect(result.options).toEqual(["Option Alpha", "Option Beta"]);
  });

  it("does not return multiple_choice for a single numbered item", () => {
    const text = "I have one suggestion:\n1. Refactor the module";
    expect(classifyPromptType(text).type).not.toBe("multiple_choice");
  });

  it("returns multiple_choice for 2) 3) format", () => {
    const text = "Choose:\n1) First approach\n2) Second approach";
    const result = classifyPromptType(text);
    expect(result.type).toBe("multiple_choice");
    expect(result.options).toEqual(["First approach", "Second approach"]);
  });
});

/* simple-diff.test — unit tests for generateUnifiedDiff. */

import { describe, it, expect } from "vitest";
import { generateUnifiedDiff } from "./simple-diff";

describe("generateUnifiedDiff", () => {
  it("returns empty string for identical inputs", () => {
    const text = "line one\nline two\nline three";
    expect(generateUnifiedDiff(text, text, "file.md")).toBe("");
  });

  it("returns empty string for two empty strings", () => {
    expect(generateUnifiedDiff("", "", "file.md")).toBe("");
  });

  it("produces addition lines when going from empty to content", () => {
    const diff = generateUnifiedDiff("", "hello\nworld", "file.md");
    expect(diff).toContain("--- file.md");
    expect(diff).toContain("+++ file.md");
    expect(diff).toContain("+hello");
    expect(diff).toContain("+world");
    /* No deletion lines — only the --- header and addition lines */
    expect(diff).not.toMatch(/^-[^-]/m);
  });

  it("produces deletion lines when going from content to empty", () => {
    const diff = generateUnifiedDiff("hello\nworld", "", "file.md");
    expect(diff).toContain("-hello");
    expect(diff).toContain("-world");
    expect(diff).not.toMatch(/^\+[^+]/m);
  });

  it("marks changed lines as deletion + addition", () => {
    const diff = generateUnifiedDiff("foo\nbar\nbaz", "foo\nQUX\nbaz", "file.md");
    expect(diff).toContain("-bar");
    expect(diff).toContain("+QUX");
    /* Unchanged lines appear as context */
    expect(diff).toContain(" foo");
    expect(diff).toContain(" baz");
  });

  it("includes the filename in the diff header", () => {
    const diff = generateUnifiedDiff("a", "b", "context.md");
    expect(diff).toContain("--- context.md");
    expect(diff).toContain("+++ context.md");
  });

  it("handles mixed additions and deletions across multiple hunks", () => {
    const original = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");
    const modified = original.replace("line 2", "LINE TWO").replace("line 18", "LINE EIGHTEEN");
    const diff = generateUnifiedDiff(original, modified, "file.md");
    expect(diff).toContain("-line 2");
    expect(diff).toContain("+LINE TWO");
    expect(diff).toContain("-line 18");
    expect(diff).toContain("+LINE EIGHTEEN");
    /* Two separate hunks should produce two @@ markers */
    const hunkCount = (diff.match(/^@@/gm) ?? []).length;
    expect(hunkCount).toBe(2);
  });
});

/* Tests for EventBlock — verifies rendering for each event type and variant. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EventBlock } from "./EventBlock";
import type { ElfEvent } from "@/types/elf";

/** Factory for a test event. */
function createEvent(overrides?: Partial<ElfEvent>): ElfEvent {
  return {
    id: "event-1",
    timestamp: Date.now(),
    elfId: "elf-1",
    elfName: "Spark",
    runtime: "claude-code",
    type: "thinking",
    payload: {},
    ...overrides,
  };
}

describe("EventBlock", () => {
  it("renders thinking event with italic text", () => {
    const event = createEvent({ type: "thinking", payload: { text: "Analyzing the bug..." } });
    render(<EventBlock event={event} variant="terminal" />);
    const block = screen.getByTestId("event-block");
    expect(block.getAttribute("data-event-type")).toBe("thinking");
    expect(block.textContent).toContain("Analyzing the bug...");
  });

  it("shows collapsible toggle for long thinking text", () => {
    const longText = "A".repeat(200);
    const event = createEvent({ type: "thinking", payload: { text: longText } });
    render(<EventBlock event={event} variant="terminal" />);
    expect(screen.getByTestId("thinking-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("thinking-toggle").textContent).toBe("Show reasoning...");
  });

  it("expands thinking text on toggle click", () => {
    const longText = "A".repeat(200);
    const event = createEvent({ type: "thinking", payload: { text: longText } });
    render(<EventBlock event={event} variant="terminal" />);
    fireEvent.click(screen.getByTestId("thinking-toggle"));
    expect(screen.getByTestId("thinking-toggle").textContent).toBe("Hide");
  });

  it("renders tool_call with pill badge", () => {
    const event = createEvent({
      type: "tool_call",
      payload: { tool: "read_file", input: { file_path: "/src/index.ts" } },
    });
    render(<EventBlock event={event} variant="terminal" />);
    expect(screen.getByTestId("tool-pill")).toBeInTheDocument();
    expect(screen.getByTestId("tool-pill").textContent).toBe("read_file");
    expect(screen.getByTestId("event-block").textContent).toContain("/src/index.ts");
  });

  it("renders tool_result with green text", () => {
    const event = createEvent({ type: "tool_result", payload: { result: "File content here" } });
    render(<EventBlock event={event} variant="terminal" />);
    const block = screen.getByTestId("event-block");
    expect(block.getAttribute("data-event-type")).toBe("tool_result");
    expect(block.textContent).toContain("File content here");
  });

  it("renders multiline tool_result collapsed with toggle for terminal variant", () => {
    const event = createEvent({ type: "tool_result", payload: { result: "line1\nline2\nline3" } });
    render(<EventBlock event={event} variant="terminal" />);
    /* Collapsed by default — no <pre>, toggle visible */
    expect(screen.getByTestId("event-block").querySelector("pre")).toBeNull();
    expect(screen.getByTestId("result-toggle")).toBeInTheDocument();
  });

  it("renders output event with white text", () => {
    const event = createEvent({ type: "output", payload: { text: "Processing..." } });
    render(<EventBlock event={event} variant="terminal" />);
    expect(screen.getByTestId("event-block").textContent).toContain("Processing...");
  });

  it("renders final output with green bold text", () => {
    const event = createEvent({ type: "output", payload: { text: "Done!", isFinal: true } });
    render(<EventBlock event={event} variant="terminal" />);
    const block = screen.getByTestId("event-block");
    expect(block.getAttribute("data-event-type")).toBe("output");
    const p = block.querySelector("p");
    expect(p?.className).toContain("font-bold");
    expect(p?.className).toContain("text-green-400");
  });

  it("renders error event with red bold text", () => {
    const event = createEvent({ type: "error", payload: { message: "Something broke" } });
    render(<EventBlock event={event} variant="terminal" />);
    const block = screen.getByTestId("event-block");
    expect(block.getAttribute("data-event-type")).toBe("error");
    expect(block.textContent).toContain("Something broke");
  });

  it("renders spawn event as compact single-line with emoji", () => {
    const event = createEvent({ type: "spawn", payload: { role: "Lead" } });
    render(<EventBlock event={event} variant="terminal" />);
    expect(screen.getByTestId("event-block").textContent).toContain("Spark spawned as Lead");
  });

  it("renders chat event as compact single-line", () => {
    const event = createEvent({ type: "chat", payload: { message: "Hey team!" } });
    render(<EventBlock event={event} variant="terminal" />);
    expect(screen.getByTestId("event-block").textContent).toContain("Spark: Hey team!");
  });

  it("uses compact variant with truncation", () => {
    const longText = "X".repeat(300);
    const event = createEvent({ type: "tool_result", payload: { result: longText } });
    render(<EventBlock event={event} variant="compact" />);
    const block = screen.getByTestId("event-block");
    /* Compact truncates at 120 chars */
    expect(block.textContent!.length).toBeLessThan(300);
  });

  it("collapses multiline tool_result by default", () => {
    const multiline = "line1\nline2\nline3\nline4\nline5";
    const event = createEvent({ type: "tool_result", payload: { result: multiline } });
    render(<EventBlock event={event} variant="terminal" />);
    expect(screen.getByTestId("result-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("result-toggle").textContent).toBe("Show output");
    /* Full multiline content should not be visible when collapsed */
    expect(screen.getByTestId("event-block").querySelector("pre")).toBeNull();
  });

  it("expands tool_result on toggle click", () => {
    const multiline = "line1\nline2\nline3\nline4\nline5";
    const event = createEvent({ type: "tool_result", payload: { result: multiline } });
    render(<EventBlock event={event} variant="terminal" />);
    fireEvent.click(screen.getByTestId("result-toggle"));
    expect(screen.getByTestId("result-toggle").textContent).toBe("Hide output");
    expect(screen.getByTestId("event-block").querySelector("pre")).toBeTruthy();
  });

  it("shows short tool_result inline without toggle", () => {
    const shortResult = "OK";
    const event = createEvent({ type: "tool_result", payload: { result: shortResult } });
    render(<EventBlock event={event} variant="terminal" />);
    expect(screen.getByTestId("event-block").textContent).toContain("OK");
    expect(screen.queryByTestId("result-toggle")).toBeNull();
  });
});

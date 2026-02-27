/* Tests for TerminalOutput — verifies auto-scroll, event count, empty state, and overflow. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TerminalOutput } from "./TerminalOutput";
import type { ElfEvent } from "@/types/elf";

/** Factory for test events. */
function createEvents(count: number): ElfEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `event-${i}`,
    timestamp: Date.now() + i * 1000,
    elfId: "elf-1",
    elfName: "Spark",
    runtime: "claude-code" as const,
    type: "tool_call" as const,
    payload: { tool: "read_file", input: { file_path: `/src/file-${i}.ts` } },
  }));
}

describe("TerminalOutput", () => {
  it("shows empty state when no events", () => {
    render(<TerminalOutput events={[]} variant="terminal" />);
    expect(screen.getByTestId("terminal-empty")).toBeInTheDocument();
    expect(screen.getByText("No events yet...")).toBeInTheDocument();
  });

  it("displays event count", () => {
    const events = createEvents(5);
    render(<TerminalOutput events={events} variant="terminal" />);
    expect(screen.getByTestId("event-count").textContent).toBe("5 events");
  });

  it("displays singular event count", () => {
    const events = createEvents(1);
    render(<TerminalOutput events={events} variant="terminal" />);
    expect(screen.getByTestId("event-count").textContent).toBe("1 event");
  });

  it("renders EventBlock for each event", () => {
    const events = createEvents(3);
    render(<TerminalOutput events={events} variant="terminal" />);
    const blocks = screen.getAllByTestId("event-block");
    expect(blocks).toHaveLength(3);
  });

  it("shows auto-scroll toggle button", () => {
    const events = createEvents(3);
    render(<TerminalOutput events={events} variant="terminal" />);
    expect(screen.getByTestId("autoscroll-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("autoscroll-toggle").textContent).toBe("Auto");
  });

  it("toggles auto-scroll state on button click", () => {
    const events = createEvents(3);
    render(<TerminalOutput events={events} variant="terminal" />);
    const toggle = screen.getByTestId("autoscroll-toggle");
    fireEvent.click(toggle);
    expect(toggle.textContent).toBe("Resume");
    fireEvent.click(toggle);
    expect(toggle.textContent).toBe("Auto");
  });

  it("shows Live Output header", () => {
    render(<TerminalOutput events={[]} variant="terminal" />);
    expect(screen.getByText("Live Output")).toBeInTheDocument();
  });

  it("renders terminal-output container", () => {
    render(<TerminalOutput events={[]} variant="compact" />);
    const container = screen.getByTestId("terminal-output");
    expect(container).toBeInTheDocument();
    /* Compact variant uses max-h-64 */
    expect(container.className).toContain("max-h-64");
  });

  it("terminal variant uses flex-1", () => {
    render(<TerminalOutput events={[]} variant="terminal" />);
    const container = screen.getByTestId("terminal-output");
    expect(container.className).toContain("flex-1");
  });
});

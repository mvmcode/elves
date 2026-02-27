/* Tests for the ElfCard component — verifies rendering, status, progress, expand/collapse, and variant modes. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ElfCard } from "./ElfCard";
import type { Elf, ElfEvent } from "@/types/elf";

/** Factory for a test elf with sensible defaults. */
function createTestElf(overrides?: Partial<Elf>): Elf {
  return {
    id: "elf-1",
    sessionId: "session-1",
    name: "Spark",
    role: "Lead & Coordinator",
    avatar: "⚡",
    color: "#FF6B6B",
    quirk: "Leaves glitter on every file they touch",
    runtime: "claude-code",
    status: "working",
    spawnedAt: Date.now(),
    finishedAt: null,
    parentElfId: null,
    toolsUsed: [],
    ...overrides,
  };
}

/** Factory for a test event. */
function createTestEvent(overrides?: Partial<ElfEvent>): ElfEvent {
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

describe("ElfCard", () => {
  it("renders elf name and avatar", () => {
    const elf = createTestElf();
    render(<ElfCard elf={elf} />);
    expect(screen.getByText("Spark")).toBeInTheDocument();
    expect(screen.getByTestId("elf-avatar")).toBeInTheDocument();
  });

  it("shows status badge with correct text", () => {
    const elf = createTestElf({ status: "done" });
    render(<ElfCard elf={elf} />);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("shows error status badge for error state", () => {
    const elf = createTestElf({ status: "error" });
    render(<ElfCard elf={elf} />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("displays funny status message", () => {
    const elf = createTestElf({ status: "working" });
    render(<ElfCard elf={elf} />);
    const funnyStatus = screen.getByTestId("funny-status");
    expect(funnyStatus).toBeInTheDocument();
    expect(funnyStatus.textContent).toContain("Spark");
  });

  it("shows progress bar", () => {
    const elf = createTestElf();
    render(<ElfCard elf={elf} />);
    expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
  });

  it("shows 100% progress when done", () => {
    const elf = createTestElf({ status: "done" });
    render(<ElfCard elf={elf} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows role when assigned", () => {
    const elf = createTestElf({ role: "Lead & Coordinator" });
    render(<ElfCard elf={elf} />);
    expect(screen.getByText("Role: Lead & Coordinator")).toBeInTheDocument();
  });

  it("does not show role when null", () => {
    const elf = createTestElf({ role: null });
    render(<ElfCard elf={elf} />);
    expect(screen.queryByText(/Role:/)).not.toBeInTheDocument();
  });

  it("toggles expand on click", () => {
    const elf = createTestElf();
    const events = [createTestEvent()];
    render(<ElfCard elf={elf} events={events} />);

    /* Event list should not be visible initially */
    expect(screen.queryByTestId("terminal-output")).not.toBeInTheDocument();

    /* Click expand */
    fireEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.getByTestId("terminal-output")).toBeInTheDocument();
  });

  it("calls onToggleExpand when provided", () => {
    const elf = createTestElf();
    const onToggle = vi.fn();
    render(<ElfCard elf={elf} isExpanded={false} onToggleExpand={onToggle} />);

    fireEvent.click(screen.getByTestId("expand-toggle"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows events when expanded", () => {
    const elf = createTestElf();
    const events = [
      createTestEvent({ id: "e1", type: "thinking", payload: { text: "thinking..." } }),
      createTestEvent({ id: "e2", type: "tool_call", payload: { tool: "read_file" } }),
    ];
    render(<ElfCard elf={elf} events={events} isExpanded />);

    expect(screen.getByTestId("terminal-output")).toBeInTheDocument();
    const blocks = screen.getAllByTestId("event-block");
    expect(blocks).toHaveLength(2);
  });

  it("applies elf color to left border", () => {
    const elf = createTestElf({ color: "#6BCB77" });
    render(<ElfCard elf={elf} />);
    const card = screen.getByTestId("elf-card");
    /* jsdom normalizes hex colors to rgb format */
    expect(card.style.borderLeftColor).toBe("rgb(107, 203, 119)");
  });

  it("shows empty event message when expanded with no events", () => {
    const elf = createTestElf();
    render(<ElfCard elf={elf} events={[]} isExpanded />);
    expect(screen.getByText("No events yet...")).toBeInTheDocument();
  });

  /* Terminal variant tests */
  describe("variant='terminal'", () => {
    it("renders in full-height terminal layout", () => {
      const elf = createTestElf();
      render(<ElfCard elf={elf} variant="terminal" />);
      const card = screen.getByTestId("elf-card");
      expect(card.className).toContain("h-full");
      expect(card.className).toContain("flex-col");
    });

    it("always shows terminal output without expand toggle", () => {
      const elf = createTestElf();
      const events = [createTestEvent({ id: "e1", type: "tool_call", payload: { tool: "bash" } })];
      render(<ElfCard elf={elf} events={events} variant="terminal" />);
      expect(screen.getByTestId("terminal-output")).toBeInTheDocument();
      expect(screen.queryByTestId("expand-toggle")).not.toBeInTheDocument();
    });

    it("shows elf name and status badge", () => {
      const elf = createTestElf({ status: "thinking" });
      render(<ElfCard elf={elf} variant="terminal" />);
      expect(screen.getByText("Spark")).toBeInTheDocument();
      expect(screen.getByText("Thinking")).toBeInTheDocument();
    });

    it("shows progress bar inline", () => {
      const elf = createTestElf();
      render(<ElfCard elf={elf} variant="terminal" />);
      expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
    });

    it("shows funny status inline", () => {
      const elf = createTestElf();
      render(<ElfCard elf={elf} variant="terminal" />);
      expect(screen.getByTestId("funny-status")).toBeInTheDocument();
    });

    it("shows role inline when provided", () => {
      const elf = createTestElf({ role: "Backend Dev" });
      render(<ElfCard elf={elf} variant="terminal" />);
      expect(screen.getByText("Backend Dev")).toBeInTheDocument();
    });

    it("shows collapse toggle button", () => {
      const elf = createTestElf();
      render(<ElfCard elf={elf} variant="terminal" />);
      expect(screen.getByTestId("output-collapse-toggle")).toBeInTheDocument();
      expect(screen.getByText("Hide Output")).toBeInTheDocument();
    });

    it("hides terminal output when collapse toggle is clicked", () => {
      const elf = createTestElf();
      const events = [createTestEvent({ id: "e1", type: "tool_call", payload: { tool: "bash" } })];
      render(<ElfCard elf={elf} events={events} variant="terminal" />);

      expect(screen.getByTestId("terminal-output")).toBeInTheDocument();

      fireEvent.click(screen.getByTestId("output-collapse-toggle"));
      expect(screen.queryByTestId("terminal-output")).not.toBeInTheDocument();
      expect(screen.getByText("Show Output")).toBeInTheDocument();
    });

    it("re-shows terminal output when collapse toggle is clicked again", () => {
      const elf = createTestElf();
      const events = [createTestEvent({ id: "e1", type: "tool_call", payload: { tool: "bash" } })];
      render(<ElfCard elf={elf} events={events} variant="terminal" />);

      fireEvent.click(screen.getByTestId("output-collapse-toggle"));
      expect(screen.queryByTestId("terminal-output")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("output-collapse-toggle"));
      expect(screen.getByTestId("terminal-output")).toBeInTheDocument();
    });
  });
});

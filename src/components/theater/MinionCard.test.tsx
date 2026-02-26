/* Tests for the MinionCard component — verifies rendering, status, progress, and expand/collapse. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MinionCard } from "./MinionCard";
import type { Minion, MinionEvent } from "@/types/minion";

/** Factory for a test minion with sensible defaults. */
function createTestMinion(overrides?: Partial<Minion>): Minion {
  return {
    id: "minion-1",
    sessionId: "session-1",
    name: "Kevin",
    role: "Lead & Coordinator",
    avatar: "👷",
    color: "#FF6B6B",
    quirk: "Narrates everything in third person",
    runtime: "claude-code",
    status: "working",
    spawnedAt: Date.now(),
    finishedAt: null,
    parentMinionId: null,
    toolsUsed: [],
    ...overrides,
  };
}

/** Factory for a test event. */
function createTestEvent(overrides?: Partial<MinionEvent>): MinionEvent {
  return {
    id: "event-1",
    timestamp: Date.now(),
    minionId: "minion-1",
    minionName: "Kevin",
    runtime: "claude-code",
    type: "thinking",
    payload: {},
    ...overrides,
  };
}

describe("MinionCard", () => {
  it("renders minion name and avatar", () => {
    const minion = createTestMinion();
    render(<MinionCard minion={minion} />);
    expect(screen.getByText("Kevin")).toBeInTheDocument();
    expect(screen.getByText("👷")).toBeInTheDocument();
  });

  it("shows status badge with correct text", () => {
    const minion = createTestMinion({ status: "done" });
    render(<MinionCard minion={minion} />);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("shows error status badge for error state", () => {
    const minion = createTestMinion({ status: "error" });
    render(<MinionCard minion={minion} />);
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("displays funny status message", () => {
    const minion = createTestMinion({ status: "working" });
    render(<MinionCard minion={minion} />);
    const funnyStatus = screen.getByTestId("funny-status");
    expect(funnyStatus).toBeInTheDocument();
    /* Message should contain the minion's name */
    expect(funnyStatus.textContent).toContain("Kevin");
  });

  it("shows progress bar", () => {
    const minion = createTestMinion();
    render(<MinionCard minion={minion} />);
    expect(screen.getByTestId("progress-bar")).toBeInTheDocument();
  });

  it("shows 100% progress when done", () => {
    const minion = createTestMinion({ status: "done" });
    render(<MinionCard minion={minion} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows role when assigned", () => {
    const minion = createTestMinion({ role: "Lead & Coordinator" });
    render(<MinionCard minion={minion} />);
    expect(screen.getByText("Role: Lead & Coordinator")).toBeInTheDocument();
  });

  it("does not show role when null", () => {
    const minion = createTestMinion({ role: null });
    render(<MinionCard minion={minion} />);
    expect(screen.queryByText(/Role:/)).not.toBeInTheDocument();
  });

  it("toggles expand on click", () => {
    const minion = createTestMinion();
    const events = [createTestEvent()];
    render(<MinionCard minion={minion} events={events} />);

    /* Event list should not be visible initially */
    expect(screen.queryByTestId("event-list")).not.toBeInTheDocument();

    /* Click expand */
    fireEvent.click(screen.getByTestId("expand-toggle"));
    expect(screen.getByTestId("event-list")).toBeInTheDocument();
  });

  it("calls onToggleExpand when provided", () => {
    const minion = createTestMinion();
    const onToggle = vi.fn();
    render(<MinionCard minion={minion} isExpanded={false} onToggleExpand={onToggle} />);

    fireEvent.click(screen.getByTestId("expand-toggle"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows events when expanded", () => {
    const minion = createTestMinion();
    const events = [
      createTestEvent({ id: "e1", type: "thinking" }),
      createTestEvent({ id: "e2", type: "tool_call", payload: { tool: "read_file" } }),
    ];
    render(<MinionCard minion={minion} events={events} isExpanded />);

    const eventList = screen.getByTestId("event-list");
    expect(eventList).toBeInTheDocument();
    expect(eventList.textContent).toContain("Thinking...");
    expect(eventList.textContent).toContain("Using read_file");
  });

  it("applies minion color to left border", () => {
    const minion = createTestMinion({ color: "#6BCB77" });
    render(<MinionCard minion={minion} />);
    const card = screen.getByTestId("minion-card");
    /* jsdom normalizes hex colors to rgb format */
    expect(card.style.borderLeftColor).toBe("rgb(107, 203, 119)");
  });

  it("shows empty event message when expanded with no events", () => {
    const minion = createTestMinion();
    render(<MinionCard minion={minion} events={[]} isExpanded />);
    expect(screen.getByText("No events yet...")).toBeInTheDocument();
  });
});

/* Tests for the ActivityFeed component — verifies event rendering, filtering, expansion, and empty states. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ActivityFeed } from "./ActivityFeed";
import type { MinionEvent } from "@/types/minion";

/** Factory for creating test events with sensible defaults. */
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

/** Returns a diverse set of events for testing filters. */
function createMixedEvents(): readonly MinionEvent[] {
  return [
    createTestEvent({ id: "e1", type: "spawn", minionName: "Kevin", payload: { role: "Lead" } }),
    createTestEvent({ id: "e2", type: "thinking", minionName: "Stuart" }),
    createTestEvent({ id: "e3", type: "tool_call", minionName: "Kevin", payload: { tool: "read_file", path: "src/index.ts" } }),
    createTestEvent({ id: "e4", type: "chat", minionName: "Bob", payload: { text: "Hello team!" } }),
    createTestEvent({ id: "e5", type: "error", minionName: "Stuart", payload: { message: "File not found" } }),
    createTestEvent({ id: "e6", type: "output", minionName: "Kevin", payload: { text: "Writing code..." } }),
  ];
}

describe("ActivityFeed", () => {
  it("renders event list", () => {
    const events = [createTestEvent(), createTestEvent({ id: "e2" })];
    render(<ActivityFeed events={events} />);
    const rows = screen.getAllByTestId("event-row");
    expect(rows).toHaveLength(2);
  });

  it("shows timestamp and minion name for each event", () => {
    const events = [createTestEvent({ minionName: "Kevin" })];
    render(<ActivityFeed events={events} />);
    expect(screen.getByText("Kevin")).toBeInTheDocument();
  });

  it("renders filter buttons", () => {
    render(<ActivityFeed events={[]} />);
    expect(screen.getByTestId("filter-all")).toBeInTheDocument();
    expect(screen.getByTestId("filter-tools")).toBeInTheDocument();
    expect(screen.getByTestId("filter-chat")).toBeInTheDocument();
    expect(screen.getByTestId("filter-errors")).toBeInTheDocument();
  });

  it("filters events when a filter is clicked", () => {
    const events = createMixedEvents();
    render(<ActivityFeed events={events} />);

    /* Initially all events shown */
    expect(screen.getAllByTestId("event-row")).toHaveLength(6);

    /* Click Tools filter — should show tool_call and tool_result events only */
    fireEvent.click(screen.getByTestId("filter-tools"));
    expect(screen.getAllByTestId("event-row")).toHaveLength(1);

    /* Click Errors filter — should show only error events */
    fireEvent.click(screen.getByTestId("filter-errors"));
    expect(screen.getAllByTestId("event-row")).toHaveLength(1);
    expect(screen.getByText("File not found")).toBeInTheDocument();
  });

  it("filters chat events correctly", () => {
    const events = createMixedEvents();
    render(<ActivityFeed events={events} />);

    fireEvent.click(screen.getByTestId("filter-chat"));
    /* chat + output events */
    expect(screen.getAllByTestId("event-row")).toHaveLength(2);
  });

  it("tool call events are expandable", () => {
    const events = [
      createTestEvent({ id: "tc1", type: "tool_call", payload: { tool: "read_file", path: "/src/index.ts" } }),
    ];
    render(<ActivityFeed events={events} />);

    /* Expand button should be present */
    const expandBtn = screen.getByTestId("expand-event");
    expect(expandBtn).toBeInTheDocument();

    /* Payload not visible yet */
    expect(screen.queryByTestId("event-payload")).not.toBeInTheDocument();

    /* Click to expand */
    fireEvent.click(expandBtn);
    expect(screen.getByTestId("event-payload")).toBeInTheDocument();
    expect(screen.getByTestId("event-payload").textContent).toContain("read_file");

    /* Click to collapse */
    fireEvent.click(expandBtn);
    expect(screen.queryByTestId("event-payload")).not.toBeInTheDocument();
  });

  it("shows empty state message when no events", () => {
    render(<ActivityFeed events={[]} />);
    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("No events yet. Deploy minions to get started.")).toBeInTheDocument();
  });

  it("shows filter-specific empty message when filter has no matches", () => {
    const events = [createTestEvent({ type: "thinking" })];
    render(<ActivityFeed events={events} />);

    fireEvent.click(screen.getByTestId("filter-errors"));
    expect(screen.getByText("No events match this filter.")).toBeInTheDocument();
  });

  it("applies correct color per minion", () => {
    /* Kevin has color #FF6B6B in minion-names.ts (index 1) */
    const events = [createTestEvent({ minionName: "Kevin" })];
    render(<ActivityFeed events={events} />);
    const nameElement = screen.getByText("Kevin");
    expect(nameElement.style.color).toBe("rgb(255, 107, 107)");
  });

  it("highlights active filter in yellow", () => {
    render(<ActivityFeed events={[]} />);
    const allButton = screen.getByTestId("filter-all");
    expect(allButton.className).toContain("bg-minion-yellow");

    fireEvent.click(screen.getByTestId("filter-tools"));
    const toolsButton = screen.getByTestId("filter-tools");
    expect(toolsButton.className).toContain("bg-minion-yellow");
  });

  it("shows spawn events with role info", () => {
    const events = [createTestEvent({ type: "spawn", payload: { role: "Researcher" } })];
    render(<ActivityFeed events={events} />);
    expect(screen.getByText(/spawned as Researcher/)).toBeInTheDocument();
  });

  it("shows error events with error styling", () => {
    const events = [createTestEvent({ type: "error", payload: { message: "Something broke" } })];
    render(<ActivityFeed events={events} />);
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });
});

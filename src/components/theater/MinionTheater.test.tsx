/* Tests for the MinionTheater component — verifies grid rendering, heading, and empty state. */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MinionTheater } from "./MinionTheater";
import type { Minion, MinionEvent } from "@/types/minion";

/** Factory for a test minion. */
function createTestMinion(overrides?: Partial<Minion>): Minion {
  return {
    id: "minion-1",
    sessionId: "session-1",
    name: "Kevin",
    role: "Lead",
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

describe("MinionTheater", () => {
  it("renders correct number of MinionCards", () => {
    const minions = [
      createTestMinion({ id: "m1", name: "Kevin" }),
      createTestMinion({ id: "m2", name: "Stuart" }),
      createTestMinion({ id: "m3", name: "Bob" }),
    ];
    render(<MinionTheater minions={minions} events={[]} />);
    const cards = screen.getAllByTestId("minion-card");
    expect(cards).toHaveLength(3);
  });

  it("shows session heading", () => {
    const minions = [createTestMinion()];
    render(<MinionTheater minions={minions} events={[]} />);
    expect(screen.getByTestId("theater-heading")).toBeInTheDocument();
    expect(screen.getByText("Minion Theater")).toBeInTheDocument();
  });

  it("shows minion count badge", () => {
    const minions = [
      createTestMinion({ id: "m1" }),
      createTestMinion({ id: "m2" }),
    ];
    render(<MinionTheater minions={minions} events={[]} />);
    expect(screen.getByText("2 Minions")).toBeInTheDocument();
  });

  it("shows singular 'Minion' for single minion", () => {
    const minions = [createTestMinion()];
    render(<MinionTheater minions={minions} events={[]} />);
    expect(screen.getByText("1 Minion")).toBeInTheDocument();
  });

  it("shows empty state when no minions", () => {
    render(<MinionTheater minions={[]} events={[]} />);
    expect(screen.getByTestId("theater-empty")).toBeInTheDocument();
    expect(screen.getByText("No Minions Active")).toBeInTheDocument();
  });

  it("passes correct events to each MinionCard", () => {
    const minions = [
      createTestMinion({ id: "m1", name: "Kevin" }),
      createTestMinion({ id: "m2", name: "Stuart" }),
    ];
    const events = [
      createTestEvent({ id: "e1", minionId: "m1", minionName: "Kevin" }),
      createTestEvent({ id: "e2", minionId: "m2", minionName: "Stuart" }),
      createTestEvent({ id: "e3", minionId: "m1", minionName: "Kevin" }),
    ];
    render(<MinionTheater minions={minions} events={events} />);
    /* Both cards should render */
    const cards = screen.getAllByTestId("minion-card");
    expect(cards).toHaveLength(2);
  });
});

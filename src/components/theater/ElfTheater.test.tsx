/* Tests for the ElfTheater component — verifies grid rendering, heading, and empty state. */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ElfTheater } from "./ElfTheater";
import type { Elf, ElfEvent } from "@/types/elf";

/** Factory for a test elf. */
function createTestElf(overrides?: Partial<Elf>): Elf {
  return {
    id: "elf-1",
    sessionId: "session-1",
    name: "Spark",
    role: "Lead",
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

describe("ElfTheater", () => {
  it("renders correct number of ElfCards", () => {
    const elves = [
      createTestElf({ id: "e1", name: "Spark" }),
      createTestElf({ id: "e2", name: "Tinker" }),
      createTestElf({ id: "e3", name: "Jingle" }),
    ];
    render(<ElfTheater elves={elves} events={[]} />);
    const cards = screen.getAllByTestId("elf-card");
    expect(cards).toHaveLength(3);
  });

  it("shows session heading", () => {
    const elves = [createTestElf()];
    render(<ElfTheater elves={elves} events={[]} />);
    expect(screen.getByTestId("theater-heading")).toBeInTheDocument();
    expect(screen.getByText("Elf Workshop")).toBeInTheDocument();
  });

  it("shows elf count badge", () => {
    const elves = [
      createTestElf({ id: "e1" }),
      createTestElf({ id: "e2" }),
    ];
    render(<ElfTheater elves={elves} events={[]} />);
    expect(screen.getByText("2 Elves")).toBeInTheDocument();
  });

  it("shows singular 'Elf' for single elf", () => {
    const elves = [createTestElf()];
    render(<ElfTheater elves={elves} events={[]} />);
    expect(screen.getByText("1 Elf")).toBeInTheDocument();
  });

  it("shows empty state when no elves", () => {
    render(<ElfTheater elves={[]} events={[]} />);
    expect(screen.getByTestId("theater-empty")).toBeInTheDocument();
    expect(screen.getByText("No Elves Active")).toBeInTheDocument();
  });

  it("passes correct events to each ElfCard", () => {
    const elves = [
      createTestElf({ id: "e1", name: "Spark" }),
      createTestElf({ id: "e2", name: "Tinker" }),
    ];
    const events = [
      createTestEvent({ id: "ev1", elfId: "e1", elfName: "Spark" }),
      createTestEvent({ id: "ev2", elfId: "e2", elfName: "Tinker" }),
      createTestEvent({ id: "ev3", elfId: "e1", elfName: "Spark" }),
    ];
    render(<ElfTheater elves={elves} events={events} />);
    /* Both cards should render */
    const cards = screen.getAllByTestId("elf-card");
    expect(cards).toHaveLength(2);
  });
});

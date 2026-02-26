/* Tests for ElfTheater — verifies grid, heading, empty state, lead badge, progress bar, and chat bubbles. */

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
    const cards = screen.getAllByTestId("elf-card");
    expect(cards).toHaveLength(2);
  });

  it("shows global progress bar when elves are active", () => {
    const elves = [createTestElf()];
    render(<ElfTheater elves={elves} events={[]} startedAt={Date.now()} />);
    expect(screen.getByTestId("progress-bar-global")).toBeInTheDocument();
  });

  it("shows elapsed time in progress bar", () => {
    const elves = [createTestElf()];
    render(<ElfTheater elves={elves} events={[]} startedAt={Date.now()} />);
    expect(screen.getByTestId("elapsed-time")).toBeInTheDocument();
    expect(screen.getByTestId("elapsed-time").textContent).toContain("elapsed");
  });

  it("shows cost estimate when provided", () => {
    const elves = [createTestElf()];
    render(<ElfTheater elves={elves} events={[]} costEstimate={0.42} startedAt={Date.now()} />);
    expect(screen.getByTestId("cost-estimate")).toBeInTheDocument();
    expect(screen.getByTestId("cost-estimate").textContent).toContain("$0.42");
  });

  it("does not show cost estimate when zero", () => {
    const elves = [createTestElf()];
    render(<ElfTheater elves={elves} events={[]} costEstimate={0} startedAt={Date.now()} />);
    expect(screen.queryByTestId("cost-estimate")).not.toBeInTheDocument();
  });

  it("shows global status message", () => {
    const elves = [createTestElf()];
    render(<ElfTheater elves={elves} events={[]} />);
    expect(screen.getByTestId("global-status")).toBeInTheDocument();
  });

  it("shows lead badge on lead elf card", () => {
    const elves = [
      createTestElf({ id: "e1", name: "Spark" }),
      createTestElf({ id: "e2", name: "Tinker" }),
    ];
    render(<ElfTheater elves={elves} events={[]} leadElfId="e1" />);
    const badges = screen.getAllByTestId("lead-badge");
    expect(badges).toHaveLength(1);
    expect(screen.getByLabelText("Lead agent")).toBeInTheDocument();
  });

  it("does not show lead badge when leadElfId is not set", () => {
    const elves = [createTestElf({ id: "e1" })];
    render(<ElfTheater elves={elves} events={[]} />);
    expect(screen.queryByTestId("lead-badge")).not.toBeInTheDocument();
  });

  it("renders chat bubbles for chat-type events", () => {
    const elves = [createTestElf({ id: "e1", name: "Spark" })];
    const events = [
      createTestEvent({
        id: "chat1",
        elfId: "e1",
        elfName: "Spark",
        type: "chat",
        payload: { message: "Hey team, I found the bug!" },
        timestamp: Date.now(),
      }),
    ];
    render(<ElfTheater elves={elves} events={events} />);
    const bubbles = screen.getAllByTestId("chat-bubble");
    expect(bubbles).toHaveLength(1);
    expect(screen.getByText("Spark:")).toBeInTheDocument();
    expect(screen.getByText("Hey team, I found the bug!")).toBeInTheDocument();
  });

  it("renders deployed count in progress bar", () => {
    const elves = [
      createTestElf({ id: "e1" }),
      createTestElf({ id: "e2" }),
      createTestElf({ id: "e3" }),
    ];
    render(<ElfTheater elves={elves} events={[]} />);
    expect(screen.getByText("3 elves deployed")).toBeInTheDocument();
  });

  it("renders singular 'elf deployed' for single elf", () => {
    const elves = [createTestElf()];
    render(<ElfTheater elves={elves} events={[]} />);
    expect(screen.getByText("1 elf deployed")).toBeInTheDocument();
  });

  it("renders the elf grid container", () => {
    const elves = [createTestElf()];
    render(<ElfTheater elves={elves} events={[]} />);
    expect(screen.getByTestId("elf-grid")).toBeInTheDocument();
  });
});

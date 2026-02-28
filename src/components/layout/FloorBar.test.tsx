/* Tests for FloorBar — verifies tab rendering, switching, creation, and closure. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { FloorBar } from "./FloorBar";
import { useSessionStore } from "@/stores/session";

/** Reset store state between tests */
function resetStore(): void {
  const floors = useSessionStore.getState().getOrderedFloors();
  for (const floor of floors) {
    useSessionStore.getState().closeFloor(floor.id);
  }
}

describe("FloorBar", () => {
  beforeEach(() => {
    resetStore();
  });

  it("renders the floor bar container", () => {
    render(<FloorBar />);
    expect(screen.getByTestId("floor-bar")).toBeInTheDocument();
  });

  it("renders one default floor tab", () => {
    render(<FloorBar />);
    const tabs = screen.getAllByTestId("floor-tab");
    expect(tabs).toHaveLength(1);
  });

  it("renders the + button", () => {
    render(<FloorBar />);
    expect(screen.getByTestId("floor-add-btn")).toBeInTheDocument();
  });

  it("creates a new floor when + is clicked", () => {
    render(<FloorBar />);
    fireEvent.click(screen.getByTestId("floor-add-btn"));
    const tabs = screen.getAllByTestId("floor-tab");
    expect(tabs).toHaveLength(2);
  });

  it("switches active floor on tab click", () => {
    /* Create a second floor */
    useSessionStore.getState().createFloor("Floor 2");
    const firstFloorId = useSessionStore.getState().getOrderedFloors()[0]!.id;

    render(<FloorBar />);
    const tabs = screen.getAllByTestId("floor-tab");

    /* Click the first tab (which is not active since createFloor switches) */
    fireEvent.click(tabs[0]!);
    expect(useSessionStore.getState().activeFloorId).toBe(firstFloorId);
  });

  it("marks the active tab with data-active attribute", () => {
    render(<FloorBar />);
    const tab = screen.getByTestId("floor-tab");
    expect(tab.getAttribute("data-active")).toBe("true");
  });

  it("shows status dot for active session", () => {
    useSessionStore.getState().startSession({
      id: "s1",
      projectId: "p1",
      task: "Running task",
      runtime: "claude-code",
    });

    render(<FloorBar />);
    expect(screen.getByTestId("floor-status-dot")).toBeInTheDocument();
  });

  it("does not show status dot when no session", () => {
    render(<FloorBar />);
    expect(screen.queryByTestId("floor-status-dot")).not.toBeInTheDocument();
  });

  it("shows truncated task label when session is active", () => {
    useSessionStore.getState().startSession({
      id: "s1",
      projectId: "p1",
      task: "Fix the very long task name that should get truncated",
      runtime: "claude-code",
    });

    render(<FloorBar />);
    /* The tab label should show the floor label (task.slice(0,20) from startSession) */
    expect(screen.getByText("Fix the very long ta")).toBeInTheDocument();
  });

  it("shows 'New Floor' label when idle", () => {
    render(<FloorBar />);
    expect(screen.getByText("New Floor")).toBeInTheDocument();
  });
});

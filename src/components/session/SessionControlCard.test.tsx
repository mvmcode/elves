/* Tests for SessionControlCard — verifies visibility, status display, and button actions. */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionControlCard } from "./SessionControlCard";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";

/* Mock useTeamSession to avoid Tauri IPC calls */
const mockStopSession = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/useTeamSession", () => ({
  useTeamSession: () => ({
    stopSession: mockStopSession,
    analyzeAndDeploy: vi.fn(),
    deployWithPlan: vi.fn(),
    continueSession: vi.fn(),
    isSessionActive: false,
    isSessionCompleted: false,
    isPlanPreview: false,
  }),
}));

/** Reset stores between tests */
function resetStores(): void {
  const floors = useSessionStore.getState().getOrderedFloors();
  for (const floor of floors) {
    useSessionStore.getState().closeFloor(floor.id);
  }
  useUiStore.setState({ isTerminalPanelOpen: false });
}

describe("SessionControlCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetStores();
    mockStopSession.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when no session exists", () => {
    const { container } = render(<SessionControlCard />);
    expect(container.innerHTML).toBe("");
  });

  it("renders when session is active", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "p1", task: "Fix bug", runtime: "claude-code",
    });

    render(<SessionControlCard />);
    expect(screen.getByTestId("session-control-card")).toBeInTheDocument();
  });

  it("shows Working... status when session is active", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "p1", task: "Fix bug", runtime: "claude-code",
    });

    render(<SessionControlCard />);
    expect(screen.getByTestId("control-status-text")).toHaveTextContent("Working...");
  });

  it("shows Done! status when session is completed", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "p1", task: "Fix bug", runtime: "claude-code",
    });
    useSessionStore.getState().endSession("completed");

    render(<SessionControlCard />);
    expect(screen.getByTestId("control-status-text")).toHaveTextContent("Done!");
  });

  it("shows STOP button when session is active", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "p1", task: "Fix bug", runtime: "claude-code",
    });

    render(<SessionControlCard />);
    expect(screen.getByTestId("control-stop-btn")).toBeInTheDocument();
  });

  it("shows NEW TASK button when session is completed", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "p1", task: "Fix bug", runtime: "claude-code",
    });
    useSessionStore.getState().endSession("completed");

    render(<SessionControlCard />);
    expect(screen.getByTestId("control-end-btn")).toBeInTheDocument();
  });

  it("calls stopSession when STOP is clicked", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "p1", task: "Fix bug", runtime: "claude-code",
    });

    render(<SessionControlCard />);
    fireEvent.click(screen.getByTestId("control-stop-btn"));
    expect(mockStopSession).toHaveBeenCalledOnce();
  });

  it("clears floor session when NEW TASK is clicked", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "p1", task: "Fix bug", runtime: "claude-code",
    });
    useSessionStore.getState().endSession("completed");

    render(<SessionControlCard />);
    fireEvent.click(screen.getByTestId("control-end-btn"));

    expect(useSessionStore.getState().activeSession).toBeNull();
  });

  it("shows elapsed time counter", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "p1", task: "Fix bug", runtime: "claude-code",
    });

    render(<SessionControlCard />);
    expect(screen.getByTestId("control-elapsed")).toBeInTheDocument();
  });

  it("shows terminal toggle button", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "p1", task: "Fix bug", runtime: "claude-code",
    });

    render(<SessionControlCard />);
    expect(screen.getByTestId("control-terminal-btn")).toBeInTheDocument();
  });

  it("toggles terminal panel when TERMINAL button is clicked", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "p1", task: "Fix bug", runtime: "claude-code",
    });

    render(<SessionControlCard />);
    expect(useUiStore.getState().isTerminalPanelOpen).toBe(false);
    fireEvent.click(screen.getByTestId("control-terminal-btn"));
    expect(useUiStore.getState().isTerminalPanelOpen).toBe(true);
  });

  it("shows stall warning when events stop", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "p1", task: "Fix bug", runtime: "claude-code",
    });
    /* Set lastEventAt to 20 seconds ago */
    const floorId = useSessionStore.getState().activeFloorId!;
    const floor = useSessionStore.getState().floors[floorId]!;
    useSessionStore.setState({
      floors: { ...useSessionStore.getState().floors, [floorId]: { ...floor, lastEventAt: Date.now() - 20_000 } },
      lastEventAt: Date.now() - 20_000,
    });

    render(<SessionControlCard />);
    act(() => { vi.advanceTimersByTime(4000); });

    expect(screen.getByTestId("stall-warning")).toBeInTheDocument();
  });
});

/* Tests for SidePanel — verifies tab switching, terminal waiting state, stall detection, and collapse behavior. */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SidePanel } from "./SidePanel";
import { useSessionStore } from "@/stores/session";
import type { ElfEvent } from "@/types/elf";

/* Mock SessionTerminal to avoid PTY/Tauri IPC in unit tests.
 * Exposes onPtyExit via a button so tests can simulate PTY process exit. */
vi.mock("@/components/terminal/SessionTerminal", () => ({
  SessionTerminal: ({ onClose, onPtyExit }: { onClose: () => void; onPtyExit?: () => void }) => (
    <div data-testid="session-terminal">
      <button data-testid="mock-terminal-close" onClick={onClose}>
        close
      </button>
      <button data-testid="mock-pty-exit" onClick={() => onPtyExit?.()}>
        pty-exit
      </button>
    </div>
  ),
}));

/* Mock the Tauri IPC wrapper so we can verify it's called. */
const mockTransition = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/tauri", () => ({
  transitionToInteractive: (...args: unknown[]) => mockTransition(...args),
}));

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

const defaultProps = {
  events: [createTestEvent()] as readonly ElfEvent[],
  sessionId: "session-1",
  claudeSessionId: "claude-abc",
  projectPath: "/tmp/project",
  taskLabel: "Fix the widget",
  onCollapse: vi.fn(),
};

describe("SidePanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockTransition.mockClear();
    /* Set up an active session via store actions so floor state is consistent */
    useSessionStore.getState().startSession({
      id: "session-1",
      projectId: "proj-1",
      task: "Fix the widget",
      runtime: "claude-code",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    useSessionStore.getState().clearSession();
  });

  it("defaults to the Activity tab with ActivityFeed visible", () => {
    render(<SidePanel {...defaultProps} />);
    expect(screen.getByTestId("activity-feed")).toBeInTheDocument();
    expect(screen.queryByTestId("session-terminal")).not.toBeInTheDocument();
  });

  it("switches to Terminal tab and calls transitionToInteractive", () => {
    render(<SidePanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tab-terminal"));
    expect(screen.getByTestId("session-terminal")).toBeInTheDocument();
    expect(screen.queryByTestId("activity-feed")).not.toBeInTheDocument();
    expect(mockTransition).toHaveBeenCalledWith("session-1");
  });

  it("only calls transitionToInteractive once per session", () => {
    render(<SidePanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tab-terminal"));
    expect(mockTransition).toHaveBeenCalledTimes(1);

    /* Switch back and forth */
    fireEvent.click(screen.getByTestId("tab-activity"));
    fireEvent.click(screen.getByTestId("tab-terminal"));
    expect(mockTransition).toHaveBeenCalledTimes(1);
  });

  it("shows waiting placeholder when claudeSessionId is undefined", () => {
    render(<SidePanel {...defaultProps} claudeSessionId={undefined} />);
    fireEvent.click(screen.getByTestId("tab-terminal"));
    expect(screen.getByTestId("terminal-waiting")).toBeInTheDocument();
    expect(screen.getByText("Waiting for session to connect...")).toBeInTheDocument();
  });

  it("collapse button calls onCollapse", () => {
    const onCollapse = vi.fn();
    render(<SidePanel {...defaultProps} onCollapse={onCollapse} />);
    fireEvent.click(screen.getByTestId("collapse-button"));
    expect(onCollapse).toHaveBeenCalledOnce();
  });

  it("terminal onClose switches back to Activity tab", () => {
    render(<SidePanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tab-terminal"));
    expect(screen.getByTestId("session-terminal")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-terminal-close"));
    expect(screen.getByTestId("activity-feed")).toBeInTheDocument();
    expect(screen.queryByTestId("session-terminal")).not.toBeInTheDocument();
  });

  it("highlights the active tab with gold styling", () => {
    render(<SidePanel {...defaultProps} />);
    const activityTab = screen.getByTestId("tab-activity");
    const terminalTab = screen.getByTestId("tab-terminal");

    expect(activityTab.className).toContain("bg-elf-gold");
    expect(terminalTab.className).toContain("bg-gray-800");

    fireEvent.click(terminalTab);
    expect(terminalTab.className).toContain("bg-elf-gold");
    expect(activityTab.className).toContain("bg-gray-800");
  });

  it("shows stall banner when events stop arriving", () => {
    /* Simulate lastEventAt 20 seconds ago by updating the floor's lastEventAt via snapshot sync.
     * addEvent sets lastEventAt to Date.now(), but we need an old timestamp — use direct setState
     * to patch both the floor and snapshot. */
    const floorId = useSessionStore.getState().activeFloorId!;
    const floor = useSessionStore.getState().floors[floorId]!;
    useSessionStore.setState({
      floors: { ...useSessionStore.getState().floors, [floorId]: { ...floor, lastEventAt: Date.now() - 20_000 } },
      lastEventAt: Date.now() - 20_000,
    });

    render(<SidePanel {...defaultProps} />);

    /* Advance timer to trigger the stall check interval */
    act(() => { vi.advanceTimersByTime(4000); });

    expect(screen.getByTestId("stall-banner")).toBeInTheDocument();
    expect(screen.getByText("Claude may be waiting for input")).toBeInTheDocument();
  });

  it("clicking stall banner switches to terminal", () => {
    const floorId = useSessionStore.getState().activeFloorId!;
    const floor = useSessionStore.getState().floors[floorId]!;
    useSessionStore.setState({
      floors: { ...useSessionStore.getState().floors, [floorId]: { ...floor, lastEventAt: Date.now() - 20_000 } },
      lastEventAt: Date.now() - 20_000,
    });

    render(<SidePanel {...defaultProps} />);
    act(() => { vi.advanceTimersByTime(4000); });

    fireEvent.click(screen.getByTestId("stall-banner"));
    expect(screen.getByTestId("session-terminal")).toBeInTheDocument();
    expect(mockTransition).toHaveBeenCalledWith("session-1");
  });

  it("does not show stall banner when already in terminal tab", () => {
    const floorId = useSessionStore.getState().activeFloorId!;
    const floor = useSessionStore.getState().floors[floorId]!;
    useSessionStore.setState({
      floors: { ...useSessionStore.getState().floors, [floorId]: { ...floor, lastEventAt: Date.now() - 20_000 } },
      lastEventAt: Date.now() - 20_000,
    });

    render(<SidePanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tab-terminal"));
    act(() => { vi.advanceTimersByTime(4000); });

    expect(screen.queryByTestId("stall-banner")).not.toBeInTheDocument();
  });

  it("PTY exit in interactive mode triggers session completion", () => {
    useSessionStore.getState().setInteractiveMode(true);

    render(<SidePanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tab-terminal"));
    fireEvent.click(screen.getByTestId("mock-pty-exit"));

    const session = useSessionStore.getState().activeSession;
    expect(session?.status).toBe("completed");
  });

  it("PTY exit without interactive mode does not change session status", () => {
    /* isInteractiveMode is already false from startSession in beforeEach */

    render(<SidePanel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tab-terminal"));
    fireEvent.click(screen.getByTestId("mock-pty-exit"));

    const session = useSessionStore.getState().activeSession;
    expect(session?.status).toBe("active");
  });
});

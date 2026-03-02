/* Tests for BottomTerminalPanel — verifies rendering, terminal mode selection, and resize handle. */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BottomTerminalPanel } from "./BottomTerminalPanel";
import { useSessionStore } from "@/stores/session";
import { useUiStore } from "@/stores/ui";

/* Mock SessionTerminal to avoid PTY/Tauri IPC in unit tests */
vi.mock("./SessionTerminal", () => ({
  SessionTerminal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="session-terminal">
      <button data-testid="mock-terminal-close" onClick={onClose}>close</button>
    </div>
  ),
}));

/* Mock LiveEventTerminal to avoid xterm in unit tests */
vi.mock("./LiveEventTerminal", () => ({
  LiveEventTerminal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="live-event-terminal-mock">
      <button data-testid="mock-live-close" onClick={onClose}>close</button>
    </div>
  ),
}));

/* Mock the Tauri IPC wrapper */
const mockTransition = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/tauri", () => ({
  transitionToInteractive: (...args: unknown[]) => mockTransition(...args),
}));

/* Mock project store */
vi.mock("@/stores/project", () => ({
  useProjectStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      projects: [{ id: "proj-1", path: "/tmp/project" }],
      activeProjectId: "proj-1",
    }),
}));

function resetStores(): void {
  const floors = useSessionStore.getState().getOrderedFloors();
  for (const floor of floors) {
    useSessionStore.getState().closeFloor(floor.id);
  }
  useUiStore.setState({ isTerminalPanelOpen: true, terminalPanelHeight: 300 });
}

describe("BottomTerminalPanel", () => {
  beforeEach(() => {
    resetStores();
    mockTransition.mockClear();
  });

  it("shows 'No active session' when there is no session", () => {
    render(<BottomTerminalPanel />);
    expect(screen.getByText("No active session")).toBeInTheDocument();
  });

  it("renders the panel container", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "proj-1", task: "Fix bug", runtime: "claude-code",
    });

    render(<BottomTerminalPanel />);
    expect(screen.getByTestId("bottom-terminal-panel")).toBeInTheDocument();
  });

  it("shows LiveEventTerminal for active session in print mode", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "proj-1", task: "Fix bug", runtime: "claude-code",
    });

    render(<BottomTerminalPanel />);
    expect(screen.getByTestId("live-event-terminal-mock")).toBeInTheDocument();
  });

  it("has a resize handle", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "proj-1", task: "Fix bug", runtime: "claude-code",
    });

    render(<BottomTerminalPanel />);
    expect(screen.getByTestId("terminal-resize-handle")).toBeInTheDocument();
  });

  it("has a close button when no session", () => {
    render(<BottomTerminalPanel />);
    const closeBtn = screen.getByTestId("terminal-panel-close");
    expect(closeBtn).toBeInTheDocument();
  });
});

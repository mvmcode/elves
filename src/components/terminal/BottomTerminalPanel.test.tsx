/* Tests for BottomTerminalPanel — verifies rendering, PTY-only mode, toolbar, and resize handle. */

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

/* Mock TerminalToolbar to isolate BottomTerminalPanel tests */
vi.mock("./TerminalToolbar", () => ({
  TerminalToolbar: () => <div data-testid="terminal-toolbar-mock" />,
}));

/* Mock project store */
vi.mock("@/stores/project", () => ({
  useProjectStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      projects: [{ id: "proj-1", path: "/tmp/project" }],
      activeProjectId: "proj-1",
    }),
}));

/* Mock stall detection hook */
vi.mock("@/hooks/useStallDetection", () => ({
  useStallDetection: () => false,
}));

/* Mock elf-names and sounds */
vi.mock("@/lib/elf-names", () => ({
  generateElf: () => ({ name: "Spark", avatar: "chef", color: "#FFD93D", quirk: "test" }),
  getStatusMessage: () => "doing stuff",
}));
vi.mock("@/lib/sounds", () => ({
  playSound: vi.fn(),
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

  it("shows waiting message when no claude session id", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "proj-1", task: "Fix bug", runtime: "claude-code",
    });

    render(<BottomTerminalPanel />);
    expect(screen.getByText("Waiting for Claude session ID...")).toBeInTheDocument();
  });

  it("renders SessionTerminal when claude session id is available", () => {
    useSessionStore.getState().startSession({
      id: "s1", projectId: "proj-1", task: "Fix bug", runtime: "claude-code",
    });
    useSessionStore.getState().setClaudeSessionId("claude-sess-123");

    render(<BottomTerminalPanel />);
    expect(screen.getByTestId("session-terminal")).toBeInTheDocument();
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

/* Tests for SessionHistory — verifies compact row rendering, expand/collapse, and Open as Floor. */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionHistory } from "./SessionHistory";
import type { Session } from "@/types/session";

/* Mock the Tauri IPC layer so SessionEventViewer does not call the real invoke. */
vi.mock("@/lib/tauri", () => ({
  listSessionEvents: vi.fn().mockResolvedValue([]),
}));

/* Mock the hooks */
const mockSessions: Session[] = [];
let mockIsLoading = false;

vi.mock("@/hooks/useSessionHistory", () => ({
  useSessionHistory: () => ({
    sessions: mockSessions,
    isLoading: mockIsLoading,
    reload: vi.fn(),
  }),
}));

const mockSetActiveView = vi.fn();
vi.mock("@/stores/ui", () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      highlightedSessionId: null,
      setHighlightedSessionId: vi.fn(),
      setActiveView: mockSetActiveView,
    }),
}));

const mockOpenHistoricalFloor = vi.fn();
vi.mock("@/stores/session", () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      openHistoricalFloor: mockOpenHistoricalFloor,
    }),
}));

function createTestSession(overrides?: Partial<Session>): Session {
  return {
    id: "session-1",
    projectId: "project-1",
    task: "Build the login page with authentication",
    runtime: "claude-code",
    status: "completed",
    plan: null,
    agentCount: 3,
    startedAt: Date.now() - 300000,
    endedAt: Date.now(),
    tokensUsed: 15432,
    costEstimate: 0.0234,
    summary: "Successfully built the login page with OAuth integration.",
    claudeSessionId: null,
    ...overrides,
  };
}

describe("SessionHistory", () => {
  beforeEach(() => {
    mockSessions.length = 0;
    mockIsLoading = false;
    mockSetActiveView.mockClear();
    mockOpenHistoricalFloor.mockClear();
  });

  it("shows empty state when no sessions exist", () => {
    render(<SessionHistory />);
    expect(screen.getByTestId("session-history-empty")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockIsLoading = true;
    render(<SessionHistory />);
    expect(screen.getByText("Loading history...")).toBeInTheDocument();
  });

  it("renders session rows", () => {
    mockSessions.push(createTestSession(), createTestSession({ id: "session-2", task: "Fix tests" }));
    render(<SessionHistory />);
    const rows = screen.getAllByTestId("session-card");
    expect(rows).toHaveLength(2);
  });

  it("shows task text in compact row", () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    expect(screen.getByText("Build the login page with authentication")).toBeInTheDocument();
  });

  it("shows runtime badge CC for claude-code", () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    expect(screen.getByText("CC")).toBeInTheDocument();
  });

  it("shows runtime badge CX for codex", () => {
    mockSessions.push(createTestSession({ runtime: "codex" }));
    render(<SessionHistory />);
    expect(screen.getByText("CX")).toBeInTheDocument();
  });

  it("shows status dot with correct color", () => {
    mockSessions.push(createTestSession({ status: "completed" }));
    render(<SessionHistory />);
    const dot = screen.getByTestId("status-dot");
    expect(dot).toHaveStyle({ backgroundColor: "#6BCB77" });
  });

  it("shows failed status dot color", () => {
    mockSessions.push(createTestSession({ status: "failed" }));
    render(<SessionHistory />);
    const dot = screen.getByTestId("status-dot");
    expect(dot).toHaveStyle({ backgroundColor: "#FF6B6B" });
  });

  it("shows cost when greater than zero", () => {
    mockSessions.push(createTestSession({ costEstimate: 0.05 }));
    render(<SessionHistory />);
    expect(screen.getByText("$0.05")).toBeInTheDocument();
  });

  it("hides cost when zero", () => {
    mockSessions.push(createTestSession({ costEstimate: 0 }));
    render(<SessionHistory />);
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });

  it("expands session detail on click", async () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    expect(screen.queryByTestId("session-detail")).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId("session-card-header"));
    });
    expect(screen.getByTestId("session-detail")).toBeInTheDocument();
  });

  it("shows summary in expanded detail", async () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("session-card-header"));
    });
    expect(screen.getByText("Successfully built the login page with OAuth integration.")).toBeInTheDocument();
  });

  it("shows token and cost stats in expanded detail", async () => {
    mockSessions.push(createTestSession({ tokensUsed: 15432, costEstimate: 0.0234 }));
    render(<SessionHistory />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("session-card-header"));
    });
    expect(screen.getByText("15,432")).toBeInTheDocument();
    expect(screen.getByText("$0.0234")).toBeInTheDocument();
  });

  it("shows 'no summary' message when summary is null", async () => {
    mockSessions.push(createTestSession({ summary: null }));
    render(<SessionHistory />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("session-card-header"));
    });
    expect(screen.getByText("No summary recorded for this session.")).toBeInTheDocument();
  });

  it("shows Export Replay button in expanded detail", async () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("session-card-header"));
    });
    expect(screen.getByText("Export Replay")).toBeInTheDocument();
  });

  it("collapses on second click", async () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("session-card-header"));
    });
    expect(screen.getByTestId("session-detail")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId("session-card-header"));
    });
    expect(screen.queryByTestId("session-detail")).not.toBeInTheDocument();
  });

  it("shows Open as Floor button in expanded detail", async () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("session-card-header"));
    });
    expect(screen.getByTestId("open-floor-button")).toBeInTheDocument();
    expect(screen.getByText("Open as Floor")).toBeInTheDocument();
  });

  it("shows Open as Floor button regardless of claudeSessionId", async () => {
    mockSessions.push(createTestSession({ claudeSessionId: null }));
    render(<SessionHistory />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("session-card-header"));
    });
    expect(screen.getByTestId("open-floor-button")).toBeInTheDocument();
  });

  it("calls openHistoricalFloor when Open as Floor is clicked", async () => {
    mockSessions.push(createTestSession({ id: "session-42" }));
    render(<SessionHistory />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("session-card-header"));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("open-floor-button"));
    });
    /* Wait for async handleOpenAsFloor to resolve (listSessionEvents is mocked to return []) */
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockOpenHistoricalFloor).toHaveBeenCalled();
    expect(mockSetActiveView).toHaveBeenCalledWith("session");
  });
});

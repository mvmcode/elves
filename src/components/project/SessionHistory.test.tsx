/* Tests for SessionHistory — verifies compact row rendering, expand/collapse, and resume button. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionHistory } from "./SessionHistory";
import type { Session } from "@/types/session";

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

const mockSetTerminalSessionId = vi.fn();
vi.mock("@/stores/ui", () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      highlightedSessionId: null,
      setHighlightedSessionId: vi.fn(),
      setTerminalSessionId: mockSetTerminalSessionId,
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
    mockSetTerminalSessionId.mockClear();
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

  it("expands session detail on click", () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    expect(screen.queryByTestId("session-detail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("session-card-header"));
    expect(screen.getByTestId("session-detail")).toBeInTheDocument();
  });

  it("shows summary in expanded detail", () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    fireEvent.click(screen.getByTestId("session-card-header"));
    expect(screen.getByText("Successfully built the login page with OAuth integration.")).toBeInTheDocument();
  });

  it("shows token and cost stats in expanded detail", () => {
    mockSessions.push(createTestSession({ tokensUsed: 15432, costEstimate: 0.0234 }));
    render(<SessionHistory />);
    fireEvent.click(screen.getByTestId("session-card-header"));
    expect(screen.getByText("15,432")).toBeInTheDocument();
    expect(screen.getByText("$0.0234")).toBeInTheDocument();
  });

  it("shows 'no summary' message when summary is null", () => {
    mockSessions.push(createTestSession({ summary: null }));
    render(<SessionHistory />);
    fireEvent.click(screen.getByTestId("session-card-header"));
    expect(screen.getByText("No summary recorded for this session.")).toBeInTheDocument();
  });

  it("shows Export Replay button in expanded detail", () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    fireEvent.click(screen.getByTestId("session-card-header"));
    expect(screen.getByText("Export Replay")).toBeInTheDocument();
  });

  it("collapses on second click", () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    fireEvent.click(screen.getByTestId("session-card-header"));
    expect(screen.getByTestId("session-detail")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("session-card-header"));
    expect(screen.queryByTestId("session-detail")).not.toBeInTheDocument();
  });

  it("shows resume button when session has claudeSessionId", () => {
    mockSessions.push(createTestSession({ claudeSessionId: "claude-abc-123" }));
    render(<SessionHistory />);
    fireEvent.click(screen.getByTestId("session-card-header"));
    expect(screen.getByTestId("resume-button")).toBeInTheDocument();
    expect(screen.getByText("Resume")).toBeInTheDocument();
  });

  it("does not show resume button when claudeSessionId is null", () => {
    mockSessions.push(createTestSession({ claudeSessionId: null }));
    render(<SessionHistory />);
    fireEvent.click(screen.getByTestId("session-card-header"));
    expect(screen.queryByTestId("resume-button")).not.toBeInTheDocument();
  });

  it("calls setTerminalSessionId when resume is clicked", () => {
    mockSessions.push(createTestSession({ id: "session-42", claudeSessionId: "claude-abc-123" }));
    render(<SessionHistory />);
    fireEvent.click(screen.getByTestId("session-card-header"));
    fireEvent.click(screen.getByTestId("resume-button"));
    expect(mockSetTerminalSessionId).toHaveBeenCalledWith("session-42");
  });
});

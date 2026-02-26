/* Tests for SessionHistory — verifies rendering, empty state, card content, and expand. */

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
    ...overrides,
  };
}

describe("SessionHistory", () => {
  beforeEach(() => {
    mockSessions.length = 0;
    mockIsLoading = false;
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

  it("renders session cards", () => {
    mockSessions.push(createTestSession(), createTestSession({ id: "session-2", task: "Fix tests" }));
    render(<SessionHistory />);
    const cards = screen.getAllByTestId("session-card");
    expect(cards).toHaveLength(2);
  });

  it("shows task text in the card", () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    expect(screen.getByText("Build the login page with authentication")).toBeInTheDocument();
  });

  it("shows runtime icon (CC for claude-code)", () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    expect(screen.getByText("CC")).toBeInTheDocument();
  });

  it("shows CX for codex runtime", () => {
    mockSessions.push(createTestSession({ runtime: "codex" }));
    render(<SessionHistory />);
    expect(screen.getByText("CX")).toBeInTheDocument();
  });

  it("shows status badge", () => {
    mockSessions.push(createTestSession({ status: "completed" }));
    render(<SessionHistory />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("shows failed badge for failed sessions", () => {
    mockSessions.push(createTestSession({ status: "failed" }));
    render(<SessionHistory />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("shows elf count", () => {
    mockSessions.push(createTestSession({ agentCount: 3 }));
    render(<SessionHistory />);
    const text = screen.getByTestId("session-card-header").textContent;
    expect(text).toContain("3 elves");
  });

  it("shows singular elf for single agent", () => {
    mockSessions.push(createTestSession({ agentCount: 1 }));
    render(<SessionHistory />);
    const text = screen.getByTestId("session-card-header").textContent;
    expect(text).toContain("1 elf");
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

  it("shows Replay button in expanded detail", () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    fireEvent.click(screen.getByTestId("session-card-header"));
    expect(screen.getByText("Replay Session")).toBeInTheDocument();
  });

  it("collapses on second click", () => {
    mockSessions.push(createTestSession());
    render(<SessionHistory />);
    fireEvent.click(screen.getByTestId("session-card-header"));
    expect(screen.getByTestId("session-detail")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("session-card-header"));
    expect(screen.queryByTestId("session-detail")).not.toBeInTheDocument();
  });
});

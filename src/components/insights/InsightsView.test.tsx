/* Tests for the InsightsView component. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InsightsView } from "./InsightsView";
import { useAppStore } from "@/stores/app";
import type { InsightsData } from "@/types/insights";
import { insightsData } from "@/test/fixtures";

const mockReload = vi.fn();
let mockReturn: { data: InsightsData | null; isLoading: boolean; error: string | null; reload: () => Promise<void> };

vi.mock("@/hooks/useInsights", () => ({
  useInsights: () => mockReturn,
}));

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ defaultRuntime: "claude-code" });
  mockReturn = { data: insightsData(), isLoading: false, error: null, reload: mockReload };
});

describe("InsightsView", () => {
  it("renders the insights view with all four tabs", () => {
    render(<InsightsView />);

    expect(screen.getByTestId("insights-view")).toBeInTheDocument();
    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByTestId("tab-overview")).toBeInTheDocument();
    expect(screen.getByTestId("tab-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("tab-analysis")).toBeInTheDocument();
    expect(screen.getByTestId("tab-report")).toBeInTheDocument();
  });

  it("shows 9 stat cards on overview tab by default", () => {
    render(<InsightsView />);

    expect(screen.getAllByTestId("stat-card")).toHaveLength(9);
  });

  it("shows model usage table when models are present", () => {
    mockReturn.data = insightsData({
      modelUsage: [{ model: "opus-4-6", inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0, cacheHitRate: 0 }],
    });
    render(<InsightsView />);

    expect(screen.getByText("Model Usage")).toBeInTheDocument();
    expect(screen.getByText("opus-4-6")).toBeInTheDocument();
  });

  it("shows projects table when projects are present", () => {
    mockReturn.data = insightsData({
      projects: [{ name: "myapp", sessions: 1, linesAdded: 0, commits: 0, durationMinutes: 0, tokens: 0 }],
    });
    render(<InsightsView />);

    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("myapp")).toBeInTheDocument();
  });

  it("switches to timeline tab on click", () => {
    render(<InsightsView />);

    fireEvent.click(screen.getByTestId("tab-timeline"));

    expect(screen.getByText("Daily Sessions")).toBeInTheDocument();
    expect(screen.getByText("Daily Messages")).toBeInTheDocument();
    expect(screen.getByText("Hour of Day")).toBeInTheDocument();
  });

  it("switches to analysis tab on click", () => {
    mockReturn.data = insightsData({
      recentSessions: [{ sessionId: "s1", project: "x", startTime: "", durationMinutes: 0, firstPrompt: "", outcome: "ok", briefSummary: "", linesAdded: 0, tokens: 0, commits: 0 }],
    });
    render(<InsightsView />);

    fireEvent.click(screen.getByTestId("tab-analysis"));

    expect(screen.getByText("Outcome Distribution")).toBeInTheDocument();
    expect(screen.getByText("Top Tools")).toBeInTheDocument();
    expect(screen.getByText("Top Languages")).toBeInTheDocument();
    expect(screen.getByText("Feature Adoption")).toBeInTheDocument();
    expect(screen.getByText("Recent Sessions")).toBeInTheDocument();
  });

  it("switches to report tab and shows iframe", () => {
    mockReturn.data = insightsData({ reportHtml: "<h1>Report</h1>" });
    render(<InsightsView />);

    fireEvent.click(screen.getByTestId("tab-report"));

    expect(screen.getByTestId("report-iframe")).toBeInTheDocument();
  });

  it("shows report null state when reportHtml is null", () => {
    mockReturn.data = insightsData({ reportHtml: null });
    render(<InsightsView />);

    fireEvent.click(screen.getByTestId("tab-report"));

    expect(screen.getByTestId("report-null-state")).toBeInTheDocument();
    expect(screen.getByText("No AI Report")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockReturn = { data: null, isLoading: true, error: null, reload: mockReload };
    render(<InsightsView />);

    expect(screen.getByText("Loading insights…")).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockReturn = { data: null, isLoading: false, error: "Something broke", reload: mockReload };
    render(<InsightsView />);

    expect(screen.getByText("Failed to load insights")).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("calls reload on refresh button click", () => {
    render(<InsightsView />);

    fireEvent.click(screen.getByText("Refresh"));
    expect(mockReload).toHaveBeenCalledOnce();
  });

  it("shows coming soon state for Codex runtime", () => {
    useAppStore.setState({ defaultRuntime: "codex" });
    render(<InsightsView />);

    expect(screen.getByTestId("codex-coming-soon")).toBeInTheDocument();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });
});

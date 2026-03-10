/* Tests for the InsightsView component. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { InsightsView } from "./InsightsView";
import type { InsightsData } from "@/types/insights";

const MOCK_DATA: InsightsData = {
  totalSessions: 42,
  totalTokens: 150000,
  totalCost: 12.5,
  totalDuration: 7200,
  totalCommits: 15,
  linesAdded: 3000,
  linesRemoved: 800,
  filesChanged: 25,
  dailySessions: [{ date: "2026-03-01", count: 5 }],
  hourlyDistribution: Array.from({ length: 24 }, () => 0),
  runtimeSplit: [{ runtime: "claude-code", sessions: 42, cost: 12.5 }],
  outcomes: [{ outcome: "success", count: 30, percentage: 71.4 }],
  topTools: [{ name: "Edit", count: 100 }],
  topLanguages: [{ name: "TypeScript", count: 80 }],
  topGoals: [{ name: "feature", count: 20 }],
  topFriction: [{ name: "slow-response", count: 5 }],
};

const mockReload = vi.fn();
let mockReturn: { data: InsightsData | null; isLoading: boolean; error: string | null; reload: () => Promise<void> };

vi.mock("@/hooks/useInsights", () => ({
  useInsights: () => mockReturn,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockReturn = { data: MOCK_DATA, isLoading: false, error: null, reload: mockReload };
});

describe("InsightsView", () => {
  it("renders the insights view with tab bar", () => {
    render(<InsightsView />);

    expect(screen.getByTestId("insights-view")).toBeInTheDocument();
    expect(screen.getByText("Insights")).toBeInTheDocument();
    expect(screen.getByTestId("tab-overview")).toBeInTheDocument();
    expect(screen.getByTestId("tab-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("tab-analysis")).toBeInTheDocument();
  });

  it("shows stat cards on overview tab by default", () => {
    render(<InsightsView />);

    const statCards = screen.getAllByTestId("stat-card");
    expect(statCards.length).toBe(8);
  });

  it("switches to timeline tab on click", () => {
    render(<InsightsView />);

    fireEvent.click(screen.getByTestId("tab-timeline"));

    expect(screen.getByText("Daily Sessions")).toBeInTheDocument();
    expect(screen.getByText("Hour of Day")).toBeInTheDocument();
  });

  it("switches to analysis tab on click", () => {
    render(<InsightsView />);

    fireEvent.click(screen.getByTestId("tab-analysis"));

    expect(screen.getByText("Outcome Distribution")).toBeInTheDocument();
    expect(screen.getByText("Top Tools")).toBeInTheDocument();
    expect(screen.getByText("Top Languages")).toBeInTheDocument();
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
});

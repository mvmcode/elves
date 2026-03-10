/* Tests for the useInsights hook. */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useInsights } from "./useInsights";
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

vi.mock("@/lib/tauri", () => ({
  loadInsights: vi.fn(),
}));

import { loadInsights } from "@/lib/tauri";
const mockLoadInsights = vi.mocked(loadInsights);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useInsights", () => {
  it("returns loading state initially, then data", async () => {
    mockLoadInsights.mockResolvedValue(MOCK_DATA);

    const { result } = renderHook(() => useInsights());

    // Initial state — loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(MOCK_DATA);
    expect(result.current.error).toBeNull();
    expect(mockLoadInsights).toHaveBeenCalledOnce();
  });

  it("sets error on failure", async () => {
    mockLoadInsights.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useInsights());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Network error");
  });

  it("reload fetches fresh data", async () => {
    mockLoadInsights.mockResolvedValue(MOCK_DATA);

    const { result } = renderHook(() => useInsights());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockLoadInsights).toHaveBeenCalledTimes(1);

    const updatedData = { ...MOCK_DATA, totalSessions: 50 };
    mockLoadInsights.mockResolvedValue(updatedData);

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.data?.totalSessions).toBe(50);
    expect(mockLoadInsights).toHaveBeenCalledTimes(2);
  });
});

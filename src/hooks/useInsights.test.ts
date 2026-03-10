/* Tests for the useInsights hook. */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useInsights } from "./useInsights";
import { insightsData } from "@/test/fixtures";

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
    const data = insightsData({ totalSessions: 42 });
    mockLoadInsights.mockResolvedValue(data);

    const { result } = renderHook(() => useInsights());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(data);
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
    mockLoadInsights.mockResolvedValue(insightsData({ totalSessions: 10 }));

    const { result } = renderHook(() => useInsights());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockLoadInsights).toHaveBeenCalledTimes(1);

    mockLoadInsights.mockResolvedValue(insightsData({ totalSessions: 50 }));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.data?.totalSessions).toBe(50);
    expect(mockLoadInsights).toHaveBeenCalledTimes(2);
  });
});

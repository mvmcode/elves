/* Tests for useStallDetection — verifies stall detection timing and state transitions. */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useStallDetection } from "./useStallDetection";

describe("useStallDetection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false when not active", () => {
    const { result } = renderHook(() => useStallDetection(Date.now() - 20_000, false));
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current).toBe(false);
  });

  it("returns false when events are recent", () => {
    const { result } = renderHook(() => useStallDetection(Date.now(), true));
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current).toBe(false);
  });

  it("returns true when events are stale and session is active", () => {
    const { result } = renderHook(() => useStallDetection(Date.now() - 20_000, true));
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current).toBe(true);
  });

  it("returns false when lastEventAt is 0", () => {
    const { result } = renderHook(() => useStallDetection(0, true));
    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current).toBe(false);
  });

  it("clears stall when session becomes inactive", () => {
    const { result, rerender } = renderHook(
      ({ lastEventAt, isActive }) => useStallDetection(lastEventAt, isActive),
      { initialProps: { lastEventAt: Date.now() - 20_000, isActive: true } },
    );

    act(() => { vi.advanceTimersByTime(4000); });
    expect(result.current).toBe(true);

    rerender({ lastEventAt: Date.now() - 20_000, isActive: false });
    expect(result.current).toBe(false);
  });
});

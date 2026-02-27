/* Tests for useResizable hook — verifies drag behavior, clamping, and cleanup. */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useResizable } from "./useResizable";

/** Simulates a mousedown on the handle via the returned onMouseDown handler. */
function simulateMouseDown(
  onMouseDown: (event: React.MouseEvent) => void,
  clientX: number,
): void {
  const fakeEvent = {
    preventDefault: vi.fn(),
    clientX,
  } as unknown as React.MouseEvent;
  onMouseDown(fakeEvent);
}

/** Dispatches a native mousemove on the document. */
function simulateMouseMove(clientX: number): void {
  const event = new MouseEvent("mousemove", { clientX, bubbles: true });
  document.dispatchEvent(event);
}

/** Dispatches a native mouseup on the document. */
function simulateMouseUp(): void {
  const event = new MouseEvent("mouseup", { bubbles: true });
  document.dispatchEvent(event);
}

describe("useResizable", () => {
  let originalRaf: typeof requestAnimationFrame;

  beforeEach(() => {
    /* Replace rAF with immediate execution for test determinism. */
    originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
  });

  it("returns isDragging false initially", () => {
    const onWidthChange = vi.fn();
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 300, onWidthChange, minWidth: 200, maxWidth: 400, side: "right" }),
    );
    expect(result.current.isDragging).toBe(false);
  });

  it("sets isDragging true on mousedown", () => {
    const onWidthChange = vi.fn();
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 300, onWidthChange, minWidth: 200, maxWidth: 400, side: "right" }),
    );

    act(() => {
      simulateMouseDown(result.current.handleProps.onMouseDown, 500);
    });
    expect(result.current.isDragging).toBe(true);
  });

  it("calls onWidthChange with correct delta for right side", () => {
    const onWidthChange = vi.fn();
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 300, onWidthChange, minWidth: 200, maxWidth: 400, side: "right" }),
    );

    act(() => {
      simulateMouseDown(result.current.handleProps.onMouseDown, 500);
      simulateMouseMove(550);
    });
    expect(onWidthChange).toHaveBeenCalledWith(350);
  });

  it("calls onWidthChange with correct delta for left side", () => {
    const onWidthChange = vi.fn();
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 384, onWidthChange, minWidth: 280, maxWidth: 600, side: "left" }),
    );

    act(() => {
      simulateMouseDown(result.current.handleProps.onMouseDown, 800);
      simulateMouseMove(750);
    });
    /* Dragging left (negative delta) increases width for "left" side */
    expect(onWidthChange).toHaveBeenCalledWith(434);
  });

  it("clamps width to maxWidth", () => {
    const onWidthChange = vi.fn();
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 380, onWidthChange, minWidth: 200, maxWidth: 400, side: "right" }),
    );

    act(() => {
      simulateMouseDown(result.current.handleProps.onMouseDown, 500);
      simulateMouseMove(600);
    });
    expect(onWidthChange).toHaveBeenCalledWith(400);
  });

  it("clamps width to minWidth", () => {
    const onWidthChange = vi.fn();
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 250, onWidthChange, minWidth: 200, maxWidth: 400, side: "right" }),
    );

    act(() => {
      simulateMouseDown(result.current.handleProps.onMouseDown, 500);
      simulateMouseMove(400);
    });
    expect(onWidthChange).toHaveBeenCalledWith(200);
  });

  it("sets isDragging false on mouseup", () => {
    const onWidthChange = vi.fn();
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 300, onWidthChange, minWidth: 200, maxWidth: 400, side: "right" }),
    );

    act(() => {
      simulateMouseDown(result.current.handleProps.onMouseDown, 500);
    });
    expect(result.current.isDragging).toBe(true);

    act(() => {
      simulateMouseUp();
    });
    expect(result.current.isDragging).toBe(false);
  });

  it("restores cursor and userSelect on mouseup", () => {
    const onWidthChange = vi.fn();
    const { result } = renderHook(() =>
      useResizable({ initialWidth: 300, onWidthChange, minWidth: 200, maxWidth: 400, side: "right" }),
    );

    act(() => {
      simulateMouseDown(result.current.handleProps.onMouseDown, 500);
    });
    expect(document.body.style.cursor).toBe("col-resize");
    expect(document.body.style.userSelect).toBe("none");

    act(() => {
      simulateMouseUp();
    });
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });
});

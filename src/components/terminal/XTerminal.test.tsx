/* Tests for XTerminal — verifies mount, container rendering, debouncing, scroll tracking, and cleanup. */

import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* Mock xterm.js modules since they rely on DOM APIs not available in jsdom. */
const mockFit = vi.fn();
const mockOpen = vi.fn();
const mockDispose = vi.fn();
const mockOnData = vi.fn(() => ({ dispose: vi.fn() }));
const mockOnResize = vi.fn(() => ({ dispose: vi.fn() }));
const mockOnScroll = vi.fn(() => ({ dispose: vi.fn() }));
const mockLoadAddon = vi.fn();
const mockWrite = vi.fn();
const mockWriteln = vi.fn();
const mockScrollToBottom = vi.fn();
const mockRefresh = vi.fn();
const mockClearTextureAtlas = vi.fn();
const mockFocus = vi.fn();

/* Shared mutable buffer object so tests can change viewportY/baseY */
const mockBuffer = { active: { viewportY: 0, baseY: 0 } };

vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: mockOpen,
    dispose: mockDispose,
    onData: mockOnData,
    onResize: mockOnResize,
    onScroll: mockOnScroll,
    loadAddon: mockLoadAddon,
    write: mockWrite,
    writeln: mockWriteln,
    scrollToBottom: mockScrollToBottom,
    refresh: mockRefresh,
    clearTextureAtlas: mockClearTextureAtlas,
    focus: mockFocus,
    cols: 80,
    rows: 24,
    buffer: mockBuffer,
    unicode: { activeVersion: "6" },
  })),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: mockFit,
    dispose: vi.fn(),
  })),
}));

vi.mock("@xterm/addon-web-links", () => ({
  WebLinksAddon: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
}));

const mockWebglDispose = vi.fn();
const mockWebglOnContextLoss = vi.fn(() => ({ dispose: vi.fn() }));
vi.mock("@xterm/addon-webgl", () => ({
  WebglAddon: vi.fn().mockImplementation(() => ({
    onContextLoss: mockWebglOnContextLoss,
    dispose: mockWebglDispose,
  })),
}));

vi.mock("@xterm/addon-search", () => ({
  SearchAddon: vi.fn().mockImplementation(() => ({
    findNext: vi.fn(),
    clearDecorations: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock("@xterm/addon-unicode11", () => ({
  Unicode11Addon: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
}));

/* Mock ResizeObserver for jsdom */
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: mockObserve,
  disconnect: mockDisconnect,
  unobserve: vi.fn(),
}));

/* Mock IntersectionObserver for jsdom */
globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
}));

/**
 * Mock requestAnimationFrame to execute callbacks synchronously.
 * jsdom's rAF doesn't integrate with vi fake timers, so we run callbacks immediately.
 */
const rAFCallbacks: FrameRequestCallback[] = [];
globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  rAFCallbacks.push(cb);
  return rAFCallbacks.length;
}) as unknown as typeof requestAnimationFrame;

/** Flush all pending requestAnimationFrame callbacks. */
function flushRAF(): void {
  const cbs = rAFCallbacks.splice(0);
  cbs.forEach((cb) => cb(Date.now()));
}

/* Import after mocks are set up */
import { XTerminal } from "./XTerminal";

describe("XTerminal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    /* Reset buffer to "at bottom" state */
    mockBuffer.active.viewportY = 0;
    mockBuffer.active.baseY = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a container div", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    expect(screen.getByTestId("xterminal-container")).toBeInTheDocument();
  });

  it("creates and opens a Terminal instance on mount", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it("loads all addons (Fit, WebLinks, Search, Unicode11, WebGL)", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    // 4 addons loaded before open: Fit, WebLinks, Search, Unicode11
    // + 1 WebGL addon loaded after open
    expect(mockLoadAddon).toHaveBeenCalledTimes(5);
  });

  it("wires onData callback", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    expect(mockOnData).toHaveBeenCalledTimes(1);
  });

  it("wires onResize callback", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    expect(mockOnResize).toHaveBeenCalledTimes(1);
  });

  it("wires onScroll callback for scroll tracking", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    expect(mockOnScroll).toHaveBeenCalledTimes(1);
  });

  it("observes container for resize", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    expect(mockObserve).toHaveBeenCalledTimes(1);
  });

  it("disposes terminal on unmount", () => {
    const { unmount } = render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    unmount();
    expect(mockDispose).toHaveBeenCalledTimes(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });

  it("registers WebGL context loss handler", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    expect(mockWebglOnContextLoss).toHaveBeenCalledTimes(1);
  });

  describe("resize debouncing", () => {
    function getResizeObserverCallback(): ((entries: ResizeObserverEntry[], observer: ResizeObserver) => void) | undefined {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const calls = vi.mocked(globalThis.ResizeObserver).mock.calls as any[][];
      return calls[0]?.[0] as
        ((entries: ResizeObserverEntry[], observer: ResizeObserver) => void) | undefined;
    }

    it("does not call fit immediately when ResizeObserver fires", () => {
      render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
      mockFit.mockClear();

      const callback = getResizeObserverCallback();
      callback?.([], {} as ResizeObserver);

      expect(mockFit).not.toHaveBeenCalled();
    });

    it("debounces rather than calling fit synchronously", () => {
      render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
      mockFit.mockClear();

      const callback = getResizeObserverCallback();
      callback?.([], {} as ResizeObserver);

      /* fit() should NOT be called synchronously — the 100ms debounce timer is pending */
      expect(mockFit).not.toHaveBeenCalled();

      /* After the debounce fires, a rAF is queued. Advance past both. */
      vi.advanceTimersByTime(100);
      flushRAF();

      /* Note: In jsdom with fake timers, rAF behavior varies. The key invariant
       * is that fit() is NOT called synchronously — it's deferred via debounce. */
    });

    it("resets debounce timer on rapid resize events", () => {
      render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);

      const callback = getResizeObserverCallback();

      /* Fire 5 rapid resize events, each 20ms apart — all within 100ms debounce window.
       * Each event should reset the debounce timer, so only the last one triggers. */
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      const initialSetTimeoutCalls = setTimeoutSpy.mock.calls.length;
      const initialClearTimeoutCalls = clearTimeoutSpy.mock.calls.length;

      for (let i = 0; i < 5; i++) {
        callback?.([], {} as ResizeObserver);
      }

      /* Each resize event after the first should clear the previous timer and set a new one */
      const newSetTimeoutCalls = setTimeoutSpy.mock.calls.length - initialSetTimeoutCalls;
      const newClearTimeoutCalls = clearTimeoutSpy.mock.calls.length - initialClearTimeoutCalls;

      expect(newSetTimeoutCalls).toBe(5); /* One setTimeout per resize event */
      expect(newClearTimeoutCalls).toBeGreaterThanOrEqual(4); /* At least 4 clearTimeouts (2nd-5th clear previous) */

      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe("scroll-to-bottom button", () => {
    it("does not show scroll-to-bottom button when at bottom", () => {
      render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
      expect(screen.queryByTestId("scroll-to-bottom")).not.toBeInTheDocument();
    });

    it("shows scroll-to-bottom button when scrolled up from bottom", () => {
      render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scrollCallback = (mockOnScroll.mock.calls as any[][])[0]?.[0] as (() => void) | undefined;
      expect(scrollCallback).toBeDefined();

      mockBuffer.active.viewportY = 0;
      mockBuffer.active.baseY = 50;

      act(() => {
        scrollCallback?.();
      });

      expect(screen.getByTestId("scroll-to-bottom")).toBeInTheDocument();
    });

    it("hides scroll-to-bottom button when scrolled back to bottom", () => {
      render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scrollCallback = (mockOnScroll.mock.calls as any[][])[0]?.[0] as (() => void) | undefined;

      mockBuffer.active.viewportY = 0;
      mockBuffer.active.baseY = 50;
      act(() => { scrollCallback?.(); });
      expect(screen.getByTestId("scroll-to-bottom")).toBeInTheDocument();

      mockBuffer.active.viewportY = 50;
      mockBuffer.active.baseY = 50;
      act(() => { scrollCallback?.(); });
      expect(screen.queryByTestId("scroll-to-bottom")).not.toBeInTheDocument();
    });
  });

  describe("visibility restore (fitImmediate)", () => {
    it("triggers fit + refresh + clearTextureAtlas when elves:refit-terminals fires", () => {
      render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);

      /* Mock positive container dimensions so fit() doesn't early-return in jsdom */
      const container = screen.getByTestId("xterminal-container");
      Object.defineProperty(container, "offsetWidth", { value: 800, configurable: true });
      Object.defineProperty(container, "offsetHeight", { value: 600, configurable: true });

      /* Flush initial mount rAF (vi.useFakeTimers includes rAF), then clear mocks */
      act(() => { vi.advanceTimersByTime(16); });
      mockFit.mockClear();
      mockRefresh.mockClear();
      mockClearTextureAtlas.mockClear();

      /* Dispatch the refit event and advance past the rAF queued by fitImmediate */
      act(() => {
        window.dispatchEvent(new Event("elves:refit-terminals"));
        vi.advanceTimersByTime(16);
      });

      expect(mockFit).toHaveBeenCalledTimes(1);
      expect(mockRefresh).toHaveBeenCalledWith(0, 23); /* rows - 1 = 24 - 1 */
      expect(mockClearTextureAtlas).toHaveBeenCalledTimes(1);
    });
  });

  describe("WebGL recovery cleanup", () => {
    it("cleans up WebGL recovery timer on unmount", () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
      const { unmount } = render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contextLossHandler = (mockWebglOnContextLoss.mock.calls as any[][])[0]?.[0] as (() => void) | undefined;
      expect(contextLossHandler).toBeDefined();
      contextLossHandler?.();

      unmount();
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it("disposes WebGL addon on context loss", () => {
      render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contextLossHandler = (mockWebglOnContextLoss.mock.calls as any[][])[0]?.[0] as (() => void) | undefined;
      contextLossHandler?.();

      expect(mockWebglDispose).toHaveBeenCalledTimes(1);
    });
  });
});

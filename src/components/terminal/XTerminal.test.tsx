/* Tests for XTerminal — verifies mount, container rendering, and cleanup. */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* Mock xterm.js modules since they rely on DOM APIs not available in jsdom. */
const mockOpen = vi.fn();
const mockDispose = vi.fn();
const mockOnData = vi.fn(() => ({ dispose: vi.fn() }));
const mockOnResize = vi.fn(() => ({ dispose: vi.fn() }));
const mockLoadAddon = vi.fn();
const mockWrite = vi.fn();
const mockWriteln = vi.fn();

vi.mock("@xterm/xterm", () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: mockOpen,
    dispose: mockDispose,
    onData: mockOnData,
    onResize: mockOnResize,
    loadAddon: mockLoadAddon,
    write: mockWrite,
    writeln: mockWriteln,
    cols: 80,
    rows: 24,
  })),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock("@xterm/addon-web-links", () => ({
  WebLinksAddon: vi.fn().mockImplementation(() => ({
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

/* Import after mocks are set up */
import { XTerminal } from "./XTerminal";

describe("XTerminal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a container div", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    expect(screen.getByTestId("xterminal-container")).toBeInTheDocument();
  });

  it("creates and opens a Terminal instance on mount", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it("loads FitAddon and WebLinksAddon", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    expect(mockLoadAddon).toHaveBeenCalledTimes(2);
  });

  it("wires onData callback", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    expect(mockOnData).toHaveBeenCalledTimes(1);
  });

  it("wires onResize callback", () => {
    render(<XTerminal onData={vi.fn()} onResize={vi.fn()} />);
    expect(mockOnResize).toHaveBeenCalledTimes(1);
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
});

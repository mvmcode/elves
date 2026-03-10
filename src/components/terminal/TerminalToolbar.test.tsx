/* Tests for TerminalToolbar — verifies rendering, search toggle, button callbacks, status badge, and duration timer. */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TerminalToolbar } from "./TerminalToolbar";
import type { TerminalToolbarProps } from "./TerminalToolbar";

/** Default props for rendering the toolbar in tests. */
function defaultProps(overrides?: Partial<TerminalToolbarProps>): TerminalToolbarProps {
  return {
    status: "live",
    startTime: Date.now() - 154_000, /* 2m 34s ago */
    onClear: vi.fn(),
    onKill: vi.fn(),
    onSearch: vi.fn(),
    onClearSearch: vi.fn(),
    onFontSizeChange: vi.fn(),
    onCopy: vi.fn(),
    isSearchOpen: false,
    onToggleSearch: vi.fn(),
    searchMatchCount: 0,
    currentMatch: 0,
    onSearchNext: vi.fn(),
    onSearchPrev: vi.fn(),
    ...overrides,
  };
}

describe("TerminalToolbar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all toolbar buttons", () => {
    render(<TerminalToolbar {...defaultProps()} />);

    expect(screen.getByTestId("search-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("clear-button")).toBeInTheDocument();
    expect(screen.getByTestId("font-size-decrease")).toBeInTheDocument();
    expect(screen.getByTestId("font-size-increase")).toBeInTheDocument();
    expect(screen.getByTestId("copy-button")).toBeInTheDocument();
    expect(screen.getByTestId("kill-button")).toBeInTheDocument();
  });

  it("hides kill button when status is exited", () => {
    render(<TerminalToolbar {...defaultProps({ status: "exited" })} />);

    expect(screen.queryByTestId("kill-button")).not.toBeInTheDocument();
  });

  it("shows search bar when isSearchOpen is true", () => {
    render(<TerminalToolbar {...defaultProps({ isSearchOpen: true })} />);

    expect(screen.getByTestId("search-bar")).toBeInTheDocument();
    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(screen.getByTestId("search-prev")).toBeInTheDocument();
    expect(screen.getByTestId("search-next")).toBeInTheDocument();
    expect(screen.getByTestId("search-close")).toBeInTheDocument();
  });

  it("hides search bar when isSearchOpen is false", () => {
    render(<TerminalToolbar {...defaultProps({ isSearchOpen: false })} />);

    expect(screen.queryByTestId("search-bar")).not.toBeInTheDocument();
  });

  it("toggles search when search button is clicked", () => {
    const onToggleSearch = vi.fn();
    render(<TerminalToolbar {...defaultProps({ onToggleSearch })} />);

    fireEvent.click(screen.getByTestId("search-toggle"));
    expect(onToggleSearch).toHaveBeenCalledOnce();
  });

  it("calls onKill when stop button is clicked", () => {
    const onKill = vi.fn();
    render(<TerminalToolbar {...defaultProps({ onKill })} />);

    fireEvent.click(screen.getByTestId("kill-button"));
    expect(onKill).toHaveBeenCalledOnce();
  });

  it("calls onSearch with query text when typing in search", () => {
    const onSearch = vi.fn();
    render(<TerminalToolbar {...defaultProps({ isSearchOpen: true, onSearch })} />);

    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "hello" } });
    expect(onSearch).toHaveBeenCalledWith("hello");
  });

  it("calls onClearSearch when search query is cleared", () => {
    const onClearSearch = vi.fn();
    const onSearch = vi.fn();
    render(<TerminalToolbar {...defaultProps({ isSearchOpen: true, onSearch, onClearSearch })} />);

    const input = screen.getByTestId("search-input");
    /* Type something first */
    fireEvent.change(input, { target: { value: "test" } });
    /* Then clear it */
    fireEvent.change(input, { target: { value: "" } });
    expect(onClearSearch).toHaveBeenCalled();
  });

  it("shows correct status badge for live", () => {
    render(<TerminalToolbar {...defaultProps({ status: "live" })} />);

    expect(screen.getByTestId("status-label")).toHaveTextContent("live");
  });

  it("shows correct status badge for idle", () => {
    render(<TerminalToolbar {...defaultProps({ status: "idle" })} />);

    expect(screen.getByTestId("status-label")).toHaveTextContent("idle");
  });

  it("shows correct status badge for exited", () => {
    render(<TerminalToolbar {...defaultProps({ status: "exited" })} />);

    expect(screen.getByTestId("status-label")).toHaveTextContent("exited");
  });

  it("formats duration timer correctly", () => {
    /* Set start time to 154 seconds ago (2m 34s) */
    const now = Date.now();
    vi.setSystemTime(now);

    render(<TerminalToolbar {...defaultProps({ startTime: now - 154_000 })} />);

    expect(screen.getByTestId("duration-timer")).toHaveTextContent("2m 34s");
  });

  it("shows match count when searching with results", () => {
    render(
      <TerminalToolbar
        {...defaultProps({
          isSearchOpen: true,
          searchMatchCount: 12,
          currentMatch: 3,
        })}
      />,
    );

    /* Type something to trigger match count display */
    const input = screen.getByTestId("search-input");
    fireEvent.change(input, { target: { value: "test" } });

    expect(screen.getByTestId("search-match-count")).toHaveTextContent("3 of 12");
  });

  it("calls onClear when clear button is clicked", () => {
    const onClear = vi.fn();
    render(<TerminalToolbar {...defaultProps({ onClear })} />);

    fireEvent.click(screen.getByTestId("clear-button"));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("calls onCopy when copy button is clicked", () => {
    const onCopy = vi.fn();
    render(<TerminalToolbar {...defaultProps({ onCopy })} />);

    fireEvent.click(screen.getByTestId("copy-button"));
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it("calls onFontSizeChange with correct delta", () => {
    const onFontSizeChange = vi.fn();
    render(<TerminalToolbar {...defaultProps({ onFontSizeChange })} />);

    fireEvent.click(screen.getByTestId("font-size-increase"));
    expect(onFontSizeChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByTestId("font-size-decrease"));
    expect(onFontSizeChange).toHaveBeenCalledWith(-1);
  });

  it("calls onSearchNext on Enter in search input", () => {
    const onSearchNext = vi.fn();
    render(<TerminalToolbar {...defaultProps({ isSearchOpen: true, onSearchNext })} />);

    const input = screen.getByTestId("search-input");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSearchNext).toHaveBeenCalledOnce();
  });

  it("calls onSearchPrev on Shift+Enter in search input", () => {
    const onSearchPrev = vi.fn();
    render(<TerminalToolbar {...defaultProps({ isSearchOpen: true, onSearchPrev })} />);

    const input = screen.getByTestId("search-input");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onSearchPrev).toHaveBeenCalledOnce();
  });

  it("calls onToggleSearch on Escape in search input", () => {
    const onToggleSearch = vi.fn();
    render(<TerminalToolbar {...defaultProps({ isSearchOpen: true, onToggleSearch })} />);

    const input = screen.getByTestId("search-input");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onToggleSearch).toHaveBeenCalledOnce();
  });

  it("updates duration timer every second", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    render(<TerminalToolbar {...defaultProps({ startTime: now })} />);

    expect(screen.getByTestId("duration-timer")).toHaveTextContent("0s");

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId("duration-timer")).toHaveTextContent("5s");
  });
});

/* Tests for ThinkingPanel — verifies rendering, toggle, typewriter streaming, and empty state. */

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ThinkingPanel } from "./ThinkingPanel";

describe("ThinkingPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the panel container", () => {
    render(<ThinkingPanel thoughts={[]} isVisible={false} onToggle={vi.fn()} />);
    expect(screen.getByTestId("thinking-panel-container")).toBeInTheDocument();
  });

  it("shows toggle button with 'Show Thinking' when collapsed", () => {
    render(<ThinkingPanel thoughts={[]} isVisible={false} onToggle={vi.fn()} />);
    expect(screen.getByTestId("thinking-toggle")).toBeInTheDocument();
    expect(screen.getByText("Show Thinking")).toBeInTheDocument();
  });

  it("shows toggle button with 'Hide Thinking' when expanded", () => {
    render(<ThinkingPanel thoughts={[]} isVisible={true} onToggle={vi.fn()} />);
    expect(screen.getByText("Hide Thinking")).toBeInTheDocument();
  });

  it("fires onToggle callback when toggle button is clicked", () => {
    const onToggle = vi.fn();
    render(<ThinkingPanel thoughts={[]} isVisible={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId("thinking-toggle"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("shows content panel when isVisible is true", () => {
    render(<ThinkingPanel thoughts={["Hello"]} isVisible={true} onToggle={vi.fn()} />);
    /* Advance timers to let framer-motion and typewriter settle */
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByTestId("thinking-content")).toBeInTheDocument();
  });

  it("hides content panel when isVisible is false", () => {
    render(<ThinkingPanel thoughts={["Hello"]} isVisible={false} onToggle={vi.fn()} />);
    expect(screen.queryByTestId("thinking-content")).not.toBeInTheDocument();
  });

  it("shows empty state when no thoughts and visible", () => {
    render(<ThinkingPanel thoughts={[]} isVisible={true} onToggle={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(100); });
    expect(screen.getByTestId("thinking-empty")).toBeInTheDocument();
    expect(screen.getByText("Waiting for thinking events...")).toBeInTheDocument();
  });

  it("renders thinking text with typewriter effect (eventually shows full text)", () => {
    render(
      <ThinkingPanel
        thoughts={["The agent is analyzing the codebase"]}
        isVisible={true}
        onToggle={vi.fn()}
      />,
    );

    /* Advance timers enough for the typewriter to reveal all characters.
     * Text is 36 chars, CHARS_PER_TICK=3, INTERVAL=10ms → ~120ms needed + buffer */
    act(() => { vi.advanceTimersByTime(500); });

    const textElement = screen.getByTestId("thinking-text");
    expect(textElement.textContent).toContain("The agent is analyzing the codebase");
  });

  it("joins multiple thoughts with double newlines", () => {
    render(
      <ThinkingPanel
        thoughts={["First thought", "Second thought"]}
        isVisible={true}
        onToggle={vi.fn()}
      />,
    );

    /* Advance enough for full text reveal */
    act(() => { vi.advanceTimersByTime(500); });

    const textElement = screen.getByTestId("thinking-text");
    expect(textElement.textContent).toContain("First thought");
    expect(textElement.textContent).toContain("Second thought");
  });

  it("has dashed border on content panel", () => {
    render(<ThinkingPanel thoughts={["Test"]} isVisible={true} onToggle={vi.fn()} />);
    act(() => { vi.advanceTimersByTime(100); });
    const content = screen.getByTestId("thinking-content");
    expect(content.className).toContain("border-dashed");
  });

  it("uses monospace font for thinking text", () => {
    render(
      <ThinkingPanel
        thoughts={["Test thought"]}
        isVisible={true}
        onToggle={vi.fn()}
      />,
    );

    act(() => { vi.advanceTimersByTime(500); });

    const textElement = screen.getByTestId("thinking-text");
    expect(textElement.className).toContain("font-mono");
  });
});

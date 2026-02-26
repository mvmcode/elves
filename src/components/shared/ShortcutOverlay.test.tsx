/* Tests for ShortcutOverlay — verifies rendering, shortcut display, and close behavior. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ShortcutOverlay } from "./ShortcutOverlay";
import { SHORTCUT_DEFINITIONS } from "@/hooks/useKeyboardShortcuts";

describe("ShortcutOverlay", () => {
  it("renders nothing when isOpen is false", () => {
    render(<ShortcutOverlay isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId("shortcut-overlay")).not.toBeInTheDocument();
  });

  it("renders the overlay when isOpen is true", () => {
    render(<ShortcutOverlay isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByTestId("shortcut-overlay")).toBeInTheDocument();
  });

  it("shows the 'Keyboard Shortcuts' title", () => {
    render(<ShortcutOverlay isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument();
  });

  it("displays all shortcut definitions", () => {
    render(<ShortcutOverlay isOpen={true} onClose={vi.fn()} />);
    for (const shortcut of SHORTCUT_DEFINITIONS) {
      expect(screen.getByText(shortcut.description)).toBeInTheDocument();
      expect(screen.getByText(shortcut.keys)).toBeInTheDocument();
    }
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<ShortcutOverlay isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("close-overlay"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<ShortcutOverlay isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("shortcut-overlay"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when card body is clicked", () => {
    const onClose = vi.fn();
    render(<ShortcutOverlay isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("shortcut-card"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

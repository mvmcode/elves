/* Tests for the reusable Dialog component. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("renders title and children when open", () => {
    render(
      <Dialog isOpen onClose={vi.fn()} title="Test Dialog">
        <p>Dialog body</p>
      </Dialog>,
    );
    expect(screen.getByText("Test Dialog")).toBeInTheDocument();
    expect(screen.getByText("Dialog body")).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    render(
      <Dialog isOpen={false} onClose={vi.fn()} title="Hidden">
        <p>Hidden body</p>
      </Dialog>,
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("calls onClose when overlay is clicked", () => {
    const handleClose = vi.fn();
    render(
      <Dialog isOpen onClose={handleClose} title="Overlay Test">
        <p>Content</p>
      </Dialog>,
    );
    fireEvent.click(screen.getByTestId("dialog-overlay"));
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("does not call onClose when dialog content is clicked", () => {
    const handleClose = vi.fn();
    render(
      <Dialog isOpen onClose={handleClose} title="Content Click Test">
        <p>Click me</p>
      </Dialog>,
    );
    fireEvent.click(screen.getByTestId("dialog-content"));
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const handleClose = vi.fn();
    render(
      <Dialog isOpen onClose={handleClose} title="Escape Test">
        <p>Content</p>
      </Dialog>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("has neo-brutalist styling on the content panel", () => {
    render(
      <Dialog isOpen onClose={vi.fn()} title="Style Test">
        <p>Styled</p>
      </Dialog>,
    );
    const content = screen.getByTestId("dialog-content");
    expect(content.className).toContain("border-token-normal");
    expect(content.className).toContain("shadow-brutal-lg");
  });
});

/* Tests for ResizeHandle — verifies rendering, interaction, and visual states. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ResizeHandle } from "./ResizeHandle";

describe("ResizeHandle", () => {
  it("renders the handle element", () => {
    render(<ResizeHandle onMouseDown={vi.fn()} isDragging={false} side="right" />);
    expect(screen.getByTestId("resize-handle")).toBeInTheDocument();
  });

  it("calls onMouseDown when clicked", () => {
    const onMouseDown = vi.fn();
    render(<ResizeHandle onMouseDown={onMouseDown} isDragging={false} side="right" />);
    fireEvent.mouseDown(screen.getByTestId("resize-handle"));
    expect(onMouseDown).toHaveBeenCalledOnce();
  });

  it("applies active highlight class when dragging", () => {
    render(<ResizeHandle onMouseDown={vi.fn()} isDragging={true} side="right" />);
    const handle = screen.getByTestId("resize-handle");
    expect(handle.className).toContain("bg-accent");
  });

  it("positions on right edge for side=right", () => {
    render(<ResizeHandle onMouseDown={vi.fn()} isDragging={false} side="right" />);
    const handle = screen.getByTestId("resize-handle");
    expect(handle.className).toContain("right-0");
  });

  it("positions on left edge for side=left", () => {
    render(<ResizeHandle onMouseDown={vi.fn()} isDragging={false} side="left" />);
    const handle = screen.getByTestId("resize-handle");
    expect(handle.className).toContain("left-0");
  });

  it("renders three grip dots", () => {
    render(<ResizeHandle onMouseDown={vi.fn()} isDragging={false} side="right" />);
    const handle = screen.getByTestId("resize-handle");
    const dots = handle.querySelectorAll(".bg-black");
    expect(dots).toHaveLength(3);
  });
});

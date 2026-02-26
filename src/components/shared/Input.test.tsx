/* Tests for the neo-brutalist Input component. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Input } from "./Input";

describe("Input", () => {
  it("renders as a text input", () => {
    render(<Input placeholder="Type here..." />);
    expect(screen.getByPlaceholderText("Type here...")).toBeInTheDocument();
  });

  it("has neo-brutalist 3px border", () => {
    render(<Input data-testid="input" />);
    expect(screen.getByTestId("input").className).toContain("border-[3px]");
  });

  it("calls onChange handler", () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} data-testid="input" />);
    fireEvent.change(screen.getByTestId("input"), {
      target: { value: "hello" },
    });
    expect(handleChange).toHaveBeenCalledOnce();
  });

  it("forwards ref correctly", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("merges custom className", () => {
    render(<Input className="text-lg" data-testid="input" />);
    expect(screen.getByTestId("input").className).toContain("text-lg");
  });
});

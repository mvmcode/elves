/* Tests for the neo-brutalist Button component. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children text", () => {
    render(<Button>Deploy</Button>);
    expect(screen.getByRole("button")).toHaveTextContent("Deploy");
  });

  it("applies primary variant styles by default", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-elf-gold");
  });

  it("applies danger variant styles", () => {
    render(<Button variant="danger">Delete</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-error");
  });

  it("has neo-brutalist border and shadow classes", () => {
    render(<Button>Test</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("border-[3px]");
    expect(button.className).toContain("shadow-brutal");
  });

  it("calls onClick handler when clicked", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("can be disabled", () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("merges custom className", () => {
    render(<Button className="mt-4">Custom</Button>);
    expect(screen.getByRole("button").className).toContain("mt-4");
  });
});

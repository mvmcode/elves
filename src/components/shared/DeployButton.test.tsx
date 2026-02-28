/* Tests for the DeployButton component. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DeployButton } from "./DeployButton";

describe("DeployButton", () => {
  it("renders the summon text", () => {
    render(<DeployButton />);
    expect(screen.getByRole("button")).toHaveTextContent("Summon the Elves");
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<DeployButton onClick={handleClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("has neo-brutalist styling", () => {
    render(<DeployButton />);
    const button = screen.getByRole("button");
    expect(button.className).toContain("border-token-normal");
    expect(button.className).toContain("shadow-brutal");
  });
});

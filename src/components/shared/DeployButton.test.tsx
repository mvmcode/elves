/* Tests for the DeployButton component (split-button with chevron popover). */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DeployButton } from "./DeployButton";

describe("DeployButton", () => {
  it("renders the summon text", () => {
    render(<DeployButton />);
    expect(screen.getByText("Summon the Elves")).toBeInTheDocument();
  });

  it("calls onClick when main button is clicked", () => {
    const handleClick = vi.fn();
    render(<DeployButton onClick={handleClick} />);
    fireEvent.click(screen.getByText("Summon the Elves"));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("has neo-brutalist styling on the main button", () => {
    render(<DeployButton />);
    const button = screen.getByText("Summon the Elves");
    expect(button.className).toContain("border-token-normal");
    expect(button.className).toContain("shadow-brutal");
  });

  it("renders a chevron button for deploy options", () => {
    render(<DeployButton />);
    expect(screen.getByLabelText("Deploy options")).toBeInTheDocument();
  });
});

/* Tests for the neo-brutalist Card component. */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("renders children content", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("has neo-brutalist border and shadow", () => {
    render(<Card data-testid="card">Test</Card>);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("border-token-normal");
    expect(card.className).toContain("shadow-brutal-lg");
  });

  it("applies elevated surface background by default", () => {
    render(<Card data-testid="card">Test</Card>);
    expect(screen.getByTestId("card").className).toContain("bg-surface-elevated");
  });

  it("applies accent-light highlight background when highlighted", () => {
    render(
      <Card highlight data-testid="card">
        Highlighted
      </Card>,
    );
    expect(screen.getByTestId("card").className).toContain(
      "bg-accent-light",
    );
  });

  it("merges custom className", () => {
    render(
      <Card className="w-64" data-testid="card">
        Test
      </Card>,
    );
    expect(screen.getByTestId("card").className).toContain("w-64");
  });
});

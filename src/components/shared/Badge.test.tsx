/* Tests for the neo-brutalist Badge component. */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies default variant (yellow) styles", () => {
    render(<Badge data-testid="badge">Status</Badge>);
    expect(screen.getByTestId("badge").className).toContain("bg-minion-yellow");
  });

  it("applies success variant styles", () => {
    render(
      <Badge variant="success" data-testid="badge">
        Done
      </Badge>,
    );
    expect(screen.getByTestId("badge").className).toContain("bg-success");
  });

  it("applies error variant styles", () => {
    render(
      <Badge variant="error" data-testid="badge">
        Error
      </Badge>,
    );
    expect(screen.getByTestId("badge").className).toContain("bg-error");
  });

  it("has neo-brutalist 2px border", () => {
    render(<Badge data-testid="badge">Test</Badge>);
    expect(screen.getByTestId("badge").className).toContain("border-[2px]");
  });

  it("merges custom className", () => {
    render(
      <Badge className="ml-2" data-testid="badge">
        Test
      </Badge>,
    );
    expect(screen.getByTestId("badge").className).toContain("ml-2");
  });
});

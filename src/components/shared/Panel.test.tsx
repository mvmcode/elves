/* Tests for the neo-brutalist Panel component. */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Panel } from "./Panel";

describe("Panel", () => {
  it("renders children content", () => {
    render(<Panel>Panel content</Panel>);
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("has border by default", () => {
    render(<Panel data-testid="panel">Test</Panel>);
    expect(screen.getByTestId("panel").className).toContain("border-[3px]");
  });

  it("removes border when bordered=false", () => {
    render(
      <Panel bordered={false} data-testid="panel">
        Test
      </Panel>,
    );
    expect(screen.getByTestId("panel").className).not.toContain("border-[3px]");
  });

  it("merges custom className", () => {
    render(
      <Panel className="h-full" data-testid="panel">
        Test
      </Panel>,
    );
    expect(screen.getByTestId("panel").className).toContain("h-full");
  });
});

/* Tests for the EmptyState component. */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the main message", () => {
    render(<EmptyState message="No projects yet" />);
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });

  it("renders optional submessage", () => {
    render(
      <EmptyState message="Empty" submessage="Create something new" />,
    );
    expect(screen.getByText("Create something new")).toBeInTheDocument();
  });

  it("does not render submessage when not provided", () => {
    const { container } = render(<EmptyState message="Just the message" />);
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(1);
  });
});

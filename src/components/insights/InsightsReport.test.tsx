/* Tests for the InsightsReport component. */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { InsightsReport } from "./InsightsReport";

describe("InsightsReport", () => {
  it("renders null state when reportHtml is null", () => {
    render(<InsightsReport reportHtml={null} />);

    expect(screen.getByTestId("report-null-state")).toBeInTheDocument();
    expect(screen.getByText("No AI Report")).toBeInTheDocument();
    expect(screen.getByText(/Claude Code generates a detailed usage report/)).toBeInTheDocument();
  });

  it("renders iframe when reportHtml is provided", () => {
    const html = "<html><body><h1>Usage Report</h1></body></html>";
    render(<InsightsReport reportHtml={html} />);

    expect(screen.getByTestId("report-iframe-container")).toBeInTheDocument();

    const iframe = screen.getByTestId("report-iframe") as HTMLIFrameElement;
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute("sandbox")).toBe("allow-same-origin");
    expect(iframe.getAttribute("srcdoc")).toBe(html);
    expect(iframe.getAttribute("title")).toBe("Claude Code AI Report");
  });
});

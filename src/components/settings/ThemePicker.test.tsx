/* Tests for the ThemePicker settings component. */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ThemePicker from "./ThemePicker";

const mockSetTheme = vi.fn();

vi.mock("@/stores/settings", () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      theme: "neo-brutalist",
      setTheme: mockSetTheme,
    }),
}));

describe("ThemePicker", () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
  });

  it("renders both theme options", () => {
    render(<ThemePicker />);
    expect(screen.getByTestId("theme-card-neo-brutalist")).toBeInTheDocument();
    expect(screen.getByTestId("theme-card-modern")).toBeInTheDocument();
  });

  it("shows neo-brutalist as selected by default", () => {
    render(<ThemePicker />);
    const neoBrutalist = screen.getByTestId("theme-card-neo-brutalist");
    const modern = screen.getByTestId("theme-card-modern");
    expect(neoBrutalist).toHaveAttribute("aria-pressed", "true");
    expect(modern).toHaveAttribute("aria-pressed", "false");
  });

  it("calls setTheme with 'modern' when modern card is clicked", () => {
    render(<ThemePicker />);
    fireEvent.click(screen.getByTestId("theme-card-modern"));
    expect(mockSetTheme).toHaveBeenCalledWith("modern");
  });

  it("calls setTheme with 'neo-brutalist' when neo-brutalist card is clicked", () => {
    render(<ThemePicker />);
    fireEvent.click(screen.getByTestId("theme-card-neo-brutalist"));
    expect(mockSetTheme).toHaveBeenCalledWith("neo-brutalist");
  });

  it("displays theme names and descriptions", () => {
    render(<ThemePicker />);
    expect(screen.getByText("Neo-Brutalist")).toBeInTheDocument();
    expect(screen.getByText("Modern")).toBeInTheDocument();
    expect(screen.getByText(/Bold borders, hard shadows/)).toBeInTheDocument();
    expect(screen.getByText(/Clean lines, subtle shadows/)).toBeInTheDocument();
  });
});
